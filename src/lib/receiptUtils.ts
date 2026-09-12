/**
 * Professional Receipt & Invoice ID generator and normalizer.
 */

/**
 * Generates a clean, professional Invoice / Receipt Number.
 * Example: GEF-ARCH-5SWQ88
 */
export function generateProfessionalReceiptNo(businessName?: string, seed?: string): string {
  // Extract clean 4-letter mnemonic from store name
  let mnemonic = "ARCH";
  if (businessName) {
    const cleanWords = businessName.replace(/[^a-zA-Z0-9\s]/g, "").trim().split(/\s+/).filter(Boolean);
    if (cleanWords.length >= 2) {
      mnemonic = (cleanWords[0].slice(0, 2) + cleanWords[1].slice(0, 2)).toUpperCase();
    } else if (cleanWords[0] && cleanWords[0].length >= 4) {
      mnemonic = cleanWords[0].slice(0, 4).toUpperCase();
    } else if (cleanWords[0]) {
      mnemonic = cleanWords[0].toUpperCase();
    }
  }

  if (mnemonic.length < 4) {
    mnemonic = (mnemonic + "ARCH").slice(0, 4);
  }

  // 6-character uppercase alphanumeric entropy tail
  let tail = "";
  if (seed) {
    const cleanSeed = seed.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    tail = cleanSeed.slice(-6);
  }

  if (!tail || tail.length < 6) {
    const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // avoid ambiguous 0/O, 1/I
    let rand = "";
    for (let i = 0; i < 6; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    tail = rand;
  }

  return `GEF-${mnemonic}-${tail}`;
}

/**
 * Normalizes any receipt/invoice query string.
 * Strips "RECEIPT #:", "RECEIPT#", "INVOICE #:", "SLIP #:", "INV-", leading "#", etc.
 */
export function normalizeReceiptQuery(query: string): string {
  if (!query) return "";
  return query
    .trim()
    .replace(/^(receipt|invoice|slip|voucher|bill)\s*#?\s*:?\s*/i, "")
    .replace(/^#+/, "")
    .trim();
}
