/**
 * build-brands.js — Multi-Brand Page Generator
 *
 * Reads 3 templates (homepage, product-page, signup) + 22 product JSONs + 12 brand configs
 * Generates 288 HTML files: 12 brands × (1 homepage + 22 product pages + 1 signup)
 *
 * Usage: node build-brands.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const BRANDS_DIR = path.join(ROOT, 'brands');
const PRODUCTS_DIR = path.join(ROOT, 'products', 'appbuster');
const PUBLIC_DIR = path.join(ROOT, 'public');
const TEMPLATES_DIR = path.join(ROOT, 'templates');

// ── Helpers ──────────────────────────────────────

function hexToRgb(hex) {
  hex = hex.replace('#', '');
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16)
  };
}

function lightenHex(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  const lr = Math.min(255, Math.round(r + (255 - r) * amount));
  const lg = Math.min(255, Math.round(g + (255 - g) * amount));
  const lb = Math.min(255, Math.round(b + (255 - b) * amount));
  return '#' + [lr, lg, lb].map(c => c.toString(16).padStart(2, '0')).join('');
}

function darkenHex(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  const dr = Math.max(0, Math.round(r * (1 - amount)));
  const dg = Math.max(0, Math.round(g * (1 - amount)));
  const db = Math.max(0, Math.round(b * (1 - amount)));
  return '#' + [dr, dg, db].map(c => c.toString(16).padStart(2, '0')).join('');
}

// ── Font Links ───────────────────────────────────

function generateFontLinks(brand) {
  const lines = [
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    `<link href="${brand.fonts}" rel="stylesheet">`
  ];
  // Ensure JetBrains Mono is loaded for code/agentic sections
  if (!brand.fonts.includes('JetBrains+Mono')) {
    lines.push('<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">');
  }
  return lines.join('\n  ');
}

// ── CSS Override Block Generator ─────────────────

function generateBrandOverrides(config) {
  const v = config.vars;
  let css = '\n    /* ── Brand Override ── */\n';
  css += '    :root {\n';
  css += `      --bg: ${v.bg};\n`;
  css += `      --surface: ${v.surface};\n`;
  css += `      --surface-hover: ${v.surfaceHover};\n`;
  css += `      --border: ${v.border};\n`;
  css += `      --text: ${v.text};\n`;
  css += `      --muted: ${v.muted};\n`;
  css += `      --gold: ${v.gold};\n`;
  css += `      --gold-dim: ${v.goldDim};\n`;
  if (v.goldGlow) css += `      --gold-glow: ${v.goldGlow};\n`;
  css += `      --blue: ${v.blue};\n`;
  css += `      --blue-dim: ${v.blueDim};\n`;
  css += `      --sans: ${v.sans};\n`;
  css += `      --mono: ${v.mono};\n`;
  css += '    }\n';

  // Light theme structural overrides
  if (!config.isDark) {
    css += generateLightThemeCSS(config);
  }

  // Brutalist overrides
  if (config.brutalist) {
    css += generateBrutalistCSS(config);
  }

  // Heading font override (Model T, App Busters, etc.)
  if (config.headingFont) {
    css += '\n    /* Heading font */\n';
    css += `    .hero h1, .section-title, .pricing-card h3, .hero-title, .cta-free { font-family: ${config.headingFont}; }\n`;
  }

  // Extra CSS from config
  if (config.extraCSS) {
    css += '\n    ' + config.extraCSS + '\n';
  }

  // Extra CSS from file (brands/{slug}/extra.css)
  if (config._extraCSSFile) {
    css += '\n    /* ── Brand Extra CSS ── */\n';
    css += config._extraCSSFile + '\n';
  }

  return css;
}

// ── Light Theme CSS ──────────────────────────────
// Overrides dark-specific structural elements for light brands

function generateLightThemeCSS(config) {
  const v = config.vars;
  const accent = v.gold;
  const accentOnBg = config.accentOnBg || '#fff';
  const bgRgb = hexToRgb(v.bg);

  let css = '\n    /* ── Light Theme Structural Overrides ── */\n';

  // Nav glass effect — light background
  css += `    nav { background: rgba(${bgRgb.r}, ${bgRgb.g}, ${bgRgb.b}, 0.92) !important; }\n`;

  // Button text on gold background
  css += `    .btn-gold { color: ${accentOnBg} !important; }\n`;

  // Hero grid lines — dark on light (instead of white on dark)
  css += '    .hero-grid { background-image: linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px) !important; }\n';

  // Stats bar — light background
  css += `    .stats-row { background: ${v.surface} !important; border: 1px solid ${v.border} !important; }\n`;
  css += `    .stat-number { color: ${accent} !important; }\n`;
  css += `    .stat-label { color: ${v.muted} !important; }\n`;

  // Pricing section
  css += `    .pricing-card { background: ${v.surface} !important; border-color: ${v.border} !important; }\n`;
  css += `    .pricing-card h3 { color: ${v.text} !important; }\n`;
  css += `    .price { color: ${v.text} !important; }\n`;
  css += `    .pricing-card .features li { color: ${v.muted} !important; }\n`;
  css += `    .pricing-card.featured { border-color: ${accent} !important; }\n`;

  // CTA section — light gradient instead of dark
  css += `    .cta-section, [class*="cta"] { }\n`; // handled by color replacement

  // Tool cards
  css += `    .tool-card { background: ${v.surface} !important; border-color: ${v.border} !important; }\n`;
  css += `    .tool-card:hover { border-color: ${accent} !important; }\n`;

  // Product page specific — comparison table keeps dark header
  css += `    .compare-table thead { background: ${v.text} !important; }\n`;
  css += `    .compare-table th { color: ${v.bg} !important; }\n`;
  css += `    .compare-table tfoot { background: ${v.text} !important; }\n`;
  css += `    .compare-table tfoot td { color: ${v.bg} !important; }\n`;
  css += `    .compare-table tfoot .price-free { color: #22c55e !important; }\n`;

  // Product page CTA section
  css += `    .cta-section { background: linear-gradient(180deg, ${v.surfaceHover} 0%, ${v.bg} 100%) !important; }\n`;
  css += `    .cta-free { color: ${v.text} !important; }\n`;
  css += `    .cta-sub { color: ${v.muted} !important; }\n`;

  // Footer
  css += `    .footer-nav { background: ${v.surface} !important; }\n`;

  return css;
}

// ── Brutalist CSS ────────────────────────────────

function generateBrutalistCSS(config) {
  const v = config.vars;
  let css = '\n    /* ── Brutalist Overrides ── */\n';
  css += '    *, *::before, *::after { border-radius: 0 !important; }\n';
  css += `    .tool-card, .pricing-card, .feature-card, .usecase-card, .include-item, .stat-card, .compare-wrap { box-shadow: none !important; border: 2px solid ${v.border} !important; }\n`;
  css += '    .tool-card:hover, .feature-card:hover, .usecase-card:hover { transform: none !important; }\n';
  css += '    .btn, .btn-gold, .btn-outline, .btn-blue, .cta-btn { border-radius: 0 !important; }\n';
  css += '    .hero-grid { display: none !important; }\n'; // No decorative grid
  css += '    .hero-bg::before, .hero-bg::after { display: none !important; }\n'; // No glow effects
  css += '    @keyframes pulse-glow { 0%, 100% { opacity: 0; } }\n'; // Kill animations
  return css;
}

// ── Hardcoded Color Replacement ──────────────────
// Replaces AppBuster's hardcoded hex and rgba colors with brand equivalents

function replaceHardcodedColors(html, config) {
  const v = config.vars;
  const accentHex = v.gold;
  const accentRgb = hexToRgb(accentHex);
  const accentHover = lightenHex(accentHex, 0.2);
  const accentDark = darkenHex(accentHex, 0.2);
  const bgRgb = hexToRgb(v.bg);
  const blueRgb = hexToRgb(v.blue);
  const accentOnBg = config.accentOnBg || '#000';

  // --- Gold accent (#ffd700 → brand accent) ---
  html = html.replace(/#ffd700/gi, accentHex);
  html = html.replace(/#ffe44d/gi, accentHover);
  html = html.replace(/#ccab00/gi, accentDark);
  html = html.replace(/#b8960a/gi, accentDark);

  // Gold rgba — match rgba(255, 215, 0, X) with varying whitespace
  html = html.replace(
    /rgba\(\s*255\s*,\s*215\s*,\s*0\s*,\s*([\d.]+)\s*\)/g,
    `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, $1)`
  );

  // --- Blue accent (#3b82f6 → brand blue) ---
  html = html.replace(/#3b82f6/gi, v.blue);
  html = html.replace(/#5b9bf7/gi, lightenHex(v.blue, 0.25));

  // Blue rgba
  html = html.replace(
    /rgba\(\s*59\s*,\s*130\s*,\s*246\s*,\s*([\d.]+)\s*\)/g,
    `rgba(${blueRgb.r}, ${blueRgb.g}, ${blueRgb.b}, $1)`
  );

  // --- Structural dark colors ---
  html = html.replace(/#09090b/gi, v.bg);
  html = html.replace(/#111113/gi, v.bg);
  html = html.replace(/#18181b/gi, v.surface);
  html = html.replace(/#1a1a1e/gi, v.surface);
  html = html.replace(/#27272a/gi, v.border);

  // Nav glass rgba(9, 9, 11, X) → rgba(bgR, bgG, bgB, X)
  html = html.replace(
    /rgba\(\s*9\s*,\s*9\s*,\s*11\s*,\s*([\d.]+)\s*\)/g,
    `rgba(${bgRgb.r}, ${bgRgb.g}, ${bgRgb.b}, $1)`
  );

  // --- Text colors ---
  html = html.replace(/#fafafa/gi, v.text);
  html = html.replace(/#a1a1aa/gi, v.muted);

  // --- Light theme: flip hero grid lines ---
  if (!config.isDark) {
    html = html.replace(
      /rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.015\s*\)/g,
      'rgba(0, 0, 0, 0.03)'
    );
  }

  // --- Button text-on-accent: replace dark text on gold buttons ---
  // .btn-gold { color: #09090b } was already replaced above, but for light brands
  // where the accent needs dark text instead of dark-bg text, fix it
  if (accentOnBg !== '#000' && accentOnBg !== v.bg) {
    // The btn-gold color was replaced with brand bg, but we want accentOnBg
    html = html.replace(
      /\.btn-gold\s*\{([^}]*?)color:\s*[^;]+;/g,
      `.btn-gold {$1color: ${accentOnBg};`
    );
  }

  return html;
}

// ── Product HTML Generators (from build-products.js) ──

function generateFeaturesHTML(features) {
  return features.map(f => `        <div class="feature-card">
          <div class="feature-icon">${f.icon}</div>
          <div class="feature-title">${f.title}</div>
          <div class="feature-desc">${f.desc}</div>
        </div>`).join('\n');
}

function generateIncludesHTML(includes) {
  return includes.map(item =>
    `        <div class="include-item"><span class="check-icon">&#10003;</span> ${item}</div>`
  ).join('\n');
}

function generateComparisonRowsHTML(rows) {
  return rows.map(r => {
    const themCell = r.themType === 'check'
      ? '<td class="check">&#10003;</td>'
      : r.themType === 'paid'
        ? `<td class="paid">${r.them}</td>`
        : `<td class="cross">${r.them}</td>`;
    const usCell = r.usType === 'cross'
      ? '<td class="cross">&#10007;</td>'
      : '<td class="check">&#10003;</td>';
    const agenticCell = r.agenticType === 'cross'
      ? '<td class="cross">&#10007;</td>'
      : '<td class="check">&#10003;</td>';
    return `            <tr><td>${r.feature}</td>${themCell}${usCell}${agenticCell}</tr>`;
  }).join('\n');
}

// ── Main Build ───────────────────────────────────

function build() {
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║   build-brands.js — Multi-Brand Generator ║');
  console.log('╚═══════════════════════════════════════════╝\n');

  // Read templates
  const homepageTpl = fs.readFileSync(path.join(TEMPLATES_DIR, 'homepage.html.tpl'), 'utf8');
  const productTpl = fs.readFileSync(path.join(TEMPLATES_DIR, 'product-page.html.tpl'), 'utf8');
  const signupTpl = fs.readFileSync(path.join(TEMPLATES_DIR, 'signup.html.tpl'), 'utf8');

  // Read product JSONs
  const productFiles = fs.readdirSync(PRODUCTS_DIR).filter(f => f.endsWith('.json'));
  const products = productFiles.map(f =>
    JSON.parse(fs.readFileSync(path.join(PRODUCTS_DIR, f), 'utf8'))
  );

  // Discover brands (skip appbuster — it's the root site)
  const brandSlugs = fs.readdirSync(BRANDS_DIR)
    .filter(d => {
      if (d === 'appbuster') return false;
      const dir = path.join(BRANDS_DIR, d);
      return fs.statSync(dir).isDirectory()
        && fs.existsSync(path.join(dir, 'appbuster-vars.json'))
        && fs.existsSync(path.join(dir, 'brand.json'));
    })
    .sort();

  console.log(`Templates: 3 (homepage, product-page, signup)`);
  console.log(`Products:  ${products.length}`);
  console.log(`Brands:    ${brandSlugs.length} → ${brandSlugs.join(', ')}\n`);

  let totalFiles = 0;
  const errors = [];

  for (const slug of brandSlugs) {
    const brandDir = path.join(BRANDS_DIR, slug);
    const brand = JSON.parse(fs.readFileSync(path.join(brandDir, 'brand.json'), 'utf8'));
    const config = JSON.parse(fs.readFileSync(path.join(brandDir, 'appbuster-vars.json'), 'utf8'));

    // Load optional extra.css file
    const extraCSSPath = path.join(brandDir, 'extra.css');
    if (fs.existsSync(extraCSSPath)) {
      config._extraCSSFile = fs.readFileSync(extraCSSPath, 'utf8');
    }

    const outDir = path.join(PUBLIC_DIR, slug);
    fs.mkdirSync(outDir, { recursive: true });

    const fontLinks = generateFontLinks(brand);
    const brandOverrides = generateBrandOverrides(config);
    const brandName = brand.name;
    const brandNameHtml = config.brandNameHtml;
    const baseUrl = brand.baseUrl;

    const themeTag = config.isDark ? 'DARK' : 'LIGHT';
    const extras = [];
    if (config.brutalist) extras.push('brutalist');
    if (config.headingFont) extras.push('display-font');
    const extraTag = extras.length ? ` (${extras.join(', ')})` : '';

    console.log(`── ${brandName} [${themeTag}${extraTag}] ──`);

    try {
      // 1. Homepage
      let homepage = homepageTpl
        .replace(/\{\{FONT_LINKS\}\}/g, fontLinks)
        .replace(/\{\{BRAND_OVERRIDES\}\}/g, brandOverrides)
        .replace(/\{\{BRAND_NAME\}\}/g, brandName)
        .replace(/\{\{BRAND_NAME_HTML\}\}/g, brandNameHtml)
        .replace(/\{\{BASE_URL\}\}/g, baseUrl);
      homepage = replaceHardcodedColors(homepage, config);
      fs.writeFileSync(path.join(outDir, 'index.html'), homepage, 'utf8');
      totalFiles++;

      // 2. Product pages
      for (const product of products) {
        const title = `${product.name} — Free ${product.category} | ${brandName}`;
        const featuresHTML = generateFeaturesHTML(product.features);
        const includesHTML = generateIncludesHTML(product.includes);
        const comparisonRowsHTML = generateComparisonRowsHTML(product.comparison.rows);

        let page = productTpl
          .replace(/\{\{FONT_LINKS\}\}/g, fontLinks)
          .replace(/\{\{BRAND_OVERRIDES\}\}/g, brandOverrides)
          .replace(/\{\{BRAND_NAME\}\}/g, brandName)
          .replace(/\{\{BRAND_NAME_HTML\}\}/g, brandNameHtml)
          .replace(/\{\{BASE_URL\}\}/g, baseUrl)
          .replace(/\{\{TITLE\}\}/g, title)
          .replace(/\{\{META_DESCRIPTION\}\}/g, product.metaDescription)
          .replace(/\{\{CATEGORY\}\}/g, product.category)
          .replace(/\{\{HERO_SVG\}\}/g, product.heroSvg)
          .replace(/\{\{PRODUCT_NAME\}\}/g, product.name)
          .replace(/\{\{TAGLINE\}\}/g, product.tagline)
          .replace(/\{\{COMPETITOR_PRICE\}\}/g, product.competitorPrice)
          .replace(/\{\{ANNUAL_SAVINGS\}\}/g, product.annualSavings)
          .replace(/\{\{FEATURES_HTML\}\}/g, featuresHTML)
          .replace(/\{\{INCLUDES_HTML\}\}/g, includesHTML)
          .replace(/\{\{COMPETITOR_NAME\}\}/g, product.competitor)
          .replace(/\{\{COMPARISON_ROWS\}\}/g, comparisonRowsHTML)
          .replace(/\{\{SLUG\}\}/g, product.slug);
        page = replaceHardcodedColors(page, config);
        fs.writeFileSync(path.join(outDir, `${product.slug}.html`), page, 'utf8');
        totalFiles++;
      }

      // 3. Signup page
      let signup = signupTpl
        .replace(/\{\{FONT_LINKS\}\}/g, fontLinks)
        .replace(/\{\{BRAND_OVERRIDES\}\}/g, brandOverrides)
        .replace(/\{\{BRAND_NAME\}\}/g, brandName)
        .replace(/\{\{BRAND_NAME_HTML\}\}/g, brandNameHtml)
        .replace(/\{\{BASE_URL\}\}/g, baseUrl);
      signup = replaceHardcodedColors(signup, config);
      fs.writeFileSync(path.join(outDir, 'signup.html'), signup, 'utf8');
      totalFiles++;

      console.log(`   ✓ index.html + ${products.length} products + signup.html`);

    } catch (err) {
      console.error(`   ✗ ERROR: ${err.message}`);
      errors.push({ brand: slug, error: err.message });
    }

    console.log('');
  }

  // Summary
  console.log('═══════════════════════════════════════════');
  console.log(`Generated: ${totalFiles} files across ${brandSlugs.length} brands`);
  if (errors.length) {
    console.log(`\nErrors (${errors.length}):`);
    errors.forEach(e => console.log(`  - ${e.brand}: ${e.error}`));
  } else {
    console.log('Status: All builds successful ✓');
  }
  console.log('');
}

build();
