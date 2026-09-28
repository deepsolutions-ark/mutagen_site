/* Mutagen checkout: summary, shipping details, research-use confirmation, order request. */
(function () {
  "use strict";

  const M = window.Mutagen;
  const root = document.querySelector("[data-checkout]");
  if (!M || !root) return;

  const esc = M.esc;
  const cfg = M.config;
  const grid = root.querySelector("[data-checkout-grid]");
  const empty = root.querySelector("[data-empty]");
  const form = root.querySelector("[data-form]");
  const summary = root.querySelector("[data-summary]");
  const alertBox = root.querySelector("[data-alert]");
  const submitBtn = root.querySelector("[data-submit]");
  const SUBMIT_LABEL = submitBtn.textContent;
  let finished = false;
  let attempted = false;

  /* ---------- countries ---------- */

  const countries = (cfg.shipping.countries || []).filter(Boolean);
  form.elements.country.innerHTML =
    (countries.length === 1 ? "" : `<option value="">Choose a country</option>`) +
    countries.map((c) => `<option>${esc(c)}</option>`).join("");

  /* ---------- summary ---------- */

  function linesHTML(lines) {
    return lines
      .map(
        (l) => `
        <li class="line">
          <div>
            <span class="line__name">${esc(l.name)}</span>
            <span class="line__meta">${esc(l.strength)} \u00d7 ${l.qty}</span>
          </div>
          <span class="line__total">${M.money(l.total)}</span>
        </li>`
      )
      .join("");
  }

  function totalsHTML(subtotal, shipping) {
    return `
      <dl class="sum">
        <div><dt>Subtotal</dt><dd>${M.money(subtotal)}</dd></div>
        <div><dt>Shipping</dt><dd>${shipping ? M.money(shipping) : "Free"}</dd></div>
        <div class="sum__total"><dt>Estimated total</dt><dd>${M.money(subtotal + shipping)}</dd></div>
      </dl>`;
  }

  const cartLines = () =>
    M.cart.lines().map((l) => ({ name: l.product.name, strength: l.label, qty: l.qty, unit: l.cents, total: l.total }));

  function renderSummary() {
    if (finished) return;
    const lines = cartLines();
    grid.hidden = !lines.length;
    empty.hidden = Boolean(lines.length);
    if (!lines.length) return;

    const subtotal = M.cart.subtotal();
    const shipping = M.shippingFor(subtotal);
    let hint = "";
    if (M.hasFreeShipping() && shipping > 0) {
      hint = `<p class="fine">Add ${M.money(M.toCents(cfg.shipping.freeOver) - subtotal)} more for free shipping.</p>`;
    }

    summary.innerHTML = `
      <h2 id="summary-title">Order summary</h2>
      <p class="summary__edit"><button class="link-btn" type="button" data-open-cart>Edit cart</button></p>
      <ul class="lines">${linesHTML(lines)}</ul>
      ${totalsHTML(subtotal, shipping)}
      ${hint}`;
  }

  /* ---------- validation ---------- */

  const filled = (message) => (el) => (el.value.trim() ? "" : message);
  const ticked = (message) => (el) => (el.checked ? "" : message);

  const checks = {
    name: filled("Enter your full name."),
    email: (el) => {
      const v = el.value.trim();
      if (!v) return "Enter your email address.";
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "" : "Enter an email address like name@example.com.";
    },
    address1: filled("Enter your street address."),
    city: filled("Enter your city."),
    region: filled("Enter your state or province."),
    postal: filled("Enter your ZIP or postal code."),
    country: filled("Choose a country."),
    confirmAge: ticked(`Confirm that you are ${cfg.minAge} or older.`),
    confirmResearch: ticked("Confirm that this order is for laboratory research use only."),
    confirmTerms: ticked("Confirm that you agree to the research use policy and terms of sale."),
  };

  function validate(name) {
    const el = form.elements[name];
    const message = checks[name](el);
    const err = form.querySelector(`[data-error-for="${name}"]`);
    if (err) err.textContent = message;
    if (message) el.setAttribute("aria-invalid", "true");
    else el.removeAttribute("aria-invalid");
    return !message;
  }

  function validateAll() {
    let firstInvalid = null;
    Object.keys(checks).forEach((name) => {
      if (!validate(name) && !firstInvalid) firstInvalid = form.elements[name];
    });
    return firstInvalid;
  }

  form.addEventListener("focusout", (e) => {
    const name = e.target.name;
    if (checks[name] && e.target.type !== "checkbox" && (attempted || e.target.value)) validate(name);
  });

  form.addEventListener("input", (e) => {
    const name = e.target.name;
    if (checks[name] && e.target.getAttribute("aria-invalid") === "true") validate(name);
  });

  form.addEventListener("change", (e) => {
    const name = e.target.name;
    if (checks[name] && e.target.type === "checkbox" && attempted) validate(name);
  });

  /* ---------- order ---------- */

  function orderNumber() {
    const d = new Date();
    const date = [d.getFullYear() % 100, d.getMonth() + 1, d.getDate()].map((n) => String(n).padStart(2, "0")).join("");
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = window.crypto.getRandomValues(new Uint8Array(4));
    return `MG-${date}-${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")}`;
  }

  function buildOrder() {
    const f = form.elements;
    const value = (name) => f[name].value.trim();
    const subtotal = M.cart.subtotal();
    const shipping = M.shippingFor(subtotal);
    return {
      number: orderNumber(),
      createdAt: new Date().toISOString(),
      customer: { name: value("name"), email: value("email"), phone: value("phone") },
      address: {
        line1: value("address1"),
        line2: value("address2"),
        city: value("city"),
        region: value("region"),
        postal: value("postal"),
        country: f.country.value,
      },
      notes: value("notes"),
      lines: cartLines().map((l) => Object.assign(l, { strength: l.strength.replace(/\u00a0/g, " ") })),
      subtotal,
      shipping,
      total: subtotal + shipping,
    };
  }

  const confirmation = () =>
    `Buyer confirmed: ${cfg.minAge} or older; laboratory research use only; agrees to the research use policy and terms of sale.`;

  function orderText(o) {
    const m = M.money;
    const a = o.address;
    const groups = [
      [`Order request ${o.number}`],
      o.lines.map((l) => `${l.name} ${l.strength} x ${l.qty} @ ${m(l.unit)} = ${m(l.total)}`),
      [`Subtotal: ${m(o.subtotal)}`, `Shipping: ${o.shipping ? m(o.shipping) : "Free"}`, `Estimated total: ${m(o.total)}`],
      ["Ship to:", o.customer.name, a.line1, a.line2, `${a.city}, ${a.region} ${a.postal}`, a.country].filter(Boolean),
      [`Email: ${o.customer.email}`, o.customer.phone && `Phone: ${o.customer.phone}`].filter(Boolean),
      o.notes ? [`Notes: ${o.notes}`] : [],
      [confirmation()],
    ];
    return groups
      .filter((g) => g.length)
      .map((g) => g.join("\n"))
      .join("\n\n");
  }

  function payload(o, text) {
    const a = o.address;
    return {
      _subject: `Order request ${o.number}`,
      order_number: o.number,
      name: o.customer.name,
      email: o.customer.email,
      phone: o.customer.phone,
      address_line_1: a.line1,
      address_line_2: a.line2,
      city: a.city,
      state_or_province: a.region,
      postal_code: a.postal,
      country: a.country,
      items: o.lines.map((l) => `${l.name} ${l.strength} x ${l.qty} = ${M.money(l.total)}`).join("\n"),
      subtotal: M.money(o.subtotal),
      shipping: o.shipping ? M.money(o.shipping) : "Free",
      estimated_total: M.money(o.total),
      notes: o.notes,
      buyer_confirmed: confirmation(),
      submitted_at: o.createdAt,
      order_text: text,
    };
  }

  const mailtoURL = (o, text) =>
    `mailto:${cfg.email}?subject=${encodeURIComponent(`Order request ${o.number}`)}&body=${encodeURIComponent(text)}`;

  function finish(order, text, mode) {
    finished = true;
    M.cart.clear();

    const intro =
      mode === "sent"
        ? `<h2 tabindex="-1">Order request sent</h2>
           <p class="done__order">Order ${esc(order.number)}</p>
           <p>We'll reply to ${esc(order.customer.email)} to confirm your order, the final total and how to pay. Keep your order number in case you need to contact us.</p>`
        : `<h2 tabindex="-1">Send the email to finish</h2>
           <p class="done__order">Order ${esc(order.number)}</p>
           <p>Your email app should have opened with this order filled in. Send that email to
             <a href="mailto:${esc(cfg.email)}">${esc(cfg.email)}</a> to place your order request.</p>
           <p>If nothing opened, copy the details below and email them to us.</p>
           <label class="visually-hidden" for="order-text">Order details</label>
           <textarea id="order-text" readonly>${esc(text)}</textarea>`;

    const actions =
      mode === "sent"
        ? `<a class="btn btn--primary" href="index.html#catalog">Back to the catalog</a>`
        : `<button class="btn btn--primary" type="button" data-copy>Copy order details</button>
           <a class="btn" href="${esc(mailtoURL(order, text))}">Open the email again</a>
           <a class="btn" href="index.html#catalog">Back to the catalog</a>`;

    root.innerHTML = `
      <div class="done bracket bracket--green">
        ${intro}
        <ul class="lines">${linesHTML(order.lines)}</ul>
        ${totalsHTML(order.subtotal, order.shipping)}
        <div class="done__actions">${actions}</div>
      </div>`;

    const copyBtn = root.querySelector("[data-copy]");
    if (copyBtn) {
      copyBtn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch (err) {
          const area = root.querySelector("#order-text");
          area.select();
          document.execCommand("copy");
        }
        copyBtn.textContent = "Copied";
        M.announce("Order details copied.");
      });
    }

    window.scrollTo(0, 0);
    root.querySelector(".done h2").focus({ preventScroll: true });
  }

  /* ---------- submit ---------- */

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    attempted = true;
    alertBox.hidden = true;

    const firstInvalid = validateAll();
    if (firstInvalid) {
      alertBox.textContent = "Check the highlighted fields, then send your order request again.";
      alertBox.hidden = false;
      firstInvalid.focus();
      return;
    }
    if (form.elements._gotcha && form.elements._gotcha.value) return; // filled in by a bot
    if (!M.cart.count()) {
      renderSummary();
      return;
    }

    const order = buildOrder();
    const text = orderText(order);
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending order request\u2026";

    try {
      if (cfg.orderEndpoint) {
        const res = await fetch(cfg.orderEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload(order, text)),
        });
        if (!res.ok) throw new Error(`Order endpoint answered ${res.status}`);
        finish(order, text, "sent");
      } else {
        finish(order, text, "email");
        window.location.href = mailtoURL(order, text);
      }
    } catch (err) {
      console.error(err);
      submitBtn.disabled = false;
      submitBtn.textContent = SUBMIT_LABEL;
      alertBox.innerHTML = `Your order request didn't go through. Check your connection and try again, or email
        <a href="mailto:${esc(cfg.email)}">${esc(cfg.email)}</a> and quote order number ${esc(order.number)}.`;
      alertBox.hidden = false;
      alertBox.focus();
    }
  });

  window.addEventListener("cart:change", renderSummary);
  renderSummary();
})();
