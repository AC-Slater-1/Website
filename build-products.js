const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const TEMPLATE_PATH = path.join(ROOT, 'templates', 'product-page.html.tpl');
const PRODUCTS_DIR = path.join(ROOT, 'products', 'appbuster');
const PUBLIC_DIR = path.join(ROOT, 'public');

// --- HTML generators (4-column comparison table) ---

function generateFeaturesHTML(features) {
  return features.map(f => {
    return `        <div class="feature-card">
          <div class="feature-icon">${f.icon}</div>
          <div class="feature-title">${f.title}</div>
          <div class="feature-desc">${f.desc}</div>
        </div>`;
  }).join('\n');
}

function generateIncludesHTML(includes) {
  return includes.map(item => {
    return `        <div class="include-item"><span class="check-icon">&#10003;</span> ${item}</div>`;
  }).join('\n');
}

function generateComparisonRowsHTML(rows) {
  return rows.map(r => {
    // Column 1: Feature name
    // Column 2: Competitor (them)
    let themCell;
    if (r.themType === 'check') {
      themCell = '<td class="check">&#10003;</td>';
    } else if (r.themType === 'paid') {
      themCell = `<td class="paid">${r.them}</td>`;
    } else {
      themCell = `<td class="cross">${r.them}</td>`;
    }
    // Column 3: Our product (always check unless specified)
    let usCell;
    if (r.usType === 'cross') {
      usCell = '<td class="cross">&#10007;</td>';
    } else {
      usCell = '<td class="check">&#10003;</td>';
    }
    // Column 4: Agentic (always check unless specified)
    let agenticCell;
    if (r.agenticType === 'cross') {
      agenticCell = '<td class="cross">&#10007;</td>';
    } else {
      agenticCell = '<td class="check">&#10003;</td>';
    }
    return `            <tr><td>${r.feature}</td>${themCell}${usCell}${agenticCell}</tr>`;
  }).join('\n');
}

// --- Main build ---

function build() {
  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');

  const productFiles = fs.readdirSync(PRODUCTS_DIR).filter(f => f.endsWith('.json'));

  if (productFiles.length === 0) {
    console.log('No product JSON files found in', PRODUCTS_DIR);
    return;
  }

  console.log(`Found ${productFiles.length} product(s). Building...`);

  let count = 0;

  for (const file of productFiles) {
    const product = JSON.parse(fs.readFileSync(path.join(PRODUCTS_DIR, file), 'utf8'));

    // Generate dynamic HTML sections
    const featuresHTML = generateFeaturesHTML(product.features);
    const includesHTML = generateIncludesHTML(product.includes);
    const comparisonRowsHTML = generateComparisonRowsHTML(product.comparison.rows);

    // Build title
    const title = `${product.name} — Free ${product.category} | AppBuster`;

    // Replace all tokens
    let html = template
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

    const outFile = path.join(PUBLIC_DIR, `${product.slug}.html`);
    fs.writeFileSync(outFile, html, 'utf8');
    console.log(`  -> ${product.slug}.html (${product.name})`);
    count++;
  }

  console.log(`\nDone! Built ${count} product page(s).`);
}

build();
