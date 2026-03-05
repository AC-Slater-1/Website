<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{meta.title}}</title>
<meta name="description" content="{{meta.description}}">
<meta property="og:title" content="{{meta.ogTitle}}">
<meta property="og:description" content="{{meta.ogDescription}}">
<meta property="og:type" content="website">
{{brand.favicon}}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
{{brand.fonts}}
<style>
{{brand.themeCSS}}
</style>
</head>
<body>

<!-- TOP NAV -->
<nav class="top-nav">
  <a href="{{brand.baseUrl}}/">&#x2190; Back to All Apps</a>
  <span class="brand">{{brand.name}}</span>
</nav>

<!-- HERO -->
<div class="product-hero">
  <div class="hero-icon">
    {{product.heroSvg}}
  </div>
  <div class="hero-cat">{{product.category}}</div>
  <h1 class="hero-title">{{product.name}}</h1>
  <p class="hero-tagline">{{product.tagline}}</p>
  <div class="hero-rating">
    <span class="star">&#x2605;</span><span class="star">&#x2605;</span><span class="star">&#x2605;</span><span class="star">&#x2605;</span><span class="star">&#x2605;</span>
  </div>
  <div class="hero-badges">
    {{product.badges}}
  </div>
  <p class="hero-vs">Replaces <span class="competitor">{{product.competitor}} ({{product.competitorPrice}})</span></p>
</div>

<!-- CONTENT -->
<div class="page-content">

  <!-- FEATURES -->
  <section class="section">
    <div class="section-header"><span class="icon">&#x2699;</span><h2>Features</h2></div>
    <div class="features-grid">
      {{product.featuresHTML}}
    </div>
  </section>

  <!-- COMPARISON TABLE -->
  <section class="section">
    <div class="section-header"><span class="icon">&#x2696;</span><h2>{{product.name}} vs {{product.competitor}}</h2></div>
    <div class="compare-wrap">
      <table class="compare-table">
        <thead>
          {{product.comparisonHeaders}}
        </thead>
        <tbody>
          {{product.comparisonRows}}
        </tbody>
        <tfoot>
          {{product.comparisonFooter}}
        </tfoot>
      </table>
    </div>
  </section>

  <!-- WHAT'S INCLUDED -->
  <section class="section">
    <div class="section-header"><span class="icon">&#x1F4E6;</span><h2>What's Included</h2></div>
    <div class="includes-grid">
      {{product.includesHTML}}
    </div>
  </section>

  <!-- USE CASES -->
  <section class="section">
    <div class="section-header"><span class="icon">&#x1F465;</span><h2>Perfect For</h2></div>
    <div class="usecases-grid">
      {{product.useCasesHTML}}
    </div>
  </section>

</div>

<!-- CTA -->
<section class="cta-section">
  <div class="cta-savings">You save {{product.annualSavings}}</div>
  <div class="cta-price-row">
    <span class="cta-their">{{product.competitorPrice}}</span>
    <span class="cta-arrow">&#x27A1;</span>
    <a href="{{brand.baseUrl}}/signup.html" class="cta-free" style="text-decoration:none;color:inherit">FREE</a>
  </div>
  <p class="cta-sub">Same features. Same power. $0.00/month.</p>
  <a href="{{brand.baseUrl}}/signup.html" class="cta-btn">Get Started &#x2192;</a>
</section>

<!-- FOOTER NAV -->
<div class="footer-nav">
  {{nav.prevHTML}}
  <a href="{{brand.baseUrl}}/">All Apps</a>
  {{nav.nextHTML}}
</div>

<script src="/ab-tracker.js"></script>
<script src="/ab-pixels.js" defer></script>
<script>
// Track CTA button clicks
document.addEventListener('click', function(e) {
  var link = e.target.closest('a.btn, a.cta-btn');
  if (!link || !window.ABTrack) return;
  var label = link.textContent.trim();
  if (label) ABTrack.event('cta_click', { cta_label: label, href: link.getAttribute('href') });
});
</script>
<script src="/kevin-widget.js"></script>
</body>
</html>
