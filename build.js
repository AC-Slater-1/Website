const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const BRANDS_DIR = path.join(ROOT, 'brands');
const PRODUCTS_DIR = path.join(ROOT, 'products');
const TEMPLATES_DIR = path.join(ROOT, 'templates');
const PUBLIC_DIR = path.join(ROOT, 'public');

// Hardcoded favicon — same gold AB computer icon used across all pages
const FAVICON = `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3ClinearGradient id='b' x1='0' y1='0' x2='0' y2='1'%3E%3Cstop offset='0%25' stop-color='%23ffe44d'/%3E%3Cstop offset='50%25' stop-color='%23ffd700'/%3E%3Cstop offset='100%25' stop-color='%23ccab00'/%3E%3C/linearGradient%3E%3ClinearGradient id='l' x1='0' y1='0' x2='0' y2='1'%3E%3Cstop offset='0%25' stop-color='%231a3a8a'/%3E%3Cstop offset='100%25' stop-color='%230f2460'/%3E%3C/linearGradient%3E%3ClinearGradient id='s' x1='0' y1='0' x2='1' y2='0'%3E%3Cstop offset='0%25' stop-color='%23c0c0c0'/%3E%3Cstop offset='50%25' stop-color='%23e8e8e8'/%3E%3Cstop offset='100%25' stop-color='%23a0a0a0'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect x='5' y='5' width='90' height='90' rx='4' fill='url(%23b)' stroke='%23b8960a' stroke-width='1.5'/%3E%3Crect x='28' y='5' width='44' height='28' rx='2' fill='url(%23s)' stroke='%23888' stroke-width='.8'/%3E%3Crect x='36' y='8' width='20' height='22' rx='1' fill='%23333'/%3E%3Crect x='12' y='36' width='76' height='46' rx='2' fill='url(%23l)' stroke='%230a1a4a' stroke-width='.8'/%3E%3Ctext x='50' y='58' text-anchor='middle' font-family='Arial Black,Impact,sans-serif' font-size='16' font-weight='900' fill='%23ffd700'%3EAB%3C/text%3E%3Crect x='9' y='86' width='8' height='6' rx='1.5' fill='%23b8960a' stroke='%23a07800' stroke-width='.5'/%3E%3Ccircle cx='50' cy='90' r='3' fill='none' stroke='%23b8960a' stroke-width='.8'/%3E%3Ccircle cx='50' cy='90' r='1' fill='%23b8960a'/%3E%3C/svg%3E">`;

// --- HTML generators ---

function generateBadges(badges, baseUrl) {
  return badges.map(b => {
    const cls = b === 'FREE' ? 'badge-free' : b === 'HOT' ? 'badge-hot' : 'badge-free';
    if (b === 'FREE') {
      return `<a href="${baseUrl}/signup.html" class="badge ${cls}" style="text-decoration:none;color:inherit">${b}</a>`;
    }
    return `<span class="badge ${cls}">${b}</span>`;
  }).join('\n    ');
}

function generateFeatures(features) {
  return features.map(f => {
    return `<div class="feature-card">
        <div class="f-icon">${f.icon}</div>
        <div><div class="f-title">${f.title}</div><div class="f-desc">${f.desc}</div></div>
      </div>`;
  }).join('\n      ');
}

function generateComparisonHeaders(headers) {
  return `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
}

function generateComparisonRows(rows) {
  return rows.map(r => {
    // "us" column: always a green checkmark
    const usCell = `<td class="check">&#x2714;</td>`;
    // "them" column: depends on themType
    let themCell;
    if (r.themType === 'check') {
      themCell = `<td class="check">&#x2714;</td>`;
    } else if (r.themType === 'paid') {
      themCell = `<td class="paid">${r.them}</td>`;
    } else {
      // cross — limited text in red
      themCell = `<td class="cross">${r.them}</td>`;
    }
    return `<tr><td>${r.feature}</td>${usCell}${themCell}</tr>`;
  }).join('\n          ');
}

function generateComparisonFooter(footer) {
  return `<tr><td>Monthly Price</td><td class="price-free">${footer.ourPrice}</td><td class="price-paid">${footer.theirPrice}</td></tr>`;
}

function generateIncludes(includes) {
  return includes.map(item => `<div class="item">${item}</div>`).join('\n      ');
}

function generateUseCases(useCases) {
  return useCases.map(uc => {
    return `<div class="usecase-card">
        <div class="uc-icon">${uc.icon}</div>
        <div class="uc-title">${uc.title}</div>
        <div class="uc-desc">${uc.desc}</div>
      </div>`;
  }).join('\n      ');
}

// --- Main build ---

function build() {
  const template = fs.readFileSync(path.join(TEMPLATES_DIR, 'app.html.tpl'), 'utf8');

  // Read all product JSON files
  const productFiles = fs.readdirSync(PRODUCTS_DIR).filter(f => f.endsWith('.json'));
  const products = productFiles.map(f => {
    return JSON.parse(fs.readFileSync(path.join(PRODUCTS_DIR, f), 'utf8'));
  });

  // Read all brand directories
  const brandDirs = fs.readdirSync(BRANDS_DIR).filter(d => {
    return fs.statSync(path.join(BRANDS_DIR, d)).isDirectory();
  });

  // Skip appbuster — root site stays manual
  const brandsToProcess = brandDirs.filter(d => d !== 'appbuster');

  for (const brandSlug of brandsToProcess) {
    const brandDir = path.join(BRANDS_DIR, brandSlug);
    const brand = JSON.parse(fs.readFileSync(path.join(brandDir, 'brand.json'), 'utf8'));
    const themeCSS = fs.readFileSync(path.join(brandDir, 'theme.css'), 'utf8');

    console.log(`Building brand: ${brandSlug}`);

    // Ensure output directory
    const outDir = path.join(PUBLIC_DIR, brand.slug, 'apps');
    fs.mkdirSync(outDir, { recursive: true });

    let pageCount = 0;

    for (const product of products) {
      let html = template;

      // Font links
      const fontLinks = `<link href="${brand.fonts}" rel="stylesheet">`;

      // Meta
      const metaTitle = `${product.name} - Free ${product.category} | ${brand.name}`;
      const metaDesc = `${product.name}: ${product.tagline} Save ${product.annualSavings}.`;
      const metaOgTitle = metaTitle;
      const metaOgDesc = `Free ${product.category}. Save ${product.annualSavings} vs ${product.competitor}.`;

      // Nav
      const baseUrl = brand.baseUrl;
      let prevHTML = '';
      let nextHTML = '';
      const hasPrev = product.nav && product.nav.prev;
      const hasNext = product.nav && product.nav.next;

      if (hasPrev) {
        prevHTML = `<a href="${baseUrl}/apps/${product.nav.prev.slug}.html">&larr; Prev: ${product.nav.prev.name}</a>\n  <span class="sep">|</span>\n  `;
      }
      if (hasNext) {
        nextHTML = `\n  <span class="sep">|</span>\n  <a href="${baseUrl}/apps/${product.nav.next.slug}.html">Next: ${product.nav.next.name} &rarr;</a>`;
      }

      // Replace all slots
      html = html
        .replace(/\{\{meta\.title\}\}/g, metaTitle)
        .replace(/\{\{meta\.description\}\}/g, metaDesc)
        .replace(/\{\{meta\.ogTitle\}\}/g, metaOgTitle)
        .replace(/\{\{meta\.ogDescription\}\}/g, metaOgDesc)
        .replace(/\{\{brand\.favicon\}\}/g, FAVICON)
        .replace(/\{\{brand\.fonts\}\}/g, fontLinks)
        .replace(/\{\{brand\.themeCSS\}\}/g, themeCSS)
        .replace(/\{\{brand\.baseUrl\}\}/g, baseUrl)
        .replace(/\{\{brand\.name\}\}/g, brand.name)
        .replace(/\{\{product\.heroSvg\}\}/g, product.heroSvg)
        .replace(/\{\{product\.category\}\}/g, product.category)
        .replace(/\{\{product\.name\}\}/g, product.name)
        .replace(/\{\{product\.tagline\}\}/g, product.tagline)
        .replace(/\{\{product\.badges\}\}/g, generateBadges(product.badges, baseUrl))
        .replace(/\{\{product\.competitor\}\}/g, product.competitor)
        .replace(/\{\{product\.competitorPrice\}\}/g, product.competitorPrice)
        .replace(/\{\{product\.featuresHTML\}\}/g, generateFeatures(product.features))
        .replace(/\{\{product\.comparisonHeaders\}\}/g, generateComparisonHeaders(product.comparison.headers))
        .replace(/\{\{product\.comparisonRows\}\}/g, generateComparisonRows(product.comparison.rows))
        .replace(/\{\{product\.comparisonFooter\}\}/g, generateComparisonFooter(product.comparison.footer))
        .replace(/\{\{product\.includesHTML\}\}/g, generateIncludes(product.includes))
        .replace(/\{\{product\.useCasesHTML\}\}/g, generateUseCases(product.useCases))
        .replace(/\{\{product\.annualSavings\}\}/g, product.annualSavings)
        .replace(/\{\{nav\.prevHTML\}\}/g, prevHTML)
        .replace(/\{\{nav\.nextHTML\}\}/g, nextHTML);

      const outFile = path.join(outDir, `${product.slug}.html`);
      fs.writeFileSync(outFile, html, 'utf8');
      const relPath = path.relative(ROOT, outFile);
      console.log(`  → ${relPath}`);
      pageCount++;
    }

    console.log(`Done! Built ${pageCount} page${pageCount !== 1 ? 's' : ''} for ${brandSlug}`);
  }
}

build();
