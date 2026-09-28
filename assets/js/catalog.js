/* Mutagen catalog: search, sort, tiles or list, add to cart. */
(function () {
  "use strict";

  const M = window.Mutagen;
  const root = document.querySelector("[data-catalog]");
  if (!M || !root) return;

  const els = {
    search: root.querySelector("[data-search]"),
    sort: root.querySelector("[data-sort]"),
    views: root.querySelectorAll("[data-view]"),
    results: root.querySelector("[data-results]"),
    count: root.querySelector("[data-count]"),
    status: root.querySelector("[data-status]"),
  };

  const VIEW_KEY = "mutagen.view.v1";
  const SORTS = ["catalog", "price-asc", "price-desc"];
  const params = new URLSearchParams(window.location.search);

  const state = {
    q: params.get("q") || "",
    sort: SORTS.includes(params.get("sort")) ? params.get("sort") : "catalog",
    view: M.store.get(VIEW_KEY) === "list" ? "list" : "tiles",
    selected: {}, // product slug -> chosen variant id
  };

  const totalSizes = M.products.reduce((n, p) => n + p.variants.length, 0);
  const minPrice = (p) => Math.min(...p.variants.map((v) => v.cents));
  const maxPrice = (p) => Math.max(...p.variants.map((v) => v.cents));
  const selectedVariant = (p) => M.variantById.get(state.selected[p.slug]) || p.variants[0];
  const addLabel = (p, v) => `Add ${p.name} ${v.label} to cart`;

  function visibleProducts() {
    const q = M.normalize(state.q);
    const list = M.products.filter((p) => !q || p.terms.some((t) => t.includes(q)));
    if (state.sort === "price-asc") list.sort((a, b) => minPrice(a) - minPrice(b) || a.no - b.no);
    if (state.sort === "price-desc") list.sort((a, b) => maxPrice(b) - maxPrice(a) || a.no - b.no);
    return list;
  }

  /* ---------- tiles ---------- */

  function inCartHTML(n) {
    return n ? `<span class="tile__incart">${n} in cart</span>` : "";
  }

  function tileHTML(p) {
    const { main, qual } = M.splitName(p.name);
    const v = selectedVariant(p);
    const qty = M.cart.productQty(p);
    const sizes =
      p.variants.length > 1
        ? `<fieldset class="sizes">
             <legend class="visually-hidden">Strength of ${M.esc(p.name)}</legend>
             ${p.variants
               .map(
                 (x) => `<label class="size"><input type="radio" name="size-${p.slug}" value="${x.id}"${
                   x.id === v.id ? " checked" : ""
                 }><span>${M.esc(x.label)}</span></label>`
               )
               .join("")}
           </fieldset>`
        : `<p class="sizes sizes--single"><span>${M.esc(v.label)}</span></p>`;

    return `
      <li class="tile bracket${qty ? " is-in-cart" : ""}" data-slug="${p.slug}">
        <div class="tile__top">
          <span class="tile__no"><span class="visually-hidden">Catalog number </span>${p.no}</span>
          ${inCartHTML(qty)}
        </div>
        <h3 class="tile__name ${M.fitClass(main)}">
          <a href="${M.productURL(p)}">${M.esc(main)}${qual ? `<span class="tile__qual">${M.esc(qual)}</span>` : ""}</a>
        </h3>
        ${sizes}
        <div class="tile__buy">
          <span class="tile__price" data-price>${M.money(v.cents)}</span>
          <button class="btn btn--add" type="button" data-add="${v.id}" aria-label="${M.esc(addLabel(p, v))}">Add</button>
        </div>
      </li>`;
  }

  /* ---------- list ---------- */

  function listHTML(list) {
    const rows = [];
    list.forEach((p) => p.variants.forEach((v) => rows.push({ p, v })));
    if (state.sort === "price-asc") rows.sort((a, b) => a.v.cents - b.v.cents || a.p.no - b.p.no);
    if (state.sort === "price-desc") rows.sort((a, b) => b.v.cents - a.v.cents || a.p.no - b.p.no);

    const body = rows
      .map(({ p, v }) => {
        const q = M.cart.qty(v.id);
        return `
          <tr data-variant="${v.id}"${q ? ' class="is-in-cart"' : ""}>
            <td class="col-no">${p.no}</td>
            <td class="col-name"><a href="${M.productURL(p, v)}">${M.esc(p.name)}</a></td>
            <td class="num">${M.esc(v.label)}</td>
            <td class="col-price">${M.money(v.cents)}</td>
            <td class="col-add">${q ? `<span class="incart">${q} in cart</span>` : ""}<button class="btn btn--add" type="button" data-add="${v.id}" aria-label="${M.esc(addLabel(p, v))}">Add</button></td>
          </tr>`;
      })
      .join("");

    return `
      <div class="pricelist-wrap">
        <table class="pricelist">
          <caption class="visually-hidden">Price list</caption>
          <thead>
            <tr>
              <th scope="col" class="col-no">No.</th>
              <th scope="col">Product</th>
              <th scope="col">Strength</th>
              <th scope="col" class="col-price">Price</th>
              <th scope="col" class="col-add"><span class="visually-hidden">Add to cart</span></th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>`;
  }

  /* ---------- render ---------- */

  function emptyHTML() {
    return `
      <div class="empty">
        <p>No compounds match \u201c${M.esc(state.q)}\u201d. Check the spelling, or search by code, like BPC-157 or TB-500.</p>
        <button class="btn" type="button" data-clear>Clear search</button>
      </div>`;
  }

  function render() {
    const list = visibleProducts();
    const n = list.length;

    els.count.textContent = state.q
      ? `${n} of ${M.products.length} compounds`
      : `${M.products.length} compounds in ${totalSizes} sizes`;

    if (!n) els.results.innerHTML = emptyHTML();
    else if (state.view === "list") els.results.innerHTML = listHTML(list);
    else els.results.innerHTML = `<ul class="tiles">${list.map(tileHTML).join("")}</ul>`;

    els.views.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === state.view)));

    els.status.textContent = state.q
      ? n
        ? `${n} ${n === 1 ? "compound matches" : "compounds match"} \u201c${state.q}\u201d.`
        : `No compounds match \u201c${state.q}\u201d.`
      : "";
  }

  function syncURL() {
    const next = new URLSearchParams();
    if (state.q) next.set("q", state.q);
    if (state.sort !== "catalog") next.set("sort", state.sort);
    const qs = next.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`);
  }

  // Reflect cart changes without re-rendering, so focus stays where it is.
  function syncCartState() {
    els.results.querySelectorAll(".tile").forEach((tile) => {
      const p = M.productBySlug.get(tile.dataset.slug);
      const n = M.cart.productQty(p);
      tile.classList.toggle("is-in-cart", n > 0);
      const top = tile.querySelector(".tile__top");
      const badge = top.querySelector(".tile__incart");
      if (n && badge) badge.textContent = `${n} in cart`;
      else if (n) top.insertAdjacentHTML("beforeend", inCartHTML(n));
      else if (badge) badge.remove();
    });

    els.results.querySelectorAll("tr[data-variant]").forEach((row) => {
      const q = M.cart.qty(row.dataset.variant);
      row.classList.toggle("is-in-cart", q > 0);
      const cell = row.querySelector(".col-add");
      const badge = cell.querySelector(".incart");
      if (q && badge) badge.textContent = `${q} in cart`;
      else if (q) cell.insertAdjacentHTML("afterbegin", `<span class="incart">${q} in cart</span>`);
      else if (badge) badge.remove();
    });
  }

  /* ---------- events ---------- */

  els.search.value = state.q;
  els.sort.value = state.sort;

  els.search.addEventListener("input", () => {
    state.q = els.search.value.trim();
    render();
    syncURL();
  });

  els.sort.addEventListener("change", () => {
    state.sort = els.sort.value;
    render();
    syncURL();
  });

  els.views.forEach((btn) =>
    btn.addEventListener("click", () => {
      if (state.view === btn.dataset.view) return;
      state.view = btn.dataset.view;
      M.store.set(VIEW_KEY, state.view);
      render();
    })
  );

  els.results.addEventListener("change", (e) => {
    const radio = e.target.closest('input[type="radio"]');
    if (!radio) return;
    const tile = radio.closest(".tile");
    const p = M.productBySlug.get(tile.dataset.slug);
    const v = M.variantById.get(radio.value);
    state.selected[p.slug] = v.id;
    tile.querySelector("[data-price]").textContent = M.money(v.cents);
    const add = tile.querySelector("[data-add]");
    add.dataset.add = v.id;
    add.setAttribute("aria-label", addLabel(p, v));
  });

  els.results.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    if (add) {
      M.addToCart(add.dataset.add, 1);
      return;
    }
    if (e.target.closest("[data-clear]")) {
      state.q = "";
      els.search.value = "";
      render();
      syncURL();
      els.search.focus();
    }
  });

  // Press "/" anywhere to jump to search.
  document.addEventListener("keydown", (e) => {
    if (e.key !== "/" || e.defaultPrevented) return;
    const t = e.target;
    if (t.closest("input, textarea, select, [contenteditable], dialog[open]")) return;
    e.preventDefault();
    els.search.focus();
  });

  window.addEventListener("cart:change", syncCartState);

  render();
})();
