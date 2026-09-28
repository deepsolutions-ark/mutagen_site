/*
 * Mutagen store settings.
 * Edit the values below; every page reads from this file.
 */
window.MUTAGEN_CONFIG = {
  storeName: "Mutagen",

  // Where customers can reach you. Also used as the fallback order address.
  email: "orders@example.com",

  // Paste your Formspree (or similar) form endpoint here to receive orders,
  // e.g. "https://formspree.io/f/abcdwxyz". Leave it empty and checkout will
  // open the customer's email app with the order filled in instead.
  orderEndpoint: "",

  currency: "USD",
  locale: "en-US",

  // Visitors confirm their age once before browsing, and again at checkout.
  showAgeGate: true,
  minAge: 21,

  shipping: {
    flatRate: 10.0,   // charged per order
    freeOver: 200.0,  // order subtotal for free shipping; set to null to turn off
    processingDays: 2, // business days to ship after payment clears
    countries: ["United States"],
  },

  returnWindowDays: 7,

  // Shown under the checkout button and on the confirmation screen.
  paymentNote:
    "No payment is taken on this page. We'll email you to confirm your order, the final total and how to pay.",

  disclaimer:
    "For Research Use Only. Products are intended solely for laboratory research. Not for human consumption, medical, or veterinary use. Not intended to diagnose, treat, cure, or prevent any disease.",
};
