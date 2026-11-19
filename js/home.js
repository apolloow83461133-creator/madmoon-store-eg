// منطق الصفحة الرئيسية للمتجر

document.addEventListener('DOMContentLoaded', () => {
  const { escapeHtml, formatEGP, addToCart, applyBrandToDom } = window.StoreEngine;
  window.CartUI.init();
  applyBrandToDom();

  const coreProducts = window.PRODUCTS.filter((p) => p.isCore);
  const upsellProducts = window.PRODUCTS.filter((p) => p.isUpsell);

  let activeCat = 'all';
  let searchQuery = '';

  const gridEl = document.getElementById('productsGrid');
  const upsellEl = document.getElementById('upsellGrid');
  const searchInput = document.getElementById('catalogSearch');

  function renderProducts() {
    const filtered = coreProducts.filter((p) => {
      const catMatch = activeCat === 'all' || p.category === activeCat;
      const q = searchQuery.trim();
      const textMatch =
        !q ||
        p.name.includes(q) ||
        p.tagline.includes(q) ||
        p.categoryLabel.includes(q);
      return catMatch && textMatch;
    });

    if (!filtered.length) {
      gridEl.innerHTML = `<div class="info-panel" style="grid-column:1/-1;text-align:center;">لا توجد منتجات مطابقة لبحثك. جرّب اختيار «الكل».</div>`;
      return;
    }

    gridEl.innerHTML = filtered
      .map((p) => {
        const discountPct = Math.round(
          ((p.compareAtPrice - p.price) / p.compareAtPrice) * 100
        );
        const doubleBundle = p.bundles.find((b) => b.id === 'double');
        return `
          <article class="product-card">
            <a href="product.html?id=${encodeURIComponent(p.id)}" class="product-media">
              <img src="${escapeHtml(p.images[0])}" alt="${escapeHtml(p.name)}" loading="lazy" />
              <span class="product-badge ${p.badgeType === 'hot' ? 'hot' : ''}">${escapeHtml(p.badge)}</span>
              <span class="product-save">وفر ${discountPct}%</span>
            </a>
            <div class="product-body">
              <span class="product-cat">${escapeHtml(p.categoryLabel)}</span>
              <h3 class="product-title">
                <a href="product.html?id=${encodeURIComponent(p.id)}">${escapeHtml(p.name)}</a>
              </h3>
              <p class="product-tagline">${escapeHtml(p.tagline)}</p>
              <div class="product-meta">
                <span class="rating-stars">★ ${p.rating} (${p.reviewsCount})</span>
                <span>ضمان استبدال 14 يوم</span>
              </div>
              <div class="price-row">
                <span class="price-now">${formatEGP(p.price)}</span>
                <span class="price-old">${formatEGP(p.compareAtPrice)}</span>
              </div>
              ${
                doubleBundle
                  ? `<div class="bundle-hint">${escapeHtml(doubleBundle.label)}: ${formatEGP(doubleBundle.sellPrice)} (${escapeHtml(doubleBundle.tag)})</div>`
                  : ''
              }
              <div class="card-actions">
                <a href="product.html?id=${encodeURIComponent(p.id)}" class="btn btn-primary">اطلب الآن / التفاصيل</a>
                <button type="button" class="btn btn-outline" data-add-core="${escapeHtml(p.id)}" title="أضف للسلة">🛒</button>
              </div>
            </div>
          </article>
        `;
      })
      .join('');
  }

  function renderUpsells() {
    if (!upsellEl) return;
    upsellEl.innerHTML = upsellProducts
      .map(
        (u) => `
      <div class="upsell-card">
        <a href="product.html?id=${encodeURIComponent(u.id)}">
          <img src="${escapeHtml(u.images[0])}" alt="${escapeHtml(u.name)}" loading="lazy" />
        </a>
        <div style="flex:1;min-width:0;">
          <h4><a href="product.html?id=${encodeURIComponent(u.id)}">${escapeHtml(u.name)}</a></h4>
          <div style="font-size:0.82rem;color:var(--ink-muted);margin-bottom:0.4rem;">
            مع أي طلب: <strong style="color:var(--primary-dark);">${formatEGP(u.upsellPrice)}</strong>
            <span style="text-decoration:line-through;color:var(--ink-light);font-size:0.78rem;">${formatEGP(u.price)}</span>
          </div>
          <div style="display:flex;gap:0.45rem;flex-wrap:wrap;">
            <button type="button" class="btn btn-accent btn-sm" data-add-core="${escapeHtml(u.id)}">+ أضف للطلب</button>
            <a href="product.html?id=${encodeURIComponent(u.id)}" class="btn btn-outline btn-sm">التفاصيل</a>
          </div>
        </div>
      </div>
    `
      )
      .join('');
  }

  document.querySelectorAll('.cat-pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cat-pill').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeCat = btn.dataset.cat;
      renderProducts();
    });
  });

  searchInput?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderProducts();
  });

  document.addEventListener('click', (e) => {
    const addBtn = e.target.closest('[data-add-core]');
    if (addBtn) {
      addToCart(addBtn.dataset.addCore, 'single', 1);
      window.CartUI.openCart();
    }
  });

  renderProducts();
  renderUpsells();
});
