const Busboy = require('busboy');
const supabase = require('../lib/supabase');
const crypto = require('crypto');

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const VALID_MIME = ['image/png', 'image/jpeg', 'image/webp'];
const VALID_CATEGORIES = ['bug', 'cosmetic', 'mobile', 'copy', 'suggestion'];
const BUCKET = 'feedback-screenshots';

// Vercel needs raw body for multipart — disable built-in parser
module.exports.config = { api: { bodyParser: false } };

function parseMultipart(req) {
  return new Promise(function(resolve, reject) {
    var fields = {};
    var fileData = null;
    var fileMime = null;
    var fileExt = null;
    var fileSize = 0;
    var fileTooLarge = false;

    var bb = Busboy({
      headers: req.headers,
      limits: { fileSize: MAX_FILE_SIZE, files: 1, fields: 10 }
    });

    bb.on('file', function(fieldname, stream, info) {
      if (fieldname !== 'screenshot') {
        stream.resume();
        return;
      }
      if (VALID_MIME.indexOf(info.mimeType) === -1) {
        stream.resume();
        return;
      }
      fileMime = info.mimeType;
      var extMap = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
      fileExt = extMap[fileMime] || 'png';
      var chunks = [];

      stream.on('data', function(chunk) {
        fileSize += chunk.length;
        if (fileSize > MAX_FILE_SIZE) {
          fileTooLarge = true;
          stream.destroy();
          return;
        }
        chunks.push(chunk);
      });

      stream.on('end', function() {
        if (!fileTooLarge && chunks.length > 0) {
          fileData = Buffer.concat(chunks);
        }
      });
    });

    bb.on('field', function(name, val) {
      fields[name] = typeof val === 'string' ? val.replace(/<[^>]*>/g, '').trim() : '';
    });

    bb.on('close', function() {
      if (fileTooLarge) return reject(new Error('File exceeds 5 MB'));
      resolve({ fields: fields, fileData: fileData, fileMime: fileMime, fileExt: fileExt });
    });

    bb.on('error', reject);

    req.pipe(bb);
  });
}

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET: List feedback (for admin panel) ──
  if (req.method === 'GET') {
    if (!supabase) return res.json({ feedback: [] });
    try {
      var query = supabase.from('feedback').select('*').order('created_at', { ascending: false }).limit(200);
      var statusParam = req.query && req.query.status;
      var catParam = req.query && req.query.category;
      if (statusParam) query = query.eq('status', statusParam);
      if (catParam) query = query.eq('category', catParam);
      var result = await query;
      if (result.error) return res.status(500).json({ error: result.error.message });
      return res.json({ feedback: result.data || [] });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── PUT: Update status (from admin panel) ──
  if (req.method === 'PUT') {
    if (!supabase) return res.json({ ok: true, fallback: true });
    try {
      // bodyParser is disabled, so read raw body manually
      var rawBody = await new Promise(function(resolve) {
        var chunks = [];
        req.on('data', function(c) { chunks.push(c); });
        req.on('end', function() { resolve(Buffer.concat(chunks).toString()); });
      });
      var body = {};
      try { body = JSON.parse(rawBody); } catch(e) {}
      var fbId = body.id;
      var newStatus = body.status;
      var validStatuses = ['new', 'reviewed', 'fixed', 'wontfix'];
      if (!fbId || validStatuses.indexOf(newStatus) === -1) {
        return res.status(400).json({ error: 'Invalid id or status' });
      }
      var upd = await supabase.from('feedback').update({ status: newStatus }).eq('id', fbId);
      if (upd.error) return res.status(500).json({ error: upd.error.message });
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST: Submit new feedback ──
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    var parsed = await parseMultipart(req);
    var f = parsed.fields;

    // Validate category
    var category = (f.category || '').toLowerCase();
    if (VALID_CATEGORIES.indexOf(category) === -1) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    // Validate description
    var description = f.description || '';
    if (!description || description.length < 3) {
      return res.status(400).json({ error: 'Description is required' });
    }
    if (description.length > 5000) {
      description = description.substring(0, 5000);
    }

    // Sanitize optional fields
    var brand = (f.brand || '').substring(0, 50);
    var pageUrl = (f.page_url || '').substring(0, 500);
    var reporterName = (f.reporter_name || '').substring(0, 100);

    // Fallback if no Supabase
    if (!supabase) {
      console.log('[Kevin] Feedback received (no DB):', { category: category, brand: brand, description: description.substring(0, 80) });
      return res.json({ ok: true, fallback: true });
    }

    // Upload image to Supabase Storage (if provided)
    var imageUrl = null;
    if (parsed.fileData) {
      var filename = Date.now() + '-' + crypto.randomBytes(4).toString('hex') + '.' + parsed.fileExt;
      var uploadPath = filename;

      var uploadResult = await supabase.storage
        .from(BUCKET)
        .upload(uploadPath, parsed.fileData, {
          contentType: parsed.fileMime,
          upsert: false
        });

      if (uploadResult.error) {
        console.error('[Kevin] Storage upload failed:', uploadResult.error.message);
        // Continue without image — don't fail the whole submission
      } else {
        var urlResult = supabase.storage.from(BUCKET).getPublicUrl(uploadPath);
        imageUrl = urlResult.data.publicUrl;
      }
    }

    // Insert feedback row
    var insertResult = await supabase
      .from('feedback')
      .insert({
        image_url: imageUrl,
        category: category,
        brand: brand || null,
        page_url: pageUrl || null,
        description: description,
        reporter_name: reporterName || null,
        status: 'new'
      })
      .select('id')
      .single();

    if (insertResult.error) {
      console.error('[Kevin] DB insert failed:', insertResult.error.message);
      return res.status(500).json({ error: 'Failed to save feedback' });
    }

    return res.json({ ok: true, id: insertResult.data.id });

  } catch (err) {
    console.error('[Kevin] Error:', err.message);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}

module.exports = handler;
