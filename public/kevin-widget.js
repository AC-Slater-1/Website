/**
 * Kevin Widget — Floating feedback bot for all pages
 * Self-contained: injects its own CSS + HTML. Zero dependencies.
 * Usage: <script src="/kevin-widget.js"></script> before </body>
 */
(function() {
  'use strict';

  // Don't load on admin or standalone feedback page
  var loc = window.location.pathname;
  if (loc.indexOf('/admin') !== -1 || loc.indexOf('/feedback.html') !== -1) return;

  // ── Auto-detect brand from URL ──
  var brands = ['appbusters','saasbuster','samebutfree','sassbuster','limeware','iseeq','modelt','nocatch','plainlabel','vanillalabs','compareto','16kb'];
  var pathParts = loc.split('/').filter(Boolean);
  var detectedBrand = '';
  if (pathParts.length > 0 && brands.indexOf(pathParts[0]) !== -1) {
    detectedBrand = pathParts[0];
  }

  // ── Inject CSS ──
  var css = document.createElement('style');
  css.textContent = [
    '.kw-fab{position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:50%;background:#ffd700;border:none;cursor:pointer;z-index:10000;display:flex;align-items:center;justify-content:center;font-size:24px;box-shadow:0 4px 16px rgba(255,215,0,0.35);transition:all .2s cubic-bezier(.4,0,.2,1);line-height:1}',
    '.kw-fab:hover{transform:scale(1.08);box-shadow:0 6px 24px rgba(255,215,0,0.5)}',
    '.kw-fab.kw-open{background:#27272a;box-shadow:0 4px 16px rgba(0,0,0,0.4)}',
    '.kw-panel{position:fixed;bottom:92px;right:24px;width:360px;max-height:calc(100vh - 120px);background:#18181b;border:1px solid #27272a;border-radius:14px;z-index:10000;display:flex;flex-direction:column;box-shadow:0 12px 40px rgba(0,0,0,0.6);transform:translateY(20px) scale(0.95);opacity:0;visibility:hidden;transition:all .25s cubic-bezier(.4,0,.2,1);overflow:hidden}',
    '.kw-panel.kw-visible{transform:translateY(0) scale(1);opacity:1;visibility:visible}',
    '.kw-header{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #27272a;flex-shrink:0}',
    '.kw-title{font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;font-size:.95rem;font-weight:700;color:#fafafa;letter-spacing:-.01em}',
    '.kw-title span{color:#ffd700}',
    '.kw-close{background:none;border:none;color:#a1a1aa;cursor:pointer;font-size:18px;padding:4px;line-height:1;border-radius:4px;transition:color .15s}',
    '.kw-close:hover{color:#fafafa}',
    '.kw-body{padding:16px 18px;overflow-y:auto;flex:1}',
    '.kw-field{margin-bottom:14px}',
    '.kw-field:last-child{margin-bottom:0}',
    '.kw-label{display:block;font-family:Inter,-apple-system,sans-serif;font-size:.72rem;font-weight:600;color:#a1a1aa;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}',
    '.kw-input,.kw-textarea{width:100%;background:#09090b;border:1px solid #27272a;border-radius:6px;color:#fafafa;font-family:Inter,-apple-system,sans-serif;font-size:.88rem;padding:8px 12px;outline:none;transition:border-color .15s}',
    '.kw-input:focus,.kw-textarea:focus{border-color:#3b82f6;box-shadow:0 0 0 2px rgba(59,130,246,.15)}',
    '.kw-textarea{resize:vertical;min-height:72px}',
    '.kw-upload{border:2px dashed #27272a;border-radius:8px;padding:16px 12px;text-align:center;cursor:pointer;transition:all .15s;position:relative;overflow:hidden}',
    '.kw-upload:hover{border-color:#3b82f6;background:rgba(59,130,246,.08)}',
    '.kw-upload.kw-has-image{padding:0;border-style:solid;border-color:#27272a}',
    '.kw-upload-prompt{pointer-events:none;font-family:Inter,-apple-system,sans-serif}',
    '.kw-upload-icon{font-size:1.5rem;display:block;margin-bottom:4px}',
    '.kw-upload-text{color:#a1a1aa;font-size:.8rem}',
    '.kw-upload-text strong{color:#3b82f6}',
    '.kw-upload-hint{color:#a1a1aa;font-size:.68rem;opacity:.6;margin-top:2px}',
    '.kw-upload img{display:block;width:100%;max-height:160px;object-fit:contain;background:#000;border-radius:6px}',
    '.kw-upload .kw-remove{position:absolute;top:6px;right:6px;background:rgba(0,0,0,.7);color:#fff;border:none;border-radius:50%;width:24px;height:24px;font-size:14px;cursor:pointer;display:none;align-items:center;justify-content:center;line-height:1;z-index:2}',
    '.kw-upload.kw-has-image .kw-remove{display:flex}',
    '.kw-upload.kw-has-image .kw-upload-prompt{display:none}',
    '.kw-field input[type="file"]{display:none}',
    '.kw-pills{display:flex;flex-wrap:wrap;gap:6px}',
    '.kw-pill{display:inline-flex;align-items:center;gap:4px;padding:5px 10px;border:1px solid #27272a;border-radius:100px;background:#09090b;color:#a1a1aa;font-family:Inter,-apple-system,sans-serif;font-size:.78rem;font-weight:500;cursor:pointer;transition:all .15s;user-select:none}',
    '.kw-pill:hover{border-color:#a1a1aa;color:#fafafa}',
    '.kw-pill.kw-active{border-color:#ffd700;background:rgba(255,215,0,.12);color:#ffd700}',
    '.kw-pill input{display:none}',
    '.kw-submit{width:100%;padding:10px;border:none;border-radius:8px;background:#ffd700;color:#000;font-family:Inter,-apple-system,sans-serif;font-size:.9rem;font-weight:700;cursor:pointer;transition:all .15s;letter-spacing:-.01em}',
    '.kw-submit:hover{background:#ffe44d;transform:translateY(-1px)}',
    '.kw-submit:active{transform:translateY(0)}',
    '.kw-submit:disabled{opacity:.5;cursor:not-allowed;transform:none}',
    '.kw-toast{position:fixed;bottom:100px;right:24px;background:#18181b;border:1px solid #27272a;border-radius:10px;padding:12px 20px;font-family:Inter,-apple-system,sans-serif;font-size:.85rem;font-weight:500;box-shadow:0 8px 24px rgba(0,0,0,.5);z-index:10001;opacity:0;transform:translateY(10px);transition:all .25s;pointer-events:none}',
    '.kw-toast.kw-show{opacity:1;transform:translateY(0)}',
    '.kw-toast.kw-success{border-color:#22c55e;color:#22c55e}',
    '.kw-toast.kw-error{border-color:#ef4444;color:#ef4444}',
    '.kw-field-error .kw-input,.kw-field-error .kw-textarea{border-color:#ef4444}',
    '.kw-err{color:#ef4444;font-family:Inter,-apple-system,sans-serif;font-size:.72rem;margin-top:3px;display:none}',
    '.kw-field-error .kw-err{display:block}',
    '@media(max-width:480px){.kw-panel{right:12px;left:12px;width:auto;bottom:84px;max-height:calc(100vh - 100px)}.kw-fab{bottom:16px;right:16px;width:50px;height:50px;font-size:20px}.kw-toast{right:12px;left:12px;bottom:80px}}'
  ].join('\n');
  document.head.appendChild(css);

  // ── Helper: create element with attrs + children ──
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function(k) {
        if (k === 'className') node.className = attrs[k];
        else if (k === 'textContent') node.textContent = attrs[k];
        else node.setAttribute(k, attrs[k]);
      });
    }
    if (children) {
      children.forEach(function(c) {
        if (typeof c === 'string') node.appendChild(document.createTextNode(c));
        else if (c) node.appendChild(c);
      });
    }
    return node;
  }

  // ── Build FAB ──
  var fab = el('button', { className: 'kw-fab', 'aria-label': 'Report an issue', title: 'Report an issue', textContent: '\uD83D\uDCF8' });

  // ── Build Panel DOM ──
  var closeBtn = el('button', { className: 'kw-close', 'aria-label': 'Close', textContent: '\u00D7' });
  var titleSpan = el('span', { textContent: 'Kevin' });
  var titleEl = el('div', { className: 'kw-title' }, [titleSpan, ' \u2014 Report Issue']);

  var panelHeader = el('div', { className: 'kw-header' }, [titleEl, closeBtn]);

  // Upload zone
  var preview = el('img', { id: 'kwPreview', alt: 'Preview', style: 'display:none' });
  var removeBtn = el('button', { className: 'kw-remove', type: 'button', textContent: '\u00D7' });
  var uploadPrompt = el('div', { className: 'kw-upload-prompt' }, [
    el('span', { className: 'kw-upload-icon', textContent: '\uD83D\uDCF8' }),
    el('div', { className: 'kw-upload-text' }, [el('strong', { textContent: 'Click to upload' })]),
    el('div', { className: 'kw-upload-hint', textContent: 'PNG, JPG, WebP \u00B7 Max 5 MB' })
  ]);
  var uploadZone = el('div', { className: 'kw-upload', id: 'kwUpload' }, [uploadPrompt, preview, removeBtn]);
  var fileInput = el('input', { type: 'file', id: 'kwFile', accept: 'image/png,image/jpeg,image/webp' });
  var uploadField = el('div', { className: 'kw-field' }, [
    el('div', { className: 'kw-label', textContent: 'Screenshot' }),
    uploadZone,
    fileInput
  ]);

  // Category pills
  var catData = [
    { val: 'bug', label: '\uD83D\uDC1B Bug' },
    { val: 'cosmetic', label: '\uD83C\uDFA8 Cosmetic' },
    { val: 'mobile', label: '\uD83D\uDCF1 Mobile' },
    { val: 'copy', label: '\uD83D\uDCAC Copy' },
    { val: 'suggestion', label: '\uD83D\uDCA1 Idea' }
  ];
  var pillEls = catData.map(function(c) {
    var radio = el('input', { type: 'radio', name: 'kw_cat', value: c.val });
    var pill = el('label', { className: 'kw-pill', 'data-value': c.val }, [radio, c.label]);
    return pill;
  });
  var pillsContainer = el('div', { className: 'kw-pills' }, pillEls);
  var catErr = el('div', { className: 'kw-err', textContent: 'Pick a category' });
  var catField = el('div', { className: 'kw-field', id: 'kwCatField' }, [
    el('div', { className: 'kw-label', textContent: 'Category' }),
    pillsContainer,
    catErr
  ]);

  // Description
  var descInput = el('textarea', { className: 'kw-textarea', id: 'kwDesc', placeholder: 'Describe the issue...', rows: '3' });
  var descErr = el('div', { className: 'kw-err', textContent: 'Please describe the issue' });
  var descField = el('div', { className: 'kw-field', id: 'kwDescField' }, [
    el('div', { className: 'kw-label', textContent: "What's wrong?" }),
    descInput,
    descErr
  ]);

  // Name
  var nameInput = el('input', { className: 'kw-input', type: 'text', id: 'kwName', placeholder: "Who's reporting?" });
  var nameField = el('div', { className: 'kw-field' }, [
    el('div', { className: 'kw-label', textContent: 'Your Name' }),
    nameInput
  ]);

  // Submit
  var submitBtn = el('button', { className: 'kw-submit', type: 'submit', id: 'kwSubmit', textContent: 'Send to Kevin \uD83D\uDCEE' });
  var submitField = el('div', { className: 'kw-field' }, [submitBtn]);

  // Form
  var form = el('form', { id: 'kwForm', novalidate: '' }, [uploadField, catField, descField, nameField, submitField]);
  var panelBody = el('div', { className: 'kw-body' }, [form]);

  // Panel
  var panel = el('div', { className: 'kw-panel' }, [panelHeader, panelBody]);

  // Toast
  var toastEl = el('div', { className: 'kw-toast', id: 'kwToast' });

  // ── Mount ──
  document.body.appendChild(fab);
  document.body.appendChild(panel);
  document.body.appendChild(toastEl);

  // ── State ──
  var isOpen = false;
  var selectedFile = null;

  // Restore saved name
  var saved = localStorage.getItem('kevin_reporter_name');
  if (saved) nameInput.value = saved;

  // ── FAB toggle ──
  fab.addEventListener('click', function() {
    isOpen = !isOpen;
    panel.classList.toggle('kw-visible', isOpen);
    fab.classList.toggle('kw-open', isOpen);
    fab.textContent = isOpen ? '\u2715' : '\uD83D\uDCF8';
  });

  closeBtn.addEventListener('click', function() {
    isOpen = false;
    panel.classList.remove('kw-visible');
    fab.classList.remove('kw-open');
    fab.textContent = '\uD83D\uDCF8';
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && isOpen) {
      isOpen = false;
      panel.classList.remove('kw-visible');
      fab.classList.remove('kw-open');
      fab.textContent = '\uD83D\uDCF8';
    }
  });

  // ── Category pills ──
  pillEls.forEach(function(pill) {
    pill.addEventListener('click', function() {
      pillEls.forEach(function(p) { p.classList.remove('kw-active'); });
      pill.classList.add('kw-active');
      pill.querySelector('input').checked = true;
      catField.classList.remove('kw-field-error');
    });
  });

  // ── Upload ──
  uploadZone.addEventListener('click', function(e) {
    if (e.target === removeBtn || e.target.closest('.kw-remove')) return;
    fileInput.click();
  });

  fileInput.addEventListener('change', function() {
    if (fileInput.files.length > 0) handleFile(fileInput.files[0]);
  });

  uploadZone.addEventListener('dragover', function(e) {
    e.preventDefault();
    uploadZone.style.borderColor = '#3b82f6';
    uploadZone.style.background = 'rgba(59,130,246,.08)';
  });
  uploadZone.addEventListener('dragleave', function() {
    uploadZone.style.borderColor = '';
    uploadZone.style.background = '';
  });
  uploadZone.addEventListener('drop', function(e) {
    e.preventDefault();
    uploadZone.style.borderColor = '';
    uploadZone.style.background = '';
    if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
  });

  removeBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    selectedFile = null;
    preview.src = '';
    preview.style.display = 'none';
    uploadZone.classList.remove('kw-has-image');
    fileInput.value = '';
  });

  function handleFile(file) {
    var valid = ['image/png', 'image/jpeg', 'image/webp'];
    if (valid.indexOf(file.type) === -1) {
      showToast('Only PNG, JPG, or WebP files', 'kw-error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('File must be under 5 MB', 'kw-error');
      return;
    }
    selectedFile = file;
    var reader = new FileReader();
    reader.onload = function(e) {
      preview.src = e.target.result;
      preview.style.display = 'block';
      uploadZone.classList.add('kw-has-image');
    };
    reader.readAsDataURL(file);
  }

  // ── Submit ──
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    var valid = true;

    var category = form.querySelector('input[name="kw_cat"]:checked');
    if (!category) {
      catField.classList.add('kw-field-error');
      valid = false;
    }

    var desc = descInput.value.trim();
    if (!desc) {
      descField.classList.add('kw-field-error');
      valid = false;
    } else {
      descField.classList.remove('kw-field-error');
    }

    if (!valid) return;

    var name = nameInput.value.trim();
    if (name) localStorage.setItem('kevin_reporter_name', name);

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    var fd = new FormData();
    if (selectedFile) fd.append('screenshot', selectedFile);
    fd.append('category', category.value);
    fd.append('brand', detectedBrand);
    fd.append('page_url', window.location.href);
    fd.append('description', desc);
    fd.append('reporter_name', name);

    fetch('/api/feedback', { method: 'POST', body: fd })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.ok) {
          showToast('Thanks! Kevin got it. \uD83C\uDF89', 'kw-success');
          resetForm();
          setTimeout(function() {
            isOpen = false;
            panel.classList.remove('kw-visible');
            fab.classList.remove('kw-open');
            fab.textContent = '\uD83D\uDCF8';
          }, 1800);
        } else {
          showToast(data.error || 'Something went wrong', 'kw-error');
        }
      })
      .catch(function() {
        showToast('Network error \u2014 try again', 'kw-error');
      })
      .finally(function() {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send to Kevin \uD83D\uDCEE';
      });
  });

  function resetForm() {
    selectedFile = null;
    preview.src = '';
    preview.style.display = 'none';
    uploadZone.classList.remove('kw-has-image');
    fileInput.value = '';
    pillEls.forEach(function(p) { p.classList.remove('kw-active'); });
    form.querySelectorAll('input[name="kw_cat"]').forEach(function(r) { r.checked = false; });
    descInput.value = '';
  }

  function showToast(msg, type) {
    toastEl.textContent = msg;
    toastEl.className = 'kw-toast ' + type + ' kw-show';
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(function() {
      toastEl.classList.remove('kw-show');
    }, 3500);
  }

})();
