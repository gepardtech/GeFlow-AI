import { useEffect, useState } from "react";
import { usePlatformSettings } from "@/components/PlatformSettingsProvider";
import { supabase } from "@/integrations/supabase/client";
import { CURRENCY_SYMBOLS } from "@/lib/currencies";

export { CURRENCY_SYMBOLS };

export const currencySymbol = (code?: string | null) =>
  CURRENCY_SYMBOLS[(code ?? "USD").toUpperCase()] ?? `${(code ?? "USD").toUpperCase()} `;

const LS_KEY = "geflow.activeBusinessId";
const RATES_KEY = "geflow.fxRates";
const RATES_TTL = 30 * 60 * 1000; // 30 minutes

/* ------------------------------------------------------------------ *
 * Live FX rates (USD base) fetched from the currency-rates function.
 * Money is stored in each record's original currency; the display layer
 * converts live so switching a currency updates every price instantly.
 * ------------------------------------------------------------------ */
type Rates = Record<string, number>;
let rates: Rates = (() => {
  try {
    const raw = localStorage.getItem(RATES_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed?.rates && Date.now() - parsed.at < RATES_TTL) return parsed.rates as Rates;
  } catch { /* ignore */ }
  return { USD: 1 };
})();
let ratesStarted = false;
const rateSubs = new Set<() => void>();
const emitRates = () => rateSubs.forEach((fn) => fn());

const loadRates = async () => {
  try {
    const { data, error } = await supabase.functions.invoke("currency-rates");
    if (!error && data?.rates && Object.keys(data.rates).length > 1) {
      rates = data.rates as Rates;
      localStorage.setItem(RATES_KEY, JSON.stringify({ at: Date.now(), rates }));
      emitRates();
    }
  } catch { /* offline — keep cached rates */ }
};

const startRates = () => {
  if (ratesStarted) return;
  ratesStarted = true;
  loadRates();
  setInterval(loadRates, RATES_TTL);
};

/** Live USD -> code rate (1 when unknown). */
export const fxRate = (code: string) => {
  const r = rates[(code ?? "USD").toUpperCase()];
  return Number.isFinite(r) && r > 0 ? r : 1;
};

/** Convert an amount between any two supported currencies at live rates. */
export const fxConvert = (amount: number, from: string, to: string) => {
  const f = fxRate(from);
  const t = fxRate(to);
  if (!f) return Number(amount || 0);
  return (Number(amount || 0) / f) * t;
};

const useRates = () => {
  const [, force] = useState(0);
  useEffect(() => {
    startRates();
    const fn = () => force((n) => n + 1);
    rateSubs.add(fn);
    return () => { rateSubs.delete(fn); };
  }, []);
};

/* ------------------------------------------------------------------ *
 * Shared active-business currency store.
 * `baseCurrency` is the currency the business data was recorded in;
 * `currency` is what the owner/admin wants to see it in today.
 * ------------------------------------------------------------------ */
type BizMoney = { currency: string | null; baseCurrency: string | null; taxRate: number | null };
let cache: BizMoney = { currency: null, baseCurrency: null, taxRate: null };
let started = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((fn) => fn());

const loadBusinessMoney = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { cache = { currency: null, baseCurrency: null, taxRate: null }; emit(); return; }
    
    const userMeta = user.user_metadata || {};
    const userCurrency = userMeta.user_currency || null;
    const userTax = userMeta.user_default_tax !== undefined && userMeta.user_default_tax !== null ? Number(userMeta.user_default_tax) : null;

    const { data } = await supabase
      .from("businesses")
      .select("id, currency, base_currency, default_tax, category_id, created_at")
      .eq("owner_user_id", user.id)
      .order("created_at", { ascending: true });
    const rows = data ?? [];
    const saved = localStorage.getItem(LS_KEY);
    const row = rows.find((r: any) => r.id === saved) ?? rows[0];

    if (row) {
      let catCurrency: string | null = null;
      let catTax: number | null = null;
      if ((row as any).category_id) {
        const { data: cat } = await supabase
          .from("business_categories")
          .select("currency, default_tax")
          .eq("id", (row as any).category_id)
          .maybeSingle();
        if (cat) {
          catCurrency = cat.currency ?? null;
          catTax = cat.default_tax !== undefined && cat.default_tax !== null ? Number(cat.default_tax) : null;
        }
      }

      const effectiveCurrency = (row as any).currency || userCurrency || catCurrency || (row as any).base_currency || "USD";
      const effectiveBaseCurrency = effectiveCurrency;
      const effectiveTax = (row as any).default_tax !== undefined && (row as any).default_tax !== null
        ? Number((row as any).default_tax)
        : (userTax !== null ? userTax : (catTax !== null ? catTax : 0));

      cache = {
        currency: effectiveCurrency,
        baseCurrency: effectiveBaseCurrency,
        taxRate: effectiveTax,
      };
    } else {
      const fallbackCur = userCurrency || "USD";
      cache = {
        currency: fallbackCur,
        baseCurrency: fallbackCur,
        taxRate: userTax ?? 0,
      };
    }
  } catch (err) {
    console.warn("Failed to load business currency:", err);
  }
  emit();
};

const startBusinessMoney = () => {
  if (started) return;
  started = true;
  loadBusinessMoney();
  window.addEventListener("geflow:business-changed", loadBusinessMoney);
  window.addEventListener("geflow:business-updated", loadBusinessMoney);
  window.addEventListener("geflow:currency-changed", loadBusinessMoney);
  supabase.auth.onAuthStateChange(() => loadBusinessMoney());
  supabase
    .channel(`business_currency_rt_${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "businesses" }, () => loadBusinessMoney())
    .on("postgres_changes", { event: "*", schema: "public", table: "business_categories" }, () => loadBusinessMoney())
    .subscribe();
  // Safety net so a change is never more than a few seconds stale.
  setInterval(loadBusinessMoney, 15000);
};

export const refreshBusinessMoney = async () => {
  await loadBusinessMoney();
};

/** Currency + tax of the active business (null when signed out / no business). */
export const useBusinessMoney = (): BizMoney => {
  const [state, setState] = useState<BizMoney>(cache);
  useEffect(() => {
    startBusinessMoney();
    const fn = () => setState({ ...cache });
    subs.add(fn);
    fn();
    return () => { subs.delete(fn); };
  }, []);
  return state;
};

export interface MoneyOptions {
  /**
   * "auto"     – use the active business currency for business records without USD conversion (default)
   * "platform" – always converts from platform base USD currency (landing pricing, checkout, subscriptions)
   */
  scope?: "auto" | "platform";
}

/**
 * Reactive money + tax helpers.
 * Platform scope converts platform plan USD pricing to chosen currency.
 * Auto / business scope formats native store data (products, POS, inventory) directly in the business currency.
 */
export const useMoney = (options: MoneyOptions = {}) => {
  const { scope = "auto" } = options;
  const { settings } = usePlatformSettings();
  const biz = useBusinessMoney();
  useRates();

  const platformCode = ((settings?.base_currency as string) ?? "USD").toUpperCase();
  const code = scope === "platform" ? platformCode : (biz.currency ?? platformCode).toUpperCase();
  const sym = currencySymbol(code);

  const platformTax = Number(settings?.universal_tax ?? 0);
  const taxRate = scope === "platform" ? platformTax : (biz.taxRate ?? platformTax);

  const invoicePrefix = ((settings?.invoice_prefix as string) ?? "INV").trim().replace(/-+$/, "") || "INV";

  /**
   * For platform scope (e.g. subscription pricing tiers authored in USD):
   * We convert from USD to the selected currency.
   * For business/store operations (products, inventory, POS sales, carts, purchases):
   * Numbers are authored directly in the store's currency (e.g. 20 PKR is 20 PKR, not converted).
   */
  const isPlatform = scope === "platform";
  const rate = isPlatform ? (fxRate(code) / (fxRate("USD") || 1)) : 1;
  const convert = (n: number) => (isPlatform ? Number(n || 0) * rate : Number(n || 0));

  const decimals = 2;

  const format = (n: number) =>
    `${sym}${convert(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  /** Price formatting with fixed decimals (pricing tables, checkout). */
  const price = (n: number) =>
    `${sym}${convert(n).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;

  /** Build an invoice number using the platform prefix, e.g. GF-8FA3C1. */
  const invoiceNo = (seed?: string) => {
    const tail = (seed ?? Date.now().toString()).replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase();
    return `${invoicePrefix}-${tail}`;
  };

  return { currency: code, symbol: sym, taxRate, rate, convert, invoicePrefix, invoiceNo, format, price };
};
