// منطق صفحة المنتج وصفحة الهبوط المباشرة

document.addEventListener('DOMContentLoaded', () => {
  const {
    escapeHtml,
    formatEGP,
    getProductById,
    getGovernorateInfo,
    addToCart,
    createOrder,
    buildWhatsAppOrderUrl,
    applyBrandToDom,
  } = window.StoreEngine;

  window.CartUI.init();
  applyBrandToDom();

  const params = new URLSearchParams(window.location.search);
  const product = getProductById(params.get('id')) || window.PRODUCTS[0];
  document.title = `${product.name} | متجر مضمون`;

  // Populate breadcrumbs & hero text
  document.getElementById('crumbCat').textContent = product.categoryLabel;
  document.getElementById('crumbName').textContent = product.name;
  document.getElementById('prodCat').textContent = product.categoryLabel;
  document.getElementById('prodTitle').textContent = product.name;
  document.getElementById('prodTagline').textContent = product.tagline;
  document.getElementById('prodRating').textContent = `★ ${product.rating} (${product.reviewsCount} تقييم موثق)`;
  document.getElementById('prodUsage').textContent = product.usage;

  const highlightsEl = document.getElementById('prodHighlights');
  highlightsEl.innerHTML = product.highlights
    .map((h) => `<li><span style="color:var(--primary);font-weight:800;">✓</span><span>${escapeHtml(h)}</span></li>`)
    .join('');

  // Gallery
  const mainImg = document.getElementById('galleryMainImg');
  const thumbsEl = document.getElementById('galleryThumbs');
  mainImg.src = product.images[0];
  mainImg.alt = product.name;

  thumbsEl.innerHTML = product.images
    .map(
      (img, i) => `
      <button type="button" class="gallery-thumb ${i === 0 ? 'active' : ''}" data-img="${escapeHtml(img)}">
        <img src="${escapeHtml(img)}" alt="${escapeHtml(product.name)} ${i + 1}" />
      </button>
    `
    )
    .join('');

  thumbsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.gallery-thumb');
    if (!btn) return;
    thumbsEl.querySelectorAll('.gallery-thumb').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    mainImg.src = btn.dataset.img;
  });

  // Bundles
  let selectedBundleId = product.bundles.length > 1 ? product.bundles[1].id : product.bundles[0].id;
  // افتراضياً نختار الباقة الأولى أو لو متاح قطعتين نعرضها بوضوح مع إتاحة التبديل
  selectedBundleId = product.bundles[0].id;

  const bundleListEl = document.getElementById('bundleOptions');
  const priceDisplayEl = document.getElementById('prodPriceDisplay');
  const compareDisplayEl = document.getElementById('prodCompareDisplay');
  const stickyPriceEl = document.getElementById('stickyMobilePrice');

  function getSelectedBundle() {
    return product.bundles.find((b) => b.id === selectedBundleId) || product.bundles[0];
  }

  function renderBundles() {
    bundleListEl.innerHTML = product.bundles
      .map((b) => {
        const isSel = b.id === selectedBundleId;
        return `
          <label class="bundle-option ${isSel ? 'selected' : ''}">
            <div style="display:flex;align-items:center;gap:0.5rem;">
              <input type="radio" name="bundleChoice" value="${escapeHtml(b.id)}" ${isSel ? 'checked' : ''} />
              <div>
                <strong>${escapeHtml(b.label)}</strong>
                ${b.tag ? `<span class="bundle-tag">${escapeHtml(b.tag)}</span>` : ''}
              </div>
            </div>
            <div style="text-align:left;white-space:nowrap;">
              <strong style="color:var(--primary-dark);font-size:1.05rem;">${formatEGP(b.sellPrice)}</strong>
              <div style="font-size:0.78rem;color:var(--ink-light);text-decoration:line-through;">${formatEGP(b.compareAt)}</div>
            </div>
          </label>
        `;
      })
      .join('');

    const activeB = getSelectedBundle();
    priceDisplayEl.textContent = formatEGP(activeB.sellPrice);
    compareDisplayEl.textContent = formatEGP(activeB.compareAt);
    if (stickyPriceEl) stickyPriceEl.textContent = formatEGP(activeB.sellPrice);
    updateSummary();
  }

  bundleListEl.addEventListener('change', (e) => {
    if (e.target.name === 'bundleChoice') {
      selectedBundleId = e.target.value;
      renderBundles();
    }
  });

  // Cross-Sell Add-ons inside direct COD form
  const upsellOptions = window.PRODUCTS.filter(
    (p) => p.isUpsell && p.id !== product.id
  );
  const selectedUpsells = new Set();
  const upsellBoxEl = document.getElementById('landingUpsellList');

  if (upsellOptions.length) {
    upsellBoxEl.innerHTML = `
      <div style="font-weight:800;font-size:0.86rem;color:#92400e;margin-bottom:0.2rem;">
        أضف منتجاً آخر في نفس الشحنة (بدون أي مصاريف شحن إضافية):
      </div>
      ${upsellOptions
        .map(
          (u) => `
          <label class="upsell-check">
            <div class="upsell-check-left">
              <input type="checkbox" data-upsell-id="${escapeHtml(u.id)}" />
              <img src="${escapeHtml(u.images[0])}" alt="${escapeHtml(u.name)}" />
              <div>
                <div style="font-weight:700;font-size:0.84rem;">${escapeHtml(u.name)}</div>
                <div style="font-size:0.76rem;color:var(--ink-light);">بدلاً من ${formatEGP(u.price)}</div>
              </div>
            </div>
            <strong style="color:var(--primary-dark);white-space:nowrap;">+ ${formatEGP(u.upsellPrice)}</strong>
          </label>
        `
        )
        .join('')}
    `;

    upsellBoxEl.addEventListener('change', (e) => {
      const cb = e.target.closest('[data-upsell-id]');
      if (!cb) return;
      if (cb.checked) selectedUpsells.add(cb.dataset.upsellId);
      else selectedUpsells.delete(cb.dataset.upsellId);
      updateSummary();
    });
  }

  // Governorate select & summary
  const govSelect = document.getElementById('lpGov');
  window.CartUI.renderGovernorateOptions(govSelect);

  function buildCurrentOrderItems() {
    const items = [{ productId: product.id, bundleId: selectedBundleId, qty: 1 }];
    selectedUpsells.forEach((uid) => {
      items.push({ productId: uid, bundleId: 'single', qty: 1 });
    });
    return items;
  }

  function updateSummary() {
    const activeB = getSelectedBundle();
    const govInfo = getGovernorateInfo(govSelect.value);
    let upsellsTotal = 0;
    selectedUpsells.forEach((uid) => {
      const u = getProductById(uid);
      if (u) upsellsTotal += u.upsellPrice || u.price;
    });
    const subtotal = activeB.sellPrice + upsellsTotal;
    const total = subtotal + govInfo.shipping;

    document.getElementById('lpSummary').innerHTML = `
      <div class="summary-line"><span>${escapeHtml(product.name)} (${escapeHtml(activeB.label)}):</span><strong>${formatEGP(activeB.sellPrice)}</strong></div>
      ${
        upsellsTotal > 0
          ? `<div class="summary-line"><span>إضافات التوفير المختارة (${selectedUpsells.size}):</span><strong>${formatEGP(upsellsTotal)}</strong></div>`
          : ''
      }
      <div class="summary-line"><span>الشحن إلى ${escapeHtml(govInfo.name)} (${govInfo.sla}):</span><strong>${formatEGP(govInfo.shipping)}</strong></div>
      <div class="summary-line total"><span>الإجمالي عند الاستلام:</span><span>${formatEGP(total)}</span></div>
    `;
  }

  govSelect.addEventListener('change', updateSummary);

  // Add to Cart button
  document.getElementById('lpAddToCartBtn').addEventListener('click', () => {
    addToCart(product.id, selectedBundleId, 1);
    selectedUpsells.forEach((uid) => addToCart(uid, 'single', 1));
    window.CartUI.openCart();
  });

  // Form submit & Direct WhatsApp submit
  const codForm = document.getElementById('lpCodForm');
  codForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const { valid, values } = window.CartUI.validateForm(codForm);
    if (!valid) {
      codForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const order = createOrder({ ...values, items: buildCurrentOrderItems() });
    codForm.reset();
    selectedUpsells.clear();
    upsellBoxEl.querySelectorAll('input[type="checkbox"]').forEach((c) => (c.checked = false));
    updateSummary();
    window.CartUI.showSuccessModal(order);
  });

  document.getElementById('lpWaSubmitBtn').addEventListener('click', () => {
    const { valid, values } = window.CartUI.validateForm(codForm);
    if (!valid) {
      codForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const order = createOrder({ ...values, items: buildCurrentOrderItems() });
    window.open(buildWhatsAppOrderUrl(order), '_blank', 'noopener');
    window.CartUI.showSuccessModal(order);
  });

  // Related core products
  const relatedEl = document.getElementById('relatedProductsGrid');
  if (relatedEl) {
    const related = window.PRODUCTS.filter((p) => p.isCore && p.id !== product.id).slice(0, 3);
    relatedEl.innerHTML = related
      .map(
        (r) => `
      <article class="product-card">
        <a href="product.html?id=${encodeURIComponent(r.id)}" class="product-media">
          <img src="${escapeHtml(r.images[0])}" alt="${escapeHtml(r.name)}" loading="lazy" />
        </a>
        <div class="product-body">
          <h3 class="product-title"><a href="product.html?id=${encodeURIComponent(r.id)}">${escapeHtml(r.name)}</a></h3>
          <div class="price-row">
            <span class="price-now">${formatEGP(r.price)}</span>
            <span class="price-old">${formatEGP(r.compareAtPrice)}</span>
          </div>
          <a href="product.html?id=${encodeURIComponent(r.id)}" class="btn btn-outline btn-block">عرض المنتج</a>
        </div>
      </article>
    `
      )
      .join('');
  }

  renderBundles();
});
