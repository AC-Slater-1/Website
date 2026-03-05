/**
 * pixel-config.js — Returns ad pixel configuration
 * Reads from Vercel environment variables, returns to client.
 * Only exposes PUBLIC pixel IDs (safe for client-side).
 * Server-side tokens (CAPI) are NOT exposed here.
 */

async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Cache for 1 hour — pixel IDs don't change often
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');

  // Only return PUBLIC identifiers (client-safe)
  // Server-side tokens (META_CAPI_TOKEN, GOOGLE_ADS_API_TOKEN) are NOT included
  var config = {};

  // Google Ads
  if (process.env.GOOGLE_ADS_CONVERSION_ID) {
    config.google_conversion_id = process.env.GOOGLE_ADS_CONVERSION_ID;
  }
  if (process.env.GOOGLE_ADS_CONVERSION_LABEL) {
    config.google_conversion_label = process.env.GOOGLE_ADS_CONVERSION_LABEL;
  }

  // Meta Pixel
  if (process.env.META_PIXEL_ID) {
    config.meta_pixel_id = process.env.META_PIXEL_ID;
  }

  // If no pixels configured, return empty (ab-pixels.js handles gracefully)
  return res.status(200).json(config);
}

module.exports = handler;
