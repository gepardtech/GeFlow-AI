/**
 * Single source of truth for every currency GeFlow supports.
 * Used by admin settings, business categories, business setup and the
 * live FX conversion layer in `src/lib/currency.ts`.
 */
export interface CurrencyDef {
  code: string;
  name: string;
  symbol: string;
}

export const CURRENCIES: CurrencyDef[] = [
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "PKR", name: "Pakistani Rupee", symbol: "₨" },
  { code: "INR", name: "Indian Rupee", symbol: "₹" },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ" },
  { code: "SAR", name: "Saudi Riyal", symbol: "﷼" },
  { code: "QAR", name: "Qatari Riyal", symbol: "ر.ق" },
  { code: "KWD", name: "Kuwaiti Dinar", symbol: "د.ك" },
  { code: "BHD", name: "Bahraini Dinar", symbol: ".د.ب" },
  { code: "OMR", name: "Omani Rial", symbol: "ر.ع." },
  { code: "TRY", name: "Turkish Lira", symbol: "₺" },
  { code: "EGP", name: "Egyptian Pound", symbol: "E£" },
  { code: "NGN", name: "Nigerian Naira", symbol: "₦" },
  { code: "ZAR", name: "South African Rand", symbol: "R" },
  { code: "KES", name: "Kenyan Shilling", symbol: "KSh" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF " },
  { code: "SEK", name: "Swedish Krona", symbol: "kr" },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr" },
  { code: "DKK", name: "Danish Krone", symbol: "kr" },
  { code: "PLN", name: "Polish Zloty", symbol: "zł" },
  { code: "CZK", name: "Czech Koruna", symbol: "Kč" },
  { code: "RUB", name: "Russian Ruble", symbol: "₽" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "KRW", name: "South Korean Won", symbol: "₩" },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM" },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp" },
  { code: "THB", name: "Thai Baht", symbol: "฿" },
  { code: "PHP", name: "Philippine Peso", symbol: "₱" },
  { code: "VND", name: "Vietnamese Dong", symbol: "₫" },
  { code: "BDT", name: "Bangladeshi Taka", symbol: "৳" },
  { code: "LKR", name: "Sri Lankan Rupee", symbol: "Rs" },
  { code: "AFN", name: "Afghan Afghani", symbol: "؋" },
  { code: "BRL", name: "Brazilian Real", symbol: "R$" },
  { code: "MXN", name: "Mexican Peso", symbol: "MX$" },
  { code: "ARS", name: "Argentine Peso", symbol: "AR$" },
];

export const CURRENCY_CODES = CURRENCIES.map((c) => c.code);

export const CURRENCY_SYMBOLS: Record<string, string> = Object.fromEntries(
  CURRENCIES.map((c) => [c.code, c.symbol]),
);

export const currencySymbol = (code?: string | null) =>
  CURRENCY_SYMBOLS[(code ?? "USD").toUpperCase()] ?? `${(code ?? "USD").toUpperCase()} `;

export const currencyLabel = (code: string) => {
  const c = CURRENCIES.find((x) => x.code === code.toUpperCase());
  return c ? `${c.code} — ${c.name}` : code.toUpperCase();
};
