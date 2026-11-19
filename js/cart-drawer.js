// مكون السلة المشترك ونموذج الدفع عند الاستلام (مشترك بين الصفحة الرئيسية وصفحة المنتج)

window.CartUI = (() => {
  const {
    escapeHtml,
    formatEGP,
    isValidEgyptPhone,
    getGovernorateInfo,
    getCart,
    addToCart,
    updateCartQty,
    clearCart,
    computeCartPricing,
    createOrder,
    buildWhatsAppOrderUrl,
    showToast,
  } = window.StoreEngine;

  function renderGovernorateOptions(selectEl) {
    if (!selectEl) return;
    selectEl.innerHTML = window.EGYPT_GOVERNORATES.map(
      (g) => `<option value="${escapeHtml(g.name)}">${escapeHtml(g.name)} — شحن ${g.shipping} ج.م (${g.sla})</option>`
    ).join('');
  }

  function injectSharedMarkup() {
    if (document.getElementById('cartDrawer')) return;
    const html = `
      <div class="drawer-backdrop" id="cartBackdrop"></div>
      <aside class="cart-drawer" id="cartDrawer" aria-label="سلة المشتريات">
        <div class="drawer-head">
          <h3>سلة مشترياتك (<span id="drawerCount">0</span>)</h3>
          <button class="close-btn" id="closeCartBtn" type="button" aria-label="إغلاق">✕</button>
        </div>
        <div class="drawer-body" id="cartDrawerBody"></div>
        <div class="drawer-foot" id="cartDrawerFoot"></div>
      </aside>

      <div class="modal" id="cartCheckoutModal" aria-hidden="true">
        <div class="modal-card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.85rem;">
            <h2 style="margin:0;font-size:1.25rem;">إتمام الطلب — الدفع عند الاستلام</h2>
            <button class="close-btn" id="closeCheckoutModalBtn" type="button">✕</button>
          </div>
          <form id="drawerCheckoutForm" novalidate>
            <div class="form-grid">
              <div class="form-group">
                <label for="dcName">الاسم بالكامل *</label>
                <input id="dcName" name="customerName" type="text" placeholder="مثال: أحمد محمد علي" required />
                <span class="field-error" data-err="customerName">يرجى كتابة الاسم ثلاثي</span>
              </div>
              <div class="form-group">
                <label for="dcGov">المحافظة *</label>
                <select id="dcGov" name="governorate"></select>
              </div>
              <div class="form-group">
                <label for="dcPhone1">رقم الموبايل الأساسي *</label>
                <input id="dcPhone1" name="phone1" type="tel" inputmode="tel" placeholder="01012345678" required />
                <span class="field-error" data-err="phone1">أدخل رقم موبايل مصري صحيح (11 رقم يبدأ بـ 01)</span>
              </div>
              <div class="form-group">
                <label for="dcPhone2">رقم إضافي (اختياري للتأكيد)</label>
                <input id="dcPhone2" name="phone2" type="tel" inputmode="tel" placeholder="01112345678" />
                <span class="field-error" data-err="phone2">الرقم الإضافي غير صحيح</span>
              </div>
              <div class="form-group full">
                <label for="dcAddress">العنوان بالتفصيل *</label>
                <input id="dcAddress" name="address" type="text" placeholder="المدينة / الحي / الشارع / رقم العمارة والشقة / علامة مميزة" required />
                <span class="field-error" data-err="address">يرجى كتابة العنوان بالتفصيل</span>
              </div>
              <div class="form-group full">
                <label for="dcNotes">ملاحظات للمندوب (اختياري)</label>
                <input id="dcNotes" name="notes" type="text" placeholder="مثال: التواصل بعد الساعة 4 عصراً" />
              </div>
            </div>
            <div class="order-summary-card" id="drawerOrderSummary"></div>
            <div style="display:grid;gap:0.6rem;">
              <button type="submit" class="btn btn-primary btn-lg btn-block">تأكيد الطلب (الدفع عند الاستلام)</button>
              <button type="button" id="drawerWaOrderBtn" class="btn btn-whatsapp btn-block">أو أرسل الطلب عبر واتساب مباشرة</button>
            </div>
          </form>
        </div>
      </div>

      <div class="modal" id="orderSuccessModal" aria-hidden="true">
        <div class="modal-card" style="text-align:center;">
          <div style="width:64px;height:64px;margin:0 auto 0.9rem;border-radius:50%;background:#ecfdf5;color:#065f46;display:grid;place-items:center;font-size:2rem;">✓</div>
          <h2 style="margin:0 0 0.4rem;">تم استلام طلبك بنجاح!</h2>
          <p style="margin:0 0 1rem;color:var(--ink-muted);" id="successOrderMeta"></p>
          <div class="order-summary-card" style="text-align:right;" id="successOrderDetails"></div>
          <div style="background:#fef3c7;color:#92400e;padding:0.75rem 1rem;border-radius:10px;font-size:0.86rem;font-weight:700;margin-bottom:1rem;">
            سيتواصل معك فريق التأكيد خلال 24 ساعة لتأكيد الموعد. الدفع عند الاستلام + ضمان استبدال 14 يوم.
          </div>
          <div style="display:grid;gap:0.6rem;">
            <a id="successWaBtn" target="_blank" rel="noopener" class="btn btn-whatsapp btn-lg btn-block">تأكيد الطلب فوراً عبر واتساب لتسريع الشحن</a>
            <button type="button" id="closeSuccessBtn" class="btn btn-outline btn-block">متابعة التسوق</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    renderGovernorateOptions(document.getElementById('dcGov'));
  }

  function openCart() {
    renderCart();
    document.getElementById('cartBackdrop').classList.add('open');
    document.getElementById('cartDrawer').classList.add('open');
  }

  function closeCart() {
    document.getElementById('cartBackdrop').classList.remove('open');
    document.getElementById('cartDrawer').classList.remove('open');
  }

  function updateBadge() {
    const pricing = computeCartPricing(getCart());
    document.querySelectorAll('[data-cart-count]').forEach((el) => {
      el.textContent = pricing.count;
    });
    const dc = document.getElementById('drawerCount');
    if (dc) dc.textContent = pricing.count;
  }

  function renderCart() {
    updateBadge();
    const body = document.getElementById('cartDrawerBody');
    const foot = document.getElementById('cartDrawerFoot');
    if (!body || !foot) return;

    const rawCart = getCart();
    const pricing = computeCartPricing(rawCart);

    if (pricing.items.length === 0) {
      body.innerHTML = `
        <div style="text-align:center;padding:2.5rem 1rem;">
          <div style="font-size:2.6rem;margin-bottom:0.6rem;">🛒</div>
          <h4 style="margin:0 0 0.4rem;">سلتك فارغة حالياً</h4>
          <p style="margin:0;color:var(--ink-light);font-size:0.9rem;">اختر من عروضنا المميزة واستفد من خصومات الباقات والإضافات الموفرة.</p>
        </div>
      `;
      foot.innerHTML = '';
      return;
    }

    const itemsHtml = pricing.items
      .map((line) => {
        const addonBadge = line.applyCrossSell
          ? `<span style="display:inline-block;background:#fef3c7;color:#b45309;font-size:0.72rem;font-weight:800;padding:0.1rem 0.45rem;border-radius:6px;margin-top:0.2rem;">خصم الإضافة في نفس الشحنة</span>`
          : '';
        return `
          <div class="cart-item">
            <img src="${escapeHtml(line.product.images[0])}" alt="${escapeHtml(line.product.name)}" />
            <div style="flex:1;min-width:0;">
              <div style="font-weight:800;font-size:0.92rem;">${escapeHtml(line.product.name)}</div>
              <div style="font-size:0.78rem;color:var(--ink-light);">${escapeHtml(line.bundle.label)}</div>
              ${addonBadge}
              <div style="display:flex;align-items:center;justify-content:space-between;margin-top:0.45rem;">
                <strong style="color:var(--primary-dark);">${formatEGP(line.lineTotal)}</strong>
                <div class="qty-ctrl">
                  <button type="button" data-qty-delta="-1" data-pid="${escapeHtml(line.product.id)}" data-bid="${escapeHtml(line.bundle.id)}">−</button>
                  <span>${line.qty}</span>
                  <button type="button" data-qty-delta="1" data-pid="${escapeHtml(line.product.id)}" data-bid="${escapeHtml(line.bundle.id)}">+</button>
                </div>
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    // الإضافات التكميلية غير الموجودة في السلة
    const inCartIds = new Set(rawCart.map((c) => c.productId));
    const upsellSuggestions = window.PRODUCTS.filter(
      (p) => p.isUpsell && !inCartIds.has(p.id)
    );

    const upsellHtml = upsellSuggestions.length
      ? `
        <div style="margin-top:1.1rem;background:#fffbeb;border:1px dashed #f59e0b;border-radius:12px;padding:0.85rem;">
          <div style="font-weight:800;font-size:0.86rem;color:#92400e;margin-bottom:0.55rem;">
            أضف مع طلبك بدون شحن إضافي وبسعر خاص:
          </div>
          ${upsellSuggestions
            .map(
              (u) => `
              <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;padding-block:0.4rem;border-top:1px solid rgba(245,158,11,0.2);">
                <div style="display:flex;align-items:center;gap:0.5rem;min-width:0;">
                  <img src="${escapeHtml(u.images[0])}" alt="${escapeHtml(u.name)}" style="width:40px;height:40px;border-radius:8px;object-fit:cover;" />
                  <div style="min-width:0;">
                    <div style="font-size:0.8rem;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(u.name)}</div>
                    <div style="font-size:0.78rem;"><strong style="color:#065f46;">${formatEGP(u.upsellPrice)}</strong> <span style="text-decoration:line-through;color:var(--ink-light);">${formatEGP(u.price)}</span></div>
                  </div>
                </div>
                <button type="button" class="btn btn-accent btn-sm" data-quick-upsell="${escapeHtml(u.id)}">+ أضف</button>
              </div>
            `
            )
            .join('')}
        </div>
      `
      : '';

    body.innerHTML = itemsHtml + upsellHtml;

    foot.innerHTML = `
      <div style="display:flex;justify-content:space-between;font-weight:800;font-size:1.05rem;margin-bottom:0.75rem;">
        <span>إجمالي المنتجات (قبل الشحن):</span>
        <span style="color:var(--primary-dark);">${formatEGP(pricing.subtotal)}</span>
      </div>
      <button type="button" id="openCheckoutModalBtn" class="btn btn-primary btn-lg btn-block">
        أكمل بيانات التوصيل (الدفع عند الاستلام)
      </button>
    `;
  }

  function renderDrawerSummary() {
    const govEl = document.getElementById('dcGov');
    const summaryEl = document.getElementById('drawerOrderSummary');
    if (!govEl || !summaryEl) return;

    const pricing = computeCartPricing(getCart());
    const govInfo = getGovernorateInfo(govEl.value);
    const total = pricing.subtotal + govInfo.shipping;

    summaryEl.innerHTML = `
      <div class="summary-line"><span>إجمالي المنتجات (${pricing.count}):</span><strong>${formatEGP(pricing.subtotal)}</strong></div>
      <div class="summary-line"><span>شحن إلى ${escapeHtml(govInfo.name)} (${govInfo.sla}):</span><strong>${formatEGP(govInfo.shipping)}</strong></div>
      <div class="summary-line total"><span>المطلوب عند الاستلام:</span><span>${formatEGP(total)}</span></div>
    `;
  }

  function validateForm(form) {
    let valid = true;
    const data = new FormData(form);
    const values = Object.fromEntries(data.entries());

    form.querySelectorAll('.field-error').forEach((el) => el.classList.remove('visible'));

    if (!values.customerName || values.customerName.trim().length < 4) {
      form.querySelector('[data-err="customerName"]')?.classList.add('visible');
      valid = false;
    }
    if (!isValidEgyptPhone(values.phone1)) {
      form.querySelector('[data-err="phone1"]')?.classList.add('visible');
      valid = false;
    }
    if (values.phone2 && values.phone2.trim() && !isValidEgyptPhone(values.phone2)) {
      form.querySelector('[data-err="phone2"]')?.classList.add('visible');
      valid = false;
    }
    if (!values.address || values.address.trim().length < 8) {
      form.querySelector('[data-err="address"]')?.classList.add('visible');
      valid = false;
    }

    return { valid, values };
  }

  function showSuccessModal(order) {
    const meta = document.getElementById('successOrderMeta');
    const details = document.getElementById('successOrderDetails');
    const waBtn = document.getElementById('successWaBtn');
    const modal = document.getElementById('orderSuccessModal');

    meta.textContent = `كود الطلب المرجعي: ${order.id}`;
    details.innerHTML = `
      ${order.lines.map((l) => `<div class="summary-line"><span>${escapeHtml(l.productName)} (${l.qty})</span><strong>${formatEGP(l.unitSell * l.qty)}</strong></div>`).join('')}
      <div class="summary-line"><span>المحافظة (${escapeHtml(order.governorate)}):</span><strong>شحن ${formatEGP(order.shippingFee)}</strong></div>
      <div class="summary-line total"><span>الإجمالي عند الاستلام:</span><span>${formatEGP(order.totalCOD)}</span></div>
    `;
    waBtn.href = buildWhatsAppOrderUrl(order);
    modal.classList.add('open');
  }

  function init() {
    injectSharedMarkup();
    updateBadge();

    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-open-cart]')) {
        openCart();
      }
      if (e.target.id === 'closeCartBtn' || e.target.id === 'cartBackdrop') {
        closeCart();
      }
      const qtyBtn = e.target.closest('[data-qty-delta]');
      if (qtyBtn) {
        updateCartQty(
          qtyBtn.dataset.pid,
          qtyBtn.dataset.bid,
          Number(qtyBtn.dataset.qtyDelta)
        );
      }
      const upsellBtn = e.target.closest('[data-quick-upsell]');
      if (upsellBtn) {
        addToCart(upsellBtn.dataset.quickUpsell, 'single', 1);
      }
      if (e.target.id === 'openCheckoutModalBtn') {
        closeCart();
        renderDrawerSummary();
        document.getElementById('cartCheckoutModal').classList.add('open');
      }
      if (e.target.id === 'closeCheckoutModalBtn') {
        document.getElementById('cartCheckoutModal').classList.remove('open');
      }
      if (e.target.id === 'closeSuccessBtn') {
        document.getElementById('orderSuccessModal').classList.remove('open');
      }
    });

    document.getElementById('dcGov')?.addEventListener('change', renderDrawerSummary);

    document.getElementById('drawerCheckoutForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const cart = getCart();
      if (!cart.length) return showToast('السلة فارغة!');
      const { valid, values } = validateForm(e.target);
      if (!valid) return;
      const order = createOrder({ ...values, items: cart });
      clearCart();
      document.getElementById('cartCheckoutModal').classList.remove('open');
      e.target.reset();
      showSuccessModal(order);
    });

    document.getElementById('drawerWaOrderBtn')?.addEventListener('click', () => {
      const form = document.getElementById('drawerCheckoutForm');
      const cart = getCart();
      if (!cart.length) return showToast('السلة فارغة!');
      const { valid, values } = validateForm(form);
      if (!valid) return;
      const order = createOrder({ ...values, items: cart });
      clearCart();
      document.getElementById('cartCheckoutModal').classList.remove('open');
      window.open(buildWhatsAppOrderUrl(order), '_blank', 'noopener');
      showSuccessModal(order);
    });

    window.addEventListener('cart:updated', () => {
      renderCart();
      renderDrawerSummary();
    });
  }

  return {
    init,
    openCart,
    renderGovernorateOptions,
    validateForm,
    showSuccessModal,
  };
})();
