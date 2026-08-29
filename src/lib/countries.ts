export interface CountryDef {
  code: string;
  name: string;
  currency: string;
  phoneCode: string;
  flag: string;
}

export const COUNTRIES: CountryDef[] = [
  { code: "US", name: "United States", currency: "USD", phoneCode: "+1", flag: "🇺🇸" },
  { code: "GB", name: "United Kingdom", currency: "GBP", phoneCode: "+44", flag: "🇬🇧" },
  { code: "AE", name: "United Arab Emirates", currency: "AED", phoneCode: "+971", flag: "🇦🇪" },
  { code: "SA", name: "Saudi Arabia", currency: "SAR", phoneCode: "+966", flag: "🇸🇦" },
  { code: "CA", name: "Canada", currency: "CAD", phoneCode: "+1", flag: "🇨🇦" },
  { code: "AU", name: "Australia", currency: "AUD", phoneCode: "+61", flag: "🇦🇺" },
  { code: "DE", name: "Germany", currency: "EUR", phoneCode: "+49", flag: "🇩🇪" },
  { code: "FR", name: "France", currency: "EUR", phoneCode: "+33", flag: "🇫🇷" },
  { code: "IT", name: "Italy", currency: "EUR", phoneCode: "+39", flag: "🇮🇹" },
  { code: "ES", name: "Spain", currency: "EUR", phoneCode: "+34", flag: "🇪🇸" },
  { code: "NL", name: "Netherlands", currency: "EUR", phoneCode: "+31", flag: "🇳🇱" },
  { code: "CH", name: "Switzerland", currency: "CHF", phoneCode: "+41", flag: "🇨🇭" },
  { code: "SE", name: "Sweden", currency: "SEK", phoneCode: "+46", flag: "🇸🇪" },
  { code: "NO", name: "Norway", currency: "NOK", phoneCode: "+47", flag: "🇳🇴" },
  { code: "DK", name: "Denmark", currency: "DKK", phoneCode: "+45", flag: "🇩🇰" },
  { code: "IE", name: "Ireland", currency: "EUR", phoneCode: "+353", flag: "🇮🇪" },
  { code: "NZ", name: "New Zealand", currency: "NZD", phoneCode: "+64", flag: "🇳🇿" },
  { code: "SG", name: "Singapore", currency: "SGD", phoneCode: "+65", flag: "🇸🇬" },
  { code: "MY", name: "Malaysia", currency: "MYR", phoneCode: "+60", flag: "🇲🇾" },
  { code: "ID", name: "Indonesia", currency: "IDR", phoneCode: "+62", flag: "🇮🇩" },
  { code: "TH", name: "Thailand", currency: "THB", phoneCode: "+66", flag: "🇹🇭" },
  { code: "PH", name: "Philippines", currency: "PHP", phoneCode: "+63", flag: "🇵🇭" },
  { code: "VN", name: "Vietnam", currency: "VND", phoneCode: "+84", flag: "🇻🇳" },
  { code: "JP", name: "Japan", currency: "JPY", phoneCode: "+81", flag: "🇯🇵" },
  { code: "KR", name: "South Korea", currency: "KRW", phoneCode: "+82", flag: "🇰🇷" },
  { code: "CN", name: "China", currency: "CNY", phoneCode: "+86", flag: "🇨🇳" },
  { code: "HK", name: "Hong Kong", currency: "HKD", phoneCode: "+852", flag: "🇭🇰" },
  { code: "IN", name: "India", currency: "INR", phoneCode: "+91", flag: "🇮🇳" },
  { code: "PK", name: "Pakistan", currency: "PKR", phoneCode: "+92", flag: "🇵🇰" },
  { code: "BD", name: "Bangladesh", currency: "BDT", phoneCode: "+880", flag: "🇧🇩" },
  { code: "LK", name: "Sri Lanka", currency: "LKR", phoneCode: "+94", flag: "🇱🇰" },
  { code: "TR", name: "Turkey", currency: "TRY", phoneCode: "+90", flag: "🇹🇷" },
  { code: "QA", name: "Qatar", currency: "QAR", phoneCode: "+974", flag: "🇶🇦" },
  { code: "KW", name: "Kuwait", currency: "KWD", phoneCode: "+965", flag: "🇰🇼" },
  { code: "BH", name: "Bahrain", currency: "BHD", phoneCode: "+973", flag: "🇧🇭" },
  { code: "OM", name: "Oman", currency: "OMR", phoneCode: "+968", flag: "🇴🇲" },
  { code: "EG", name: "Egypt", currency: "EGP", phoneCode: "+20", flag: "🇪🇬" },
  { code: "NG", name: "Nigeria", currency: "NGN", phoneCode: "+234", flag: "🇳🇬" },
  { code: "ZA", name: "South Africa", currency: "ZAR", phoneCode: "+27", flag: "🇿🇦" },
  { code: "KE", name: "Kenya", currency: "KES", phoneCode: "+254", flag: "🇰🇪" },
  { code: "BR", name: "Brazil", currency: "BRL", phoneCode: "+55", flag: "🇧🇷" },
  { code: "MX", name: "Mexico", currency: "MXN", phoneCode: "+52", flag: "🇲🇽" },
  { code: "AR", name: "Argentina", currency: "ARS", phoneCode: "+54", flag: "🇦🇷" },
  { code: "CL", name: "Chile", currency: "CLP", phoneCode: "+56", flag: "🇨🇱" },
  { code: "CO", name: "Colombia", currency: "COP", phoneCode: "+57", flag: "🇨🇴" },
];

/**
 * Detects the most appropriate country and default international phone dial code
 * based on registered business address, country field, or currency code.
 */
export function detectDefaultCountry(options?: {
  country?: string | null;
  address?: string | null;
  currency?: string | null;
}): CountryDef {
  const defaultFallback = COUNTRIES[0]; // US (+1)

  if (!options) return defaultFallback;

  const rawCountry = (options.country ?? "").trim().toLowerCase();
  const rawAddress = (options.address ?? "").trim().toLowerCase();
  const rawCurrency = (options.currency ?? "").trim().toUpperCase();

  // 1. Direct match by country code or name
  if (rawCountry) {
    const direct = COUNTRIES.find(
      (c) =>
        c.code.toLowerCase() === rawCountry ||
        c.name.toLowerCase() === rawCountry ||
        rawCountry.includes(c.name.toLowerCase()) ||
        rawCountry.includes(c.code.toLowerCase())
    );
    if (direct) return direct;
  }

  // 2. Scan registered address string for country names or major cities
  if (rawAddress) {
    for (const c of COUNTRIES) {
      if (
        rawAddress.includes(c.name.toLowerCase()) ||
        new RegExp(`\\b${c.code.toLowerCase()}\\b`, "i").test(rawAddress)
      ) {
        return c;
      }
    }

    // Common international cities heuristic
    if (/london|manchester|birmingham|edinburgh/i.test(rawAddress)) return COUNTRIES.find((c) => c.code === "GB")!;
    if (/dubai|abu dhabi|sharjah|ajman/i.test(rawAddress)) return COUNTRIES.find((c) => c.code === "AE")!;
    if (/riyadh|jeddah|dammam|mecca|medina/i.test(rawAddress)) return COUNTRIES.find((c) => c.code === "SA")!;
    if (/toronto|vancouver|montreal|calgary/i.test(rawAddress)) return COUNTRIES.find((c) => c.code === "CA")!;
    if (/sydney|melbourne|brisbane|perth/i.test(rawAddress)) return COUNTRIES.find((c) => c.code === "AU")!;
    if (/berlin|munich|frankfurt|hamburg/i.test(rawAddress)) return COUNTRIES.find((c) => c.code === "DE")!;
    if (/paris|marseille|lyon/i.test(rawAddress)) return COUNTRIES.find((c) => c.code === "FR")!;
    if (/singapore/i.test(rawAddress)) return COUNTRIES.find((c) => c.code === "SG")!;
    if (/tokyo|osaka/i.test(rawAddress)) return COUNTRIES.find((c) => c.code === "JP")!;
    if (/karachi|lahore|islamabad|rawalpindi|faisalabad/i.test(rawAddress)) return COUNTRIES.find((c) => c.code === "PK")!;
    if (/mumbai|delhi|bangalore|hyderabad/i.test(rawAddress)) return COUNTRIES.find((c) => c.code === "IN")!;
    if (/new york|california|texas|florida|los angeles|chicago/i.test(rawAddress)) return COUNTRIES.find((c) => c.code === "US")!;
  }

  // 3. Match by currency code
  if (rawCurrency) {
    const byCurr = COUNTRIES.find((c) => c.currency === rawCurrency);
    if (byCurr) return byCurr;
  }

  return defaultFallback;
}

export const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Amsterdam",
  "Europe/Istanbul",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Riyadh",
  "Asia/Qatar",
  "Asia/Kuwait",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Africa/Cairo",
  "Africa/Lagos",
  "Africa/Johannesburg",
  "Africa/Nairobi",
];
