/*
 * Mutagen storefront: shared code used by every page.
 * Builds the catalog from products.js, keeps the cart in localStorage,
 * and renders the header, footer, cart drawer and age check.
 */
(function () {
  "use strict";

  /* ---------- settings ---------- */

  const config = Object.assign(
    {
      storeName: "Mutagen",
      email: "",
      orderEndpoint: "",
      currency: "USD",
      locale: "en-US",
      showAgeGate: true,
      minAge: 21,
      returnWindowDays: 7,
      paymentNote: "",
      disclaimer: "",
    },
    window.MUTAGEN_CONFIG || {}
  );
  config.shipping = Object.assign(
    { flatRate: 0, freeOver: null, processingDays: 2, countries: ["United States"] },
    (window.MUTAGEN_CONFIG || {}).shipping || {}
  );

  const page = document.body.dataset.page || "";

  /* ---------- helpers ---------- */

  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ESC[c]);

  const slugify = (s) =>
    String(s)
      .toLowerCase()
      .replace(/,/g, "")
      .replace(/\+/g, " ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  // "BPC 157", "bpc157" and "BPC-157" all match each other.
  const normalize = (s) =>
    String(s)
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]/g, "");

  const toCents = (n) => Math.round(Number(n) * 100);

  let moneyFormat;
  try {
    moneyFormat = new Intl.NumberFormat(config.locale, { style: "currency", currency: config.currency });
  } catch (err) {
    moneyFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  }
  const money = (cents) => moneyFormat.format(cents / 100);

  // "10mg" -> "10 mg" with a non-breaking space so it never splits across lines.
  const formatStrength = (s) =>
    String(s)
      .trim()
      .replace(/^([\d.,]+)\s*([A-Za-z\u00b5\u03bc]+)$/, "$1\u00a0$2");

  // "CJC-1295 (with DAC)" -> { main: "CJC-1295", qual: "(with DAC)" }
  const splitName = (name) => {
    const m = /^(.*?)\s*(\([^)]*\))$/.exec(name);
    return m ? { main: m[1], qual: m[2] } : { main: name, qual: "" };
  };

  // Picks the width and size a name is set in so it fills its tile.
  // Multi-word names are allowed two lines; the class names map to styles.css.
  const fitClass = (main) => {
    const words = main.trim().split(/\s+/);
    const longest = Math.max(...words.map((w) => w.length));
    const score = words.length > 1 ? Math.max(longest, Math.ceil(main.length / 2)) : main.length;
    if (score <= 4) return "fit-xs";
    if (score <= 7) return "fit-s";
    if (score <= 10) return "fit-m";
    if (score <= 13) return "fit-l";
    return "fit-xl";
  };

  /* ---------- catalog ---------- */

  const products = [];
  const productBySlug = new Map();
  const variantById = new Map();
  const productByVariant = new Map();

  (window.MUTAGEN_PRODUCTS || []).forEach((raw, i) => {
    if (!raw || !raw.name || !Array.isArray(raw.sizes) || !raw.sizes.length) return;
    let slug = raw.slug || slugify(raw.name);
    if (productBySlug.has(slug)) slug += "-" + (i + 1);

    const product = {
      no: raw.no || i + 1,
      name: String(raw.name),
      slug,
      aliases: Array.isArray(raw.aliases) ? raw.aliases : [],
      variants: [],
    };
    product.terms = [product.name, ...product.aliases].map(normalize);

    raw.sizes.forEach(([strength, price]) => {
      const sizeSlug = slugify(strength);
      const id = `${slug}--${sizeSlug}`;
      if (variantById.has(id)) return;
      const variant = { id, sizeSlug, strength: String(strength), label: formatStrength(strength), cents: toCents(price) };
      product.variants.push(variant);
      variantById.set(id, variant);
      productByVariant.set(id, product);
    });

    products.push(product);
    productBySlug.set(slug, product);
  });

  const productURL = (p, v) =>
    `product.html?p=${encodeURIComponent(p.slug)}${v ? `&size=${encodeURIComponent(v.sizeSlug)}` : ""}`;

  /* ---------- storage ---------- */

  const store = {
    get(key) {
      try {
        const raw = window.localStorage.getItem(key);
        return raw == null ? null : JSON.parse(raw);
      } catch (err) {
        return null;
      }
    },
    set(key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch (err) {
        /* Storage is blocked or full: the cart still works until the page closes. */
      }
    },
    remove(key) {
      try {
        window.localStorage.removeItem(key);
      } catch (err) {
        /* ignore */
      }
    },
  };

  /* ---------- cart ---------- */

  const CART_KEY = "mutagen.cart.v1";
  const MAX_QTY = 99;
  const clampQty = (n) => Math.max(0, Math.min(MAX_QTY, Math.floor(Number(n) || 0)));

  function readCart() {
    const saved = store.get(CART_KEY);
    const items = {};
    if (saved && typeof saved === "object") {
      Object.keys(saved).forEach((id) => {
        const q = clampQty(saved[id]);
        if (q > 0 && variantById.has(id)) items[id] = q;
      });
    }
    return items;
  }

  let items = readCart();

  function commit(type, id) {
    store.set(CART_KEY, items);
    window.dispatchEvent(new CustomEvent("cart:change", { detail: { type, id } }));
  }

  const cart = {
    qty: (id) => items[id] || 0,
    productQty: (p) => p.variants.reduce((n, v) => n + (items[v.id] || 0), 0),
    add(id, n = 1) {
      if (!variantById.has(id)) return;
      items[id] = Math.min(MAX_QTY, (items[id] || 0) + Math.max(1, Math.floor(n)));
      commit("add", id);
    },
    set(id, n) {
      if (!variantById.has(id)) return;
      const q = clampQty(n);
      if (q > 0) items[id] = q;
      else delete items[id];
      commit("set", id);
    },
    remove(id) {
      delete items[id];
      commit("remove", id);
    },
    clear() {
      items = {};
      commit("clear");
    },
    lines() {
      return Object.keys(items).map((id) => {
        const v = variantById.get(id);
        return Object.assign({}, v, { product: productByVariant.get(id), qty: items[id], total: v.cents * items[id] });
      });
    },
    count: () => Object.values(items).reduce((a, b) => a + b, 0),
    subtotal: () => cart.lines().reduce((a, l) => a + l.total, 0),
  };

  // Keep carts in step across open tabs.
  window.addEventListener("storage", (e) => {
    if (e.key !== CART_KEY) return;
    items = readCart();
    window.dispatchEvent(new CustomEvent("cart:change", { detail: { type: "sync" } }));
  });

  /* ---------- shipping ---------- */

  const hasFreeShipping = () => config.shipping.freeOver != null && config.shipping.freeOver !== "";

  function shippingFor(subtotal) {
    if (subtotal <= 0) return 0;
    if (hasFreeShipping() && subtotal >= toCents(config.shipping.freeOver)) return 0;
    return toCents(config.shipping.flatRate || 0);
  }

  function shippingSummary() {
    const flat = toCents(config.shipping.flatRate || 0);
    if (!flat) return "Shipping is free on every order.";
    let text = `Shipping is a flat ${money(flat)} per order`;
    if (hasFreeShipping()) text += `, and free on orders of ${money(toCents(config.shipping.freeOver))} or more`;
    return text + ".";
  }

  /* ---------- layout ---------- */

  const MARK = "assets/img/mutagen-mark.svg";
  const AGE_KEY = "mutagen.age.v1";
  const needsGate = config.showAgeGate && !(store.get(AGE_KEY) || {}).confirmed;

  function headerHTML() {
    const current = (p) => (page === p ? ' aria-current="page"' : "");
    return `
      <a class="skip" href="#main">Skip to content</a>
      <header class="site-header">
        <div class="wrap site-header__inner">
          <a class="brand" href="index.html">
            <img src="${MARK}" alt="" width="34" height="34">
            <span class="brand__name">${esc(config.storeName)}</span>
          </a>
          <nav class="site-nav" aria-label="Main">
            <a href="index.html#catalog"${current("home")}>Catalog</a>
            <a href="policies.html#research-use"${current("policies")}>Research use</a>
            <a href="policies.html#contact">Contact</a>
          </nav>
          <button class="cart-btn" type="button" data-open-cart aria-haspopup="dialog">
            <span>Cart</span>
            <span class="cart-btn__count" data-cart-count>0</span>
          </button>
        </div>
      </header>`;
  }

  function footerHTML() {
    return `
      <footer class="site-footer">
        <div class="wrap site-footer__grid">
          <div class="site-footer__brand">
            <img src="${MARK}" alt="" width="26" height="26">
            <span>${esc(config.storeName)}</span>
          </div>
          <div>
            <nav aria-label="Footer">
              <ul>
                <li><a href="index.html#catalog">Catalog</a></li>
                <li><a href="policies.html#research-use">Research use policy</a></li>
                <li><a href="policies.html#terms">Terms of sale</a></li>
                <li><a href="policies.html#shipping">Shipping</a></li>
                <li><a href="policies.html#returns">Returns</a></li>
                <li><a href="policies.html#privacy">Privacy</a></li>
                <li><a href="policies.html#contact">Contact</a></li>
              </ul>
            </nav>
            <p class="site-footer__legal">${esc(config.disclaimer)}</p>
            <p class="site-footer__copy">&copy; ${new Date().getFullYear()} ${esc(config.storeName)}.
              <a href="mailto:${esc(config.email)}">${esc(config.email)}</a></p>
          </div>
        </div>
      </footer>`;
  }

  function drawerHTML() {
    return `
      <dialog class="drawer" data-cart-drawer aria-labelledby="cart-title">
        <div class="drawer__panel">
          <div class="drawer__head">
            <h2 id="cart-title">Cart</h2>
            <button class="icon-btn" type="button" data-close-cart aria-label="Close cart">
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 4l12 12M16 4 4 16" stroke="currentColor" stroke-width="2" fill="none"/></svg>
            </button>
          </div>
          <div class="drawer__body" data-cart-body></div>
          <div class="drawer__foot" data-cart-foot hidden></div>
        </div>
      </dialog>`;
  }

  function toastHTML() {
    return `
      <div class="toast" data-toast hidden>
        <span data-toast-text></span>
        <button class="btn" type="button" data-open-cart>View cart</button>
      </div>
      <div class="visually-hidden" aria-live="polite" data-live></div>`;
  }

  function gateHTML() {
    const age = esc(config.minAge);
    return `
      <dialog class="gate" data-gate aria-labelledby="gate-title">
        <div class="gate__panel bracket bracket--green">
          <img class="gate__mark" src="${MARK}" alt="" width="44" height="44">
          <div data-gate-ask>
            <h2 id="gate-title">Before you enter</h2>
            <p>${esc(config.storeName)} sells research compounds for laboratory use only. They are not for human or veterinary use.</p>
            <p>You must be ${age} or older to use this site.</p>
            <div class="gate__actions">
              <button class="btn btn--primary" type="button" data-gate-yes>I'm ${age} or older</button>
              <button class="btn" type="button" data-gate-no>I'm under ${age}</button>
            </div>
          </div>
          <div data-gate-denied hidden>
            <h2 tabindex="-1">This site is for adults only</h2>
            <p>You must be ${age} or older to use this site.</p>
            <div class="gate__actions">
              <button class="btn" type="button" data-gate-back>Go back</button>
            </div>
          </div>
        </div>
      </dialog>`;
  }

  function renderLayout() {
    const headerSlot = document.querySelector("[data-site-header]");
    if (headerSlot) headerSlot.outerHTML = headerHTML();
    const footerSlot = document.querySelector("[data-site-footer]");
    if (footerSlot) footerSlot.outerHTML = footerHTML();
    document.body.insertAdjacentHTML("beforeend", drawerHTML() + toastHTML() + (needsGate ? gateHTML() : ""));
  }

  /* ---------- settings in page copy ---------- */

  const configValue = (path) => path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), config);

  function bindConfig(scope) {
    const root = scope || document;
    root.querySelectorAll("[data-config]").forEach((el) => {
      const value = configValue(el.dataset.config);
      if (value == null || value === "") return;
      if (el.dataset.format === "money") el.textContent = money(toCents(value));
      else el.textContent = Array.isArray(value) ? value.join(", ") : String(value);
    });
    root.querySelectorAll("[data-config-email]").forEach((el) => {
      el.href = `mailto:${config.email}`;
      if (!el.textContent.trim()) el.textContent = config.email;
    });
    root.querySelectorAll("[data-shipping-summary]").forEach((el) => {
      el.textContent = shippingSummary();
    });
  }

  /* ---------- announcements and toast ---------- */

  function announce(message) {
    const live = document.querySelector("[data-live]");
    if (!live) return;
    live.textContent = "";
    window.setTimeout(() => {
      live.textContent = message;
    }, 40);
  }

  let toastTimer = 0;

  function hideToast() {
    window.clearTimeout(toastTimer);
    const el = document.querySelector("[data-toast]");
    if (el) el.hidden = true;
  }

  function scheduleToastHide(ms) {
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(hideToast, ms);
  }

  function toast(message) {
    const el = document.querySelector("[data-toast]");
    if (!el) return;
    el.querySelector("[data-toast-text]").textContent = message;
    el.hidden = false;
    el.style.animation = "none";
    void el.offsetWidth; // restart the entrance animation
    el.style.animation = "";
    scheduleToastHide(4500);
    announce(message);
  }

  function bindToast() {
    const el = document.querySelector("[data-toast]");
    if (!el) return;
    el.addEventListener("mouseenter", () => window.clearTimeout(toastTimer));
    el.addEventListener("mouseleave", () => scheduleToastHide(2500));
    el.addEventListener("focusin", () => window.clearTimeout(toastTimer));
    el.addEventListener("focusout", () => scheduleToastHide(2500));
  }

  function addToCart(id, qty) {
    const n = Math.max(1, Math.floor(qty || 1));
    const v = variantById.get(id);
    if (!v) return;
    cart.add(id, n);
    toast(`Added ${n > 1 ? `${n} \u00d7 ` : ""}${productByVariant.get(id).name} ${v.label} to your cart.`);
  }

  /* ---------- header count ---------- */

  function updateCount(bump) {
    const n = cart.count();
    document.querySelectorAll("[data-cart-count]").forEach((el) => {
      el.textContent = String(n);
      el.classList.toggle("has-items", n > 0);
      if (bump) {
        el.classList.remove("is-bumped");
        void el.offsetWidth;
        el.classList.add("is-bumped");
      }
    });
    document.querySelectorAll(".cart-btn").forEach((btn) => {
      btn.setAttribute("aria-label", n === 1 ? "Cart, 1 item" : `Cart, ${n} items`);
    });
  }

  /* ---------- cart drawer ---------- */

  let drawer = null;

  function lineHTML(l) {
    const full = `${l.product.name} ${l.label}`;
    return `
      <li class="line">
        <div>
          <a class="line__name" href="${productURL(l.product, l)}">${esc(l.product.name)}</a>
          <span class="line__meta">${esc(l.label)}, ${money(l.cents)} each</span>
        </div>
        <span class="line__total">${money(l.total)}</span>
        <div class="line__controls">
          <div class="qty" role="group" aria-label="Quantity of ${esc(full)}">
            <button type="button" data-dec="${l.id}" aria-label="One fewer"${l.qty <= 1 ? " disabled" : ""}>\u2212</button>
            <input type="number" inputmode="numeric" min="1" max="${MAX_QTY}" value="${l.qty}" data-qty="${l.id}" aria-label="Quantity">
            <button type="button" data-inc="${l.id}" aria-label="One more"${l.qty >= MAX_QTY ? " disabled" : ""}>+</button>
          </div>
          <button class="link-btn" type="button" data-remove="${l.id}">Remove</button>
        </div>
      </li>`;
  }

  function renderDrawer() {
    if (!drawer) return;
    const body = drawer.querySelector("[data-cart-body]");
    const foot = drawer.querySelector("[data-cart-foot]");

    // Remember which control had focus so it can be restored after re-rendering.
    let restore = null;
    const active = document.activeElement;
    if (active && drawer.contains(active)) {
      ["data-inc", "data-dec", "data-qty", "data-remove"].some((attr) => {
        if (!active.hasAttribute(attr)) return false;
        restore = { attr, id: active.getAttribute(attr) };
        return true;
      });
    }

    const lines = cart.lines();
    if (!lines.length) {
      body.innerHTML = `
        <div class="drawer__empty">
          <p>Your cart is empty. Add compounds from the catalog to start an order.</p>
          <a class="btn" href="index.html#catalog" data-close-cart>Browse the catalog</a>
        </div>`;
      foot.innerHTML = "";
      foot.hidden = true;
    } else {
      body.innerHTML = `<ul class="lines">${lines.map(lineHTML).join("")}</ul>`;
      const next =
        page === "checkout"
          ? `<button class="btn btn--primary btn--block" type="button" data-close-cart>Back to checkout</button>`
          : `<a class="btn btn--primary btn--block" href="checkout.html">Go to checkout</a>`;
      foot.innerHTML = `
        <dl class="sum"><div><dt>Subtotal</dt><dd>${money(cart.subtotal())}</dd></div></dl>
        ${next}
        <p class="fine">Shipping is added at checkout.</p>`;
      foot.hidden = false;
    }

    if (restore) {
      const sel = (attr) => drawer.querySelector(`[${attr}="${CSS.escape(restore.id)}"]`);
      let target = sel(restore.attr);
      if (target && target.disabled) target = sel("data-qty");
      (target || drawer.querySelector("[data-close-cart]")).focus();
    }
  }

  function openCart() {
    if (!drawer) return;
    hideToast();
    renderDrawer();
    if (!drawer.open) drawer.showModal();
  }

  function closeCart() {
    if (drawer && drawer.open) drawer.close();
  }

  function bindDrawer() {
    drawer = document.querySelector("[data-cart-drawer]");
    if (!drawer) return;

    drawer.addEventListener("click", (e) => {
      if (e.target === drawer) {
        closeCart(); // click on the backdrop
        return;
      }
      const t = e.target.closest("button, a");
      if (!t) return;
      if (t.hasAttribute("data-close-cart")) {
        closeCart(); // links still navigate
        return;
      }
      if (t.dataset.inc) cart.set(t.dataset.inc, cart.qty(t.dataset.inc) + 1);
      else if (t.dataset.dec) cart.set(t.dataset.dec, Math.max(1, cart.qty(t.dataset.dec) - 1));
      else if (t.dataset.remove) {
        const v = variantById.get(t.dataset.remove);
        const name = v ? `${productByVariant.get(v.id).name} ${v.label}` : "Item";
        cart.remove(t.dataset.remove);
        announce(`Removed ${name} from your cart.`);
      }
    });

    drawer.addEventListener("change", (e) => {
      const input = e.target.closest("[data-qty]");
      if (!input) return;
      const n = Math.floor(Number(input.value));
      if (!n || n < 1) {
        input.value = String(cart.qty(input.dataset.qty));
        return;
      }
      cart.set(input.dataset.qty, n);
    });
  }

  /* ---------- age check ---------- */

  function bindGate() {
    const gate = document.querySelector("[data-gate]");
    if (!gate || typeof gate.showModal !== "function") return;
    let confirmed = false;
    const ask = gate.querySelector("[data-gate-ask]");
    const denied = gate.querySelector("[data-gate-denied]");

    gate.addEventListener("cancel", (e) => e.preventDefault());
    gate.addEventListener("close", () => {
      if (!confirmed) window.setTimeout(() => gate.showModal(), 0);
    });
    gate.addEventListener("click", (e) => {
      const t = e.target.closest("button");
      if (!t) return;
      if (t.hasAttribute("data-gate-yes")) {
        confirmed = true;
        store.set(AGE_KEY, { confirmed: true, at: new Date().toISOString() });
        gate.close();
        gate.remove();
      } else if (t.hasAttribute("data-gate-no")) {
        ask.hidden = true;
        denied.hidden = false;
        denied.querySelector("h2").focus();
      } else if (t.hasAttribute("data-gate-back")) {
        denied.hidden = true;
        ask.hidden = false;
        ask.querySelector("[data-gate-yes]").focus();
      }
    });
    gate.showModal();
  }

  /* ---------- start ---------- */

  renderLayout();
  bindConfig();
  bindDrawer();
  bindToast();
  updateCount(false);

  document.addEventListener("click", (e) => {
    const opener = e.target.closest("[data-open-cart]");
    if (!opener) return;
    e.preventDefault();
    openCart();
  });

  window.addEventListener("cart:change", (e) => {
    updateCount(Boolean(e.detail && e.detail.type === "add"));
    if (drawer && drawer.open) renderDrawer();
  });

  if (needsGate) bindGate();

  window.Mutagen = {
    config,
    page,
    products,
    productBySlug,
    variantById,
    productByVariant,
    cart,
    store,
    esc,
    money,
    toCents,
    normalize,
    splitName,
    fitClass,
    productURL,
    shippingFor,
    shippingSummary,
    hasFreeShipping,
    addToCart,
    openCart,
    closeCart,
    toast,
    announce,
    bindConfig,
  };
})();
