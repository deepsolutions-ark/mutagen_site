/* Mutagen product page: product.html?p=<slug>&size=<size> */
(function () {
  "use strict";

  const M = window.Mutagen;
  const root = document.querySelector("[data-product-page]");
  if (!M || !root) return;

  const params = new URLSearchParams(window.location.search);
  const p = M.productBySlug.get(params.get("p") || "");

  if (!p) {
    document.title = `Product not found | ${M.config.storeName}`;
    root.innerHTML = `
      <div class="wrap">
        <h1 class="page-title">Product not found</h1>
        <div class="empty">
          <p>We couldn't find that product. It may have been renamed or removed from the catalog.</p>
          <a class="btn" href="index.html#catalog">Browse the catalog</a>
        </div>
      </div>`;
    return;
  }

  const esc = M.esc;
  const { main, qual } = M.splitName(p.name);
  const MAX_QTY = 99;
  let selected = (p.variants.find((v) => v.sizeSlug === params.get("size")) || p.variants[0]).id;
  let qty = 1;

  document.title = `${p.name} | ${M.config.storeName}`;
  const meta = document.querySelector('meta[name="description"]');
  if (meta) {
    meta.setAttribute(
      "content",
      `${p.name}, ${p.variants.map((v) => v.label).join(" or ")}, from ${M.config.storeName}. For laboratory research use only.`
    );
  }

  const index = M.products.indexOf(p);
  const prev = M.products[index - 1];
  const next = M.products[index + 1];

  const sizesHTML =
    p.variants.length > 1
      ? `<div>
           <span class="buy__label" id="strength-label">Strength</span>
           <div class="sizes" role="radiogroup" aria-labelledby="strength-label">
             ${p.variants
               .map(
                 (v) => `<label class="size"><input type="radio" name="size" value="${v.id}"${
                   v.id === selected ? " checked" : ""
                 }><span>${esc(v.label)}</span></label>`
               )
               .join("")}
           </div>
         </div>`
      : `<div>
           <span class="buy__label">Strength</span>
           <p class="sizes sizes--single"><span>${esc(p.variants[0].label)}</span></p>
         </div>`;

  const facts = [`<dt>Catalog no.</dt><dd>${p.no}</dd>`];
  if (p.aliases.length) facts.push(`<dt>Also listed as</dt><dd>${p.aliases.map(esc).join(", ")}</dd>`);
  if (p.variants.length > 1) {
    facts.push(
      `<dt>Sizes</dt><dd class="num">${p.variants.map((v) => `${esc(v.label)}, ${M.money(v.cents)}`).join("<br>")}</dd>`
    );
  }

  const pagerLink = (item, rel) =>
    item
      ? `<a class="pager__${rel}" href="${M.productURL(item)}">
           <span class="pager__label">${rel === "prev" ? "Previous" : "Next"}</span>
           <span class="pager__name">${esc(item.name)}</span>
         </a>`
      : "";

  root.innerHTML = `
    <nav class="crumbs wrap" aria-label="Breadcrumb">
      <a href="index.html#catalog">Catalog</a> <span aria-hidden="true">/</span>
      <span aria-current="page">${esc(p.name)}</span>
    </nav>

    <div class="product wrap">
      <div class="product__tile bracket bracket--ink" data-hero>
        <span class="product__no"><span class="visually-hidden">Catalog number </span>${p.no}</span>
        <h1 class="product__name ${M.fitClass(main)}">${esc(main)}${
    qual ? `<span class="product__qual">${esc(qual)}</span>` : ""
  }</h1>
      </div>

      <div class="buy">
        ${sizesHTML}
        <p class="buy__price" data-price></p>
        <p class="buy__incart" data-incart hidden></p>
        <div class="buy__row">
          <div class="qty" role="group" aria-label="Quantity">
            <button type="button" data-dec aria-label="One fewer">\u2212</button>
            <input type="number" inputmode="numeric" min="1" max="${MAX_QTY}" value="1" data-qty aria-label="Quantity">
            <button type="button" data-inc aria-label="One more">+</button>
          </div>
          <button class="btn btn--primary" type="button" data-add>Add to cart</button>
        </div>
        <p class="notice">For laboratory research use only. Not for human or veterinary use.
          <a href="policies.html#research-use">Read the research use policy</a>.</p>
        <dl class="facts">${facts.join("")}</dl>
      </div>
    </div>

    <div class="wrap">
      <nav class="pager" aria-label="More compounds">${pagerLink(prev, "prev")}${pagerLink(next, "next")}</nav>
    </div>`;

  const els = {
    hero: root.querySelector("[data-hero]"),
    price: root.querySelector("[data-price]"),
    incart: root.querySelector("[data-incart]"),
    qty: root.querySelector("[data-qty]"),
    dec: root.querySelector("[data-dec]"),
    inc: root.querySelector("[data-inc]"),
    add: root.querySelector("[data-add]"),
  };

  function renderPrice() {
    const v = M.variantById.get(selected);
    els.price.textContent = M.money(v.cents);
    els.add.setAttribute("aria-label", `Add ${p.name} ${v.label} to cart`);
  }

  function renderQty() {
    els.qty.value = String(qty);
    els.dec.disabled = qty <= 1;
    els.inc.disabled = qty >= MAX_QTY;
  }

  function renderInCart() {
    const inCart = p.variants.filter((v) => M.cart.qty(v.id) > 0);
    els.hero.classList.toggle("is-in-cart", inCart.length > 0);
    els.incart.hidden = !inCart.length;
    els.incart.textContent = inCart.length
      ? `In your cart: ${inCart.map((v) => `${v.label} \u00d7 ${M.cart.qty(v.id)}`).join(", ")}`
      : "";
  }

  root.addEventListener("change", (e) => {
    if (e.target.name === "size") {
      selected = e.target.value;
      renderPrice();
    }
  });

  els.qty.addEventListener("change", () => {
    const n = Math.floor(Number(els.qty.value));
    qty = n >= 1 ? Math.min(n, MAX_QTY) : 1;
    renderQty();
  });

  els.dec.addEventListener("click", () => {
    qty = Math.max(1, qty - 1);
    renderQty();
    if (els.dec.disabled) els.qty.focus();
  });

  els.inc.addEventListener("click", () => {
    qty = Math.min(MAX_QTY, qty + 1);
    renderQty();
  });

  els.add.addEventListener("click", () => {
    M.addToCart(selected, qty);
    qty = 1;
    renderQty();
  });

  window.addEventListener("cart:change", renderInCart);

  renderPrice();
  renderQty();
  renderInCart();
})();
