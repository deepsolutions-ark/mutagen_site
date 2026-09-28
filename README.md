# Mutagen storefront

A static storefront for the Mutagen research peptide catalog: 47 compounds in 64 sizes, a cart, a checkout that sends order requests, and a policies page. It's plain HTML, CSS and JavaScript, so there's no build step and nothing to install.

## Run it locally

Open the folder in VS Code, install the **Live Server** extension, then right-click `index.html` and choose **Open with Live Server**.

Or, from a terminal in this folder:

```
python3 -m http.server 8000
```

and open http://localhost:8000.

## What's in the folder

```
index.html          Home page and catalog (tile and list views, search, sort)
product.html        Product page, e.g. product.html?p=bpc-157
checkout.html       Order summary, shipping details and research-use confirmation
policies.html       Research use, terms, shipping, returns, privacy, contact
404.html            "Page not found" page
assets/css/styles.css
assets/js/config.js    Store settings (edit this first)
assets/js/products.js  The catalog
assets/js/app.js       Cart, header, footer, cart drawer, age check
assets/js/catalog.js   Home page catalog
assets/js/product.js   Product page
assets/js/checkout.js  Checkout and order sending
assets/img/            Logo, favicons
assets/fonts/          Archivo variable font (SIL Open Font License, see OFL.txt)
```

## Make it yours

**Settings.** Everything store-wide lives in `assets/js/config.js`: your email address, the order endpoint (below), minimum age, flat shipping rate and free-shipping threshold, processing days, return window, and the research-use disclaimer. The pages read these values, so you change them once.

**Products.** Edit `assets/js/products.js`. Each entry looks like this:

```js
{ name: "BPC-157", sizes: [["5mg", 7.0], ["10mg", 9.75]] },
```

`aliases` is optional and adds other names people search for (shown on the product page as "Also listed as"). Catalog numbers follow the list order; add `no: 12` to a product to pin its number. Search ignores capitals, spaces and hyphens, so "bpc157" finds BPC-157.

**Logo.** `assets/img/mutagen-mark.svg` is a vector version of your logo, traced from the PNG you supplied, so it stays sharp at any size. `mutagen-logo.png` is a 1024px transparent PNG of the same mark, and the favicon and app icon files are made from it.

**Policies.** `policies.html` is starter text in plain language. Replace anything that doesn't match how you run the business, and have a lawyer review it before launch.

## Receiving orders

Checkout collects contact and shipping details plus three required confirmations (age, research use only, agreement to the policies), then sends you an order request with a number like `MG-260926-P3UK`. No payment is taken on the site; you reply to confirm the order, the final total and how to pay.

- **No endpoint set:** checkout opens the customer's email app with the order filled in, addressed to `email` in `config.js`. Fine for testing.
- **Formspree (recommended):** create a free form at formspree.io, copy its endpoint (`https://formspree.io/f/...`) into `orderEndpoint` in `config.js`, and each order arrives in your inbox with every field plus a plain-text summary. Any service that accepts a JSON POST works the same way.

Many mainstream payment processors restrict peptide and research-chemical sales, so check a processor's terms before you apply to connect one.

## Publishing

Push the folder to a GitHub repository:

```
git init
git add .
git commit -m "Mutagen storefront"
git branch -M main
git remote add origin https://github.com/YOUR-NAME/mutagen.git
git push -u origin main
```

GitHub Pages doesn't allow e-commerce sites, so host the live store with a static host that deploys from GitHub and permits commercial sites, such as Netlify or Cloudflare Pages. There's no build command; the publish directory is the repository root. Read the host's acceptable-use terms for your product category before you launch.

## Notes

- The cart and the age confirmation are stored in the visitor's browser (`localStorage`). Clearing site data resets both.
- The site doesn't load anything from third parties except the order endpoint you set, and it doesn't use tracking cookies. If you add analytics, update the privacy section.
- Colors and type sizes are CSS custom properties at the top of `styles.css`.
