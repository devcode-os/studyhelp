// src/lib/caCatalog.js
// Zero dependencies on the rest of the Worker -- safe to import anywhere.
// Only real, file-backed items live here (8 months + 2 combined bundles).
// item_id is always the R2 filename minus ".pdf".
//
// "Individual" format bundles are NOT catalog entries -- they're a fixed
// discounted price for a specific set of real months, handled directly
// in createCaOrder()/handleWebhook() via INDIVIDUAL_BUNDLE_PRICES below,
// since their price isn't the sum of the parts.

export const CA_CATALOG = {
  "current-affairs-january-2026":  { itemType: "month", monthRange: "January 2026",  amountPaise: 9900 },
  "current-affairs-february-2026": { itemType: "month", monthRange: "February 2026", amountPaise: 9900 },
  "current-affairs-march-2026":    { itemType: "month", monthRange: "March 2026",    amountPaise: 9900 },
  "current-affairs-april-2026":    { itemType: "month", monthRange: "April 2026",    amountPaise: 9900 },
  "current-affairs-may-2026":      { itemType: "month", monthRange: "May 2026",      amountPaise: 9900 },
  "current-affairs-june-2026":     { itemType: "month", monthRange: "June 2026",     amountPaise: 9900 },
  "current-affairs-july-2026":     { itemType: "month", monthRange: "July 2026",     amountPaise: 9900 },
  "current-affairs-august-2026":   { itemType: "month", monthRange: "August 2026",   amountPaise: 9900 },
  "current-affairs-last3-jun-jul-aug-2026": {
    itemType: "bundle3",
    monthRange: "June, July, August 2026",
    amountPaise: 19900,
  },
  "current-affairs-last6-mar-apr-may-jun-jul-aug-2026": {
    itemType: "bundle6",
    monthRange: "March \u2013 August 2026",
    amountPaise: 29900,
  },
};

// Fixed discount price for "Individual" format bundles (3 or 6 real
// months, each granted separately, at a flat bundle price instead of
// the sum of individual month prices).
export const INDIVIDUAL_BUNDLE_PRICES = { 3: 19900, 6: 29900 };

export function getCaR2Key(itemId) {
  return `${itemId}.pdf`;
}
