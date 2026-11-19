// إدارة حالة المتجر والسلة والطلبات والتحقق من البيانات

window.StoreEngine = (() => {
  const KEYS = {
    CONFIG: 'madmoon_store_config_v1',
    CART: 'madmoon_store_cart_v1',
    ORDERS: 'madmoon_store_orders_v1',
  };

  function normalizeArabicDigits(str) {
    if (!str) return '';
    return String(str)
      .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
      .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
      .trim();
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatEGP(num) {
    return `${Number(num || 0).toLocaleString('en-US')} ج.م`;
  }

  function isValidEgyptPhone(raw) {
    const clean = normalizeArabicDigits(raw).replace(/[\s\-+]/g, '');
    const local = clean.startsWith('201') ? '0' + clean.slice(2) : clean;
    return /^01[0125][0-9]{8}$/.test(local);
  }

  function formatEgyptPhone(raw) {
    const clean = normalizeArabicDigits(raw).replace(/[\s\-+]/g, '');
    return clean.startsWith('201') ? '0' + clean.slice(2) : clean;
  }

  function normalizeWhatsAppNumber(raw) {
    let digits = normalizeArabicDigits(raw).replace(/[^\d]/g, '');
    if (digits.startsWith('0020')) digits = digits.slice(2);
    if (digits.startsWith('01') && digits.length === 11) digits = '2' + digits;
    return digits;
  }

  function getConfig() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEYS.CONFIG) || '{}');
      const merged = { ...window.STORE_DEFAULTS, ...saved };
      if (merged.brandName === 'مَضمون') {
        merged.brandName = 'مضمون';
      }
      if (!merged.orderWebhookUrl && window.STORE_DEFAULTS.orderWebhookUrl) {
        merged.orderWebhookUrl = window.STORE_DEFAULTS.orderWebhookUrl;
      }
      if (!merged.whatsappNumber && window.STORE_DEFAULTS.whatsappNumber) {
        merged.whatsappNumber = window.STORE_DEFAULTS.whatsappNumber;
      }
      return merged;
    } catch {
      return { ...window.STORE_DEFAULTS };
    }
  }

  function saveConfig(next) {
    const cleaned = { ...next };
    if (cleaned.whatsappNumber) {
      cleaned.whatsappNumber = normalizeWhatsAppNumber(cleaned.whatsappNumber);
    }
    const merged = { ...getConfig(), ...cleaned };
    localStorage.setItem(KEYS.CONFIG, JSON.stringify(merged));
    return merged;
  }

  function getProductById(id) {
    return window.PRODUCTS.find((p) => p.id === id) || null;
  }

  function getBundle(product, bundleId) {
    if (!product) return null;
    return product.bundles.find((b) => b.id === bundleId) || product.bundles[0];
  }

  function getGovernorateInfo(govName) {
    return (
      window.EGYPT_GOVERNORATES.find((g) => g.name === govName) || {
        name: govName || 'القاهرة',
        shipping: 95,
        sla: '2 — 3 أيام عمل',
        zone: 'القاهرة الكبرى',
      }
    );
  }

  // --- Cart Operations ---
  function getCart() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEYS.CART) || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }

  function saveCart(items) {
    localStorage.setItem(KEYS.CART, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('cart:updated'));
  }

  function addToCart(productId, bundleId = 'single', qty = 1) {
    const cart = getCart();
    const existing = cart.find((c) => c.productId === productId && c.bundleId === bundleId);
    if (existing) {
      existing.qty += qty;
    } else {
      cart.push({ productId, bundleId, qty });
    }
    saveCart(cart);
    showToast('تمت إضافة المنتج إلى السلة بنجاح ✓');
  }

  function updateCartQty(productId, bundleId, delta) {
    let cart = getCart();
    const idx = cart.findIndex((c) => c.productId === productId && c.bundleId === bundleId);
    if (idx === -1) return;
    cart[idx].qty += delta;
    if (cart[idx].qty <= 0) {
      cart.splice(idx, 1);
    }
    saveCart(cart);
  }

  function clearCart() {
    saveCart([]);
  }

  function computeCartPricing(cartItems) {
    const hasMainItem = cartItems.some((c) => {
      const p = getProductById(c.productId);
      return p && !p.isUpsell;
    });
    const totalDistinct = cartItems.length;

    let subtotal = 0;
    let totalCost = 0;
    const enriched = [];

    cartItems.forEach((item, index) => {
      const product = getProductById(item.productId);
      if (!product) return;
      const bundle = getBundle(product, item.bundleId);
      const applyCrossSell =
        Boolean(product.isUpsell) && (hasMainItem || (totalDistinct > 1 && index > 0));

      const unitSell =
        applyCrossSell && product.upsellPrice ? product.upsellPrice : bundle.sellPrice;
      const unitCost =
        applyCrossSell && bundle.cartAddonCost
          ? bundle.cartAddonCost
          : bundle.taagerCost || 0;

      const lineTotal = unitSell * item.qty;
      const lineCost = unitCost * item.qty;

      subtotal += lineTotal;
      totalCost += lineCost;

      enriched.push({
        product,
        bundle,
        qty: item.qty,
        applyCrossSell,
        unitSell,
        unitCost,
        lineTotal,
        lineCost,
      });
    });

    return {
      items: enriched,
      subtotal,
      totalCost,
      totalProfit: subtotal - totalCost,
      count: cartItems.reduce((acc, c) => acc + c.qty, 0),
    };
  }

  // --- Orders Operations ---
  function getOrders() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEYS.ORDERS) || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }

  function saveOrders(orders) {
    localStorage.setItem(KEYS.ORDERS, JSON.stringify(orders));
  }

  function generateOrderId() {
    const rand = Math.floor(1000 + Math.random() * 9000);
    const ts = String(Date.now()).slice(-4);
    return `MDM-${ts}${rand}`;
  }

  function createOrder(payload) {
    const govInfo = getGovernorateInfo(payload.governorate);
    const pricing = computeCartPricing(payload.items);
    const shippingFee = govInfo.shipping;
    const totalCOD = pricing.subtotal + shippingFee;

    const order = {
      id: generateOrderId(),
      createdAt: new Date().toISOString(),
      customerName: payload.customerName.trim(),
      phone1: formatEgyptPhone(payload.phone1),
      phone2: payload.phone2 ? formatEgyptPhone(payload.phone2) : '',
      governorate: govInfo.name,
      address: payload.address.trim(),
      notes: (payload.notes || '').trim(),
      shippingFee,
      subtotal: pricing.subtotal,
      totalCOD,
      estimatedCost: pricing.totalCost,
      estimatedProfit: pricing.totalProfit,
      status: 'new',
      lines: pricing.items.map((line) => ({
        productId: line.product.id,
        productName: line.product.name,
        bundleLabel: line.bundle.label,
        qty: line.qty,
        unitSell: line.unitSell,
        unitCost: line.unitCost,
        taagerSku: line.bundle.taagerSku,
        taagerName: line.bundle.taagerName,
        taagerQty: line.bundle.taagerQty * line.qty,
        taagerUnitPrice: Math.round(line.unitSell / line.bundle.taagerQty),
        isCrossSell: line.applyCrossSell,
      })),
    };

    const orders = getOrders();
    orders.unshift(order);
    saveOrders(orders);

    const cfg = getConfig();

    // 1. إرسال الطلب تلقائياً إلى Netlify Forms فقط عند النشر على نطاق netlify.app
    if (
      typeof window !== 'undefined' &&
      window.location &&
      window.location.hostname.endsWith('.netlify.app') &&
      window.location.protocol.startsWith('http')
    ) {
      try {
        const itemsSummary = order.lines
          .map(
            (l) =>
              `${l.productName} (${l.bundleLabel}) x${l.qty} | كود تاجر: ${l.taagerSku} x${l.taagerQty} بسعر ${l.taagerUnitPrice} ج.م`
          )
          .join('\n');
        const params = new URLSearchParams({
          'form-name': 'cod-orders',
          'bot-field': '',
          orderId: order.id,
          customerName: order.customerName,
          phone1: order.phone1,
          phone2: order.phone2 || '',
          governorate: order.governorate,
          address: order.address,
          itemsSummary: `${itemsSummary}\nالشحن: ${order.shippingFee} ج.م | الإجمالي COD: ${order.totalCOD} ج.م`,
          taagerSkuLines: JSON.stringify(
            order.lines.map((l) => ({
              sku: l.taagerSku,
              name: l.taagerName,
              qty: l.taagerQty,
              unitPrice: l.taagerUnitPrice,
            }))
          ),
          shippingFee: String(order.shippingFee),
          totalCOD: String(order.totalCOD),
          notes: order.notes || '',
        });
        fetch('/__forms.html', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
          keepalive: true,
        }).catch(() => {});
      } catch {
        // الإرسال الصامت لا يعطل عرض تأكيد الطلب
      }
    }

    // 2. إرسال الطلب تلقائياً لقاعدة بيانات Google Sheets السحابية إذا تم تفعيل الـ Webhook
    if (cfg.orderWebhookUrl && /^https?:\/\//i.test(cfg.orderWebhookUrl)) {
      try {
        fetch(cfg.orderWebhookUrl, {
          method: 'POST',
          mode: 'no-cors',
          keepalive: true,
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            order,
            facebookPageName: cfg.facebookPageName,
            facebookPageLink: cfg.facebookPageLink,
          }),
        }).catch(() => {});
      } catch {
        // الإرسال السحابي غير معطّل لتجربة العميل
      }
    }

    return order;
  }

  function updateOrderStatus(orderId, status) {
    const orders = getOrders();
    const target = orders.find((o) => o.id === orderId);
    if (target) {
      target.status = status;
      saveOrders(orders);
    }
    return orders;
  }

  function deleteOrder(orderId) {
    const next = getOrders().filter((o) => o.id !== orderId);
    saveOrders(next);
    return next;
  }

  function buildWhatsAppOrderUrl(order) {
    const cfg = getConfig();
    const linesText = order.lines
      .map(
        (l, i) =>
          `${i + 1}) ${l.productName} — ${l.bundleLabel} × ${l.qty} (${formatEGP(l.unitSell * l.qty)})`
      )
      .join('\n');

    const msg = [
      `أهلاً ${cfg.brandName}، أريد تأكيد طلبي رقم *${order.id}*:`,
      linesText,
      `---`,
      `الاسم: ${order.customerName}`,
      `الهاتف: ${order.phone1}${order.phone2 ? ' / ' + order.phone2 : ''}`,
      `المحافظة: ${order.governorate}`,
      `العنوان: ${order.address}`,
      order.notes ? `ملاحظات: ${order.notes}` : null,
      `الشحن: ${formatEGP(order.shippingFee)}`,
      `*الإجمالي عند الاستلام: ${formatEGP(order.totalCOD)}*`,
    ]
      .filter(Boolean)
      .join('\n');

    const cleanWa = normalizeWhatsAppNumber(cfg.whatsappNumber);
    return `https://wa.me/${cleanWa}?text=${encodeURIComponent(msg)}`;
  }

  function showToast(message) {
    let el = document.getElementById('globalToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'globalToast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), 2800);
  }

  function applyBrandToDom() {
    const cfg = getConfig();
    document.querySelectorAll('[data-brand-name]').forEach((el) => {
      el.textContent = cfg.brandName;
    });
    document.querySelectorAll('[data-brand-tagline]').forEach((el) => {
      el.textContent = cfg.brandTagline;
    });
    document.querySelectorAll('[data-whatsapp-link]').forEach((el) => {
      const cleanWa = normalizeWhatsAppNumber(cfg.whatsappNumber);
      el.href = `https://wa.me/${cleanWa}?text=${encodeURIComponent(`أهلاً ${cfg.brandName}، محتاج استفسار عن المنتجات`)}`;
    });
  }

  return {
    normalizeArabicDigits,
    escapeHtml,
    formatEGP,
    isValidEgyptPhone,
    formatEgyptPhone,
    getConfig,
    saveConfig,
    getProductById,
    getBundle,
    getGovernorateInfo,
    getCart,
    addToCart,
    updateCartQty,
    clearCart,
    computeCartPricing,
    getOrders,
    createOrder,
    updateOrderStatus,
    deleteOrder,
    buildWhatsAppOrderUrl,
    showToast,
    applyBrandToDom,
  };
})();
