import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Building2,
  Receipt,
  Bell,
  Sliders,
  Percent,
  Check,
  Save,
  RefreshCw,
  Upload,
  Image as ImageIcon,
  Smartphone,
  Printer,
  Volume2,
  VolumeX,
  AlertTriangle,
  Mail,
  ShieldCheck,
  Globe,
  Sun,
  Moon,
  Sparkles,
  Layers,
  HelpCircle,
  Plus,
  Trash2,
  DollarSign,
  Calculator,
  Scan,
  Store,
  Info,
  Clock,
  MapPin,
  Phone,
  Hash,
  FileSpreadsheet,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { useTheme } from "next-themes";
import UserPanelGate from "@/components/UserPanelGate";
import { useActiveBusiness } from "@/hooks/useActiveBusiness";
import { usePlatformSettings } from "@/components/PlatformSettingsProvider";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CURRENCIES } from "@/lib/currencies";
import { refreshBusinessMoney } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type SettingsTab = "info" | "pos" | "alert" | "preference" | "tax";

interface TaxBracket {
  id: string;
  name: string;
  rate: number;
  type: "standard" | "reduced" | "zero" | "exempt";
  isDefault?: boolean;
}

export const UserSettings = () => {
  const { theme, setTheme } = useTheme();
  const { active, activeBusiness, categorySettings, categoryName, refresh: refreshActiveBusiness } = useActiveBusiness();
  const { settings: platformSettings } = usePlatformSettings();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<SettingsTab>("info");
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------------
  // 1. INFO TAB STATE
  // ---------------------------------------------------------------------------
  const [businessName, setBusinessName] = useState("");
  const [businessTagline, setBusinessTagline] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [timezone, setTimezone] = useState("UTC");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // 2. POS TAB STATE
  // ---------------------------------------------------------------------------
  const [receiptHeader, setReceiptHeader] = useState("GeFlow Smart Retail POS");
  const [receiptSubheader, setReceiptSubheader] = useState("Official Store Receipt & Fiscal Log");
  const [receiptFooter, setReceiptFooter] = useState("Thank you for choosing us! Returns accepted within 14 days.");
  const [showLogoOnReceipt, setShowLogoOnReceipt] = useState(true);
  const [showTaxBreakdown, setShowTaxBreakdown] = useState(true);
  const [showCashierName, setShowCashierName] = useState(true);
  const [showBarcodeOnReceipt, setShowBarcodeOnReceipt] = useState(true);
  const [autoPrintReceipt, setAutoPrintReceipt] = useState(false);
  const [posSoundEffects, setPosSoundEffects] = useState(true);
  const [openDrawerOnCash, setOpenDrawerOnCash] = useState(true);
  const [scannerMode, setScannerMode] = useState<"hardware" | "camera" | "keyboard">("hardware");
  const [quickAmounts, setQuickAmounts] = useState("10, 20, 50, 100");
  const [defaultCustomerType, setDefaultCustomerType] = useState<"walkin" | "member">("walkin");

  // ---------------------------------------------------------------------------
  // 3. ALERT TAB STATE
  // ---------------------------------------------------------------------------
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(10);
  const [outOfStockNotify, setOutOfStockNotify] = useState(true);
  const [expiryWarningDays, setExpiryWarningDays] = useState<number>(30);
  const [highReturnAlert, setHighReturnAlert] = useState(true);
  const [inAppAlerts, setInAppAlerts] = useState(true);
  const [emailDigestFrequency, setEmailDigestFrequency] = useState<"instant" | "daily" | "weekly" | "off">("daily");
  const [alertRecipients, setAlertRecipients] = useState("");
  const [alertAudible, setAlertAudible] = useState(true);

  // ---------------------------------------------------------------------------
  // 4. PREFERENCE TAB STATE
  // ---------------------------------------------------------------------------
  const [selectedTheme, setSelectedTheme] = useState<"light" | "dark" | "system">("light");
  const [densityMode, setDensityMode] = useState<"comfortable" | "compact">("comfortable");
  const [accentColor, setAccentColor] = useState("sky");
  const [language, setLanguage] = useState("en");
  const [dateFormat, setDateFormat] = useState("YYYY-MM-DD");
  const [timeFormat, setTimeFormat] = useState("12h");
  const [decimalPrecision, setDecimalPrecision] = useState<number>(2);
  const [enableAnimations, setEnableAnimations] = useState(true);

  // ---------------------------------------------------------------------------
  // 5. TAX TAB STATE
  // ---------------------------------------------------------------------------
  const [enableTaxCalculation, setEnableTaxCalculation] = useState(true);
  const [defaultTaxRate, setDefaultTaxRate] = useState<number>(8.5);
  const [taxPricingMode, setTaxPricingMode] = useState<"exclusive" | "inclusive">("exclusive");
  const [taxRegistrationNumber, setTaxRegistrationNumber] = useState("TAX-US90281");
  const [taxLabel, setTaxLabel] = useState("Sales Tax");
  const [enableSecondaryTax, setEnableSecondaryTax] = useState(false);
  const [secondaryTaxRate, setSecondaryTaxRate] = useState<number>(1.5);
  const [secondaryTaxLabel, setSecondaryTaxLabel] = useState("Eco Surcharge");
  const [taxExemptionB2B, setTaxExemptionB2B] = useState(true);
  const [customTaxBrackets, setCustomTaxBrackets] = useState<TaxBracket[]>([
    { id: "1", name: "Standard Retail Goods", rate: 8.5, type: "standard", isDefault: true },
    { id: "2", name: "Essential Food & Groceries", rate: 0, type: "zero" },
    { id: "3", name: "Hospitality & Dining", rate: 5.0, type: "reduced" },
  ]);
  const [newBracketName, setNewBracketName] = useState("");
  const [newBracketRate, setNewBracketRate] = useState<string>("5.0");

  // Calculator preview for Tax
  const [calcSubtotal, setCalcSubtotal] = useState<number>(100);

  // Logo file upload handler
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Logo image must be under 2MB.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setLogoUrl(dataUrl);
      toast({
        title: "Logo Selected",
        description: "Save Store Settings to synchronize your new brand logo across all receipt headers and business records.",
      });
    };
    reader.readAsDataURL(file);
  };

  // Theme application helper with Supabase user sync and global events
  const applyTheme = (mode: "light" | "dark" | "system") => {
    setSelectedTheme(mode);
    setTheme(mode);
    localStorage.setItem("theme", mode);
    localStorage.setItem("geflow_theme", mode);
    if (typeof document !== "undefined") {
      const isDark = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.classList.toggle("dark", isDark);
      document.documentElement.classList.toggle("light", !isDark);
    }
    // Sync to Supabase user metadata asynchronously
    supabase.auth.updateUser({ data: { theme: mode } }).catch((err) => console.debug("Supabase theme sync:", err));
    window.dispatchEvent(new CustomEvent("geflow:theme-changed", { detail: { theme: mode } }));
  };

  // Synchronize from activeBusiness & localStorage
  const loadSettings = useCallback(() => {
    const currentBiz = active || activeBusiness;
    if (currentBiz) {
      setBusinessName(currentBiz.business_name || "");
      setBusinessAddress(currentBiz.business_address || "");
      setCurrency(currentBiz.currency || currentBiz.base_currency || "USD");
      setDefaultTaxRate(currentBiz.default_tax ?? 8.5);
      setLowStockThreshold(currentBiz.stock_alert_limit ?? 10);
    }

    // Try loading persistent user-level workspace config
    try {
      const saved = localStorage.getItem(`geflow_settings_${currentBiz?.id || "global"}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.businessTagline) setBusinessTagline(parsed.businessTagline);
        if (parsed.businessPhone) setBusinessPhone(parsed.businessPhone);
        if (parsed.businessEmail) setBusinessEmail(parsed.businessEmail);
        if (parsed.registrationNumber) setRegistrationNumber(parsed.registrationNumber);
        if (parsed.timezone) setTimezone(parsed.timezone);
        if (parsed.logoUrl) setLogoUrl(parsed.logoUrl);

        // POS
        if (parsed.receiptHeader) setReceiptHeader(parsed.receiptHeader);
        if (parsed.receiptSubheader) setReceiptSubheader(parsed.receiptSubheader);
        if (parsed.receiptFooter) setReceiptFooter(parsed.receiptFooter);
        if (parsed.showLogoOnReceipt !== undefined) setShowLogoOnReceipt(parsed.showLogoOnReceipt);
        if (parsed.showTaxBreakdown !== undefined) setShowTaxBreakdown(parsed.showTaxBreakdown);
        if (parsed.showCashierName !== undefined) setShowCashierName(parsed.showCashierName);
        if (parsed.showBarcodeOnReceipt !== undefined) setShowBarcodeOnReceipt(parsed.showBarcodeOnReceipt);
        if (parsed.autoPrintReceipt !== undefined) setAutoPrintReceipt(parsed.autoPrintReceipt);
        if (parsed.posSoundEffects !== undefined) setPosSoundEffects(parsed.posSoundEffects);
        if (parsed.openDrawerOnCash !== undefined) setOpenDrawerOnCash(parsed.openDrawerOnCash);
        if (parsed.scannerMode) setScannerMode(parsed.scannerMode);
        if (parsed.quickAmounts) setQuickAmounts(parsed.quickAmounts);
        if (parsed.defaultCustomerType) setDefaultCustomerType(parsed.defaultCustomerType);

        // Alerts
        if (parsed.outOfStockNotify !== undefined) setOutOfStockNotify(parsed.outOfStockNotify);
        if (parsed.expiryWarningDays) setExpiryWarningDays(parsed.expiryWarningDays);
        if (parsed.highReturnAlert !== undefined) setHighReturnAlert(parsed.highReturnAlert);
        if (parsed.inAppAlerts !== undefined) setInAppAlerts(parsed.inAppAlerts);
        if (parsed.emailDigestFrequency) setEmailDigestFrequency(parsed.emailDigestFrequency);
        if (parsed.alertRecipients) setAlertRecipients(parsed.alertRecipients);
        if (parsed.alertAudible !== undefined) setAlertAudible(parsed.alertAudible);

        // Preference
        if (parsed.selectedTheme) {
          setSelectedTheme(parsed.selectedTheme);
        }
        if (parsed.densityMode) setDensityMode(parsed.densityMode);
        if (parsed.accentColor) setAccentColor(parsed.accentColor);
        if (parsed.language) setLanguage(parsed.language);
        if (parsed.dateFormat) setDateFormat(parsed.dateFormat);
        if (parsed.timeFormat) setTimeFormat(parsed.timeFormat);
        if (parsed.decimalPrecision !== undefined) setDecimalPrecision(parsed.decimalPrecision);
        if (parsed.enableAnimations !== undefined) setEnableAnimations(parsed.enableAnimations);

        // Tax
        if (parsed.enableTaxCalculation !== undefined) setEnableTaxCalculation(parsed.enableTaxCalculation);
        if (parsed.taxPricingMode) setTaxPricingMode(parsed.taxPricingMode);
        if (parsed.taxRegistrationNumber) setTaxRegistrationNumber(parsed.taxRegistrationNumber);
        if (parsed.taxLabel) setTaxLabel(parsed.taxLabel);
        if (parsed.enableSecondaryTax !== undefined) setEnableSecondaryTax(parsed.enableSecondaryTax);
        if (parsed.secondaryTaxRate !== undefined) setSecondaryTaxRate(parsed.secondaryTaxRate);
        if (parsed.secondaryTaxLabel) setSecondaryTaxLabel(parsed.secondaryTaxLabel);
        if (parsed.taxExemptionB2B !== undefined) setTaxExemptionB2B(parsed.taxExemptionB2B);
        if (parsed.customTaxBrackets && Array.isArray(parsed.customTaxBrackets)) {
          setCustomTaxBrackets(parsed.customTaxBrackets);
        }
      } else {
        // defaults
        setSelectedTheme((theme as any) || "light");
      }

      // Also check geflow_biz_logos
      if (currentBiz?.id) {
        const rawLogos = localStorage.getItem("geflow_biz_logos");
        if (rawLogos) {
          const logos = JSON.parse(rawLogos);
          if (logos[currentBiz.id]) {
            setLogoUrl(logos[currentBiz.id]);
          }
        }
      }
    } catch (e) {
      console.error("Error restoring settings:", e);
    }
  }, [active, activeBusiness, theme]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Sync theme changes from header toggle or other windows
  useEffect(() => {
    const handleThemeChange = (e: any) => {
      const newTheme = e.detail?.theme;
      if (newTheme === "light" || newTheme === "dark" || newTheme === "system") {
        setSelectedTheme(newTheme);
      }
    };
    window.addEventListener("geflow:theme-changed", handleThemeChange);
    return () => window.removeEventListener("geflow:theme-changed", handleThemeChange);
  }, []);

  // Realtime Supabase subscription for active business updates
  useEffect(() => {
    const currentBiz = active || activeBusiness;
    if (!currentBiz?.id) return;

    const channel = supabase
      .channel(`user-settings-sync-${currentBiz.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "businesses",
          filter: `id=eq.${currentBiz.id}`,
        },
        (payload: any) => {
          const newRow = payload.new;
          if (newRow) {
            if (newRow.business_name) setBusinessName(newRow.business_name);
            if (newRow.business_address !== undefined) setBusinessAddress(newRow.business_address || "");
            if (newRow.currency) setCurrency(newRow.currency);
            if (newRow.default_tax !== undefined) setDefaultTaxRate(newRow.default_tax);
            if (newRow.stock_alert_limit !== undefined) setLowStockThreshold(newRow.stock_alert_limit);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [active, activeBusiness]);

  // Handle saving current tab or all settings
  const handleSaveSettings = async () => {
    setSaving(true);
    const currentBiz = active || activeBusiness;
    try {
      // 1. Update user metadata in Supabase auth and local cache via hierarchy helper
      await saveUserSettingsOverrides({
        user_currency: currency,
        user_default_tax: Number(defaultTaxRate) || 0,
        user_stock_alert_limit: Number(lowStockThreshold) || 10,
        theme: selectedTheme,
      });

      // 2. Update Supabase businesses table if business exists
      if (currentBiz?.id) {
        const { error: updateError } = await supabase
          .from("businesses")
          .update({
            business_name: businessName.trim() || currentBiz.business_name,
            business_address: businessAddress.trim(),
            currency: currency,
            base_currency: currency,
            default_tax: Number(defaultTaxRate) || 0,
            stock_alert_limit: Number(lowStockThreshold) || 10,
            updated_at: new Date().toISOString(),
          })
          .eq("id", currentBiz.id);

        if (updateError) {
          console.warn("Direct business update encountered warning:", updateError);
        }

        if (refreshActiveBusiness) {
          await refreshActiveBusiness();
        }

        // Store logo in global logos map
        try {
          const rawLogos = localStorage.getItem("geflow_biz_logos");
          const logos = rawLogos ? JSON.parse(rawLogos) : {};
          if (logoUrl) {
            logos[currentBiz.id] = logoUrl;
          } else {
            delete logos[currentBiz.id];
          }
          localStorage.setItem("geflow_biz_logos", JSON.stringify(logos));
        } catch (e) {
          console.debug("Failed to store biz logo", e);
        }
      }

      // 3. Persist extended attributes to localStorage
      const payload = {
        businessTagline,
        businessPhone,
        businessEmail,
        registrationNumber,
        timezone,
        logoUrl,
        receiptHeader,
        receiptSubheader,
        receiptFooter,
        showLogoOnReceipt,
        showTaxBreakdown,
        showCashierName,
        showBarcodeOnReceipt,
        autoPrintReceipt,
        posSoundEffects,
        openDrawerOnCash,
        scannerMode,
        quickAmounts,
        defaultCustomerType,
        outOfStockNotify,
        expiryWarningDays,
        highReturnAlert,
        inAppAlerts,
        emailDigestFrequency,
        alertRecipients,
        alertAudible,
        selectedTheme,
        densityMode,
        accentColor,
        language,
        dateFormat,
        timeFormat,
        decimalPrecision,
        enableAnimations,
        enableTaxCalculation,
        taxPricingMode,
        taxRegistrationNumber,
        taxLabel,
        enableSecondaryTax,
        secondaryTaxRate,
        secondaryTaxLabel,
        taxExemptionB2B,
        customTaxBrackets,
      };

      localStorage.setItem(`geflow_settings_${currentBiz?.id || "global"}`, JSON.stringify(payload));

      // Refresh currency and money formatting across the entire app
      await refreshBusinessMoney();

      // Dispatch global events for instant reactivity across all pages (Dashboard, POS, Inventory, Reports, Low Stock)
      window.dispatchEvent(
        new CustomEvent("geflow:business-updated", {
          detail: {
            id: currentBiz?.id,
            business_name: businessName.trim() || currentBiz?.business_name,
            business_address: businessAddress.trim(),
            currency,
            base_currency: currency,
            default_tax: Number(defaultTaxRate) || 0,
            stock_alert_limit: Number(lowStockThreshold) || 10,
            expiryWarningDays: Number(expiryWarningDays) || 30,
            logoUrl,
          },
        })
      );
      window.dispatchEvent(new CustomEvent("geflow:currency-changed", { detail: { currency } }));
      window.dispatchEvent(new CustomEvent("geflow:settings-changed", { detail: payload }));
      window.dispatchEvent(new CustomEvent("panel:refresh"));

      toast({
        title: "Settings Saved Successfully",
        description: `Operational rules for ${businessName || "Workspace"} have been synchronized to database.`,
      });
    } catch (err: any) {
      toast({
        title: "Save Failed",
        description: err?.message || "Could not synchronize settings to database.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Add custom tax bracket
  const handleAddTaxBracket = () => {
    if (!newBracketName.trim()) return;
    const rateNum = parseFloat(newBracketRate) || 0;
    const newBracket: TaxBracket = {
      id: `tax-${Date.now()}`,
      name: newBracketName.trim(),
      rate: rateNum,
      type: rateNum === 0 ? "zero" : "standard",
    };
    setCustomTaxBrackets((prev) => [...prev, newBracket]);
    setNewBracketName("");
    setNewBracketRate("5.0");
    toast({
      title: "Tax Bracket Added",
      description: `${newBracket.name} (${rateNum}%) is now available for items.`,
    });
  };

  const handleRemoveTaxBracket = (id: string) => {
    setCustomTaxBrackets((prev) => prev.filter((b) => b.id !== id));
    toast({
      title: "Tax Bracket Removed",
      description: "Bracket was removed from the active configuration.",
    });
  };

  // Calculate live tax preview
  const taxCalculations = useMemo(() => {
    const sub = Number(calcSubtotal) || 0;
    if (!enableTaxCalculation) {
      return { taxAmount: 0, secondaryTaxAmount: 0, total: sub };
    }
    const rate = Number(defaultTaxRate) || 0;
    const secRate = enableSecondaryTax ? Number(secondaryTaxRate) || 0 : 0;

    if (taxPricingMode === "inclusive") {
      const base = sub / (1 + (rate + secRate) / 100);
      const taxAmount = base * (rate / 100);
      const secondaryTaxAmount = base * (secRate / 100);
      return {
        taxAmount,
        secondaryTaxAmount,
        total: sub,
        netBase: base,
      };
    } else {
      const taxAmount = sub * (rate / 100);
      const secondaryTaxAmount = sub * (secRate / 100);
      return {
        taxAmount,
        secondaryTaxAmount,
        total: sub + taxAmount + secondaryTaxAmount,
        netBase: sub,
      };
    }
  }, [calcSubtotal, enableTaxCalculation, defaultTaxRate, taxPricingMode, enableSecondaryTax, secondaryTaxRate]);

  // Test sound / test notification
  const handleTestAlert = () => {
    toast({
      title: "Stock Alert Triggered (Test)",
      description: `Test alert dispatching to ${alertRecipients || "Workspace Owner"}. Alert threshold: ${lowStockThreshold} units.`,
    });
  };

  return (
    <UserPanelGate pageTitle="Settings" module="settings">
      <div className="w-full space-y-8 min-w-0 pb-20">
        {/* ========================================================================= */}
        {/* HEADER & TAB NAVIGATION BAR                                               */}
        {/* ========================================================================= */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/70 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-sky-500/10 text-sky-500 flex items-center justify-center border border-sky-500/20">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                  Workspace Settings
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Configure store identity, POS terminal mechanics, alerts, UI themes, and tax brackets.
                </p>
              </div>
            </div>
          </div>

          {/* Top Actions: Save Button & Quick Day/Night Toggle */}
          <div className="flex items-center gap-3">
            <Button
              onClick={handleSaveSettings}
              disabled={saving}
              className="h-10 px-5 rounded-2xl bg-sky-400 hover:bg-sky-500 text-slate-950 font-bold text-xs shadow-md shadow-sky-400/20 border-0 flex items-center gap-2 active:scale-95 transition-transform"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving Changes..." : "Save Settings"}
            </Button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB CONTROLS (5 TABS: Info, POS, Alert, Preference, Tax)                 */}
        {/* ========================================================================= */}
        <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-muted/60 dark:bg-muted/30 border border-border/80 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab("info")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === "info"
                ? "bg-card text-foreground shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <Info className="w-4 h-4 text-sky-500" />
            <span>Store Info</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("pos")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === "pos"
                ? "bg-card text-foreground shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <Receipt className="w-4 h-4 text-emerald-500" />
            <span>POS &amp; Receipts</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("alert")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === "alert"
                ? "bg-card text-foreground shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <Bell className="w-4 h-4 text-amber-500" />
            <span>Stock Alerts</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("preference")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === "preference"
                ? "bg-card text-foreground shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <Sliders className="w-4 h-4 text-purple-500" />
            <span>Preferences</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("tax")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === "tax"
                ? "bg-card text-foreground shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <Percent className="w-4 h-4 text-rose-500" />
            <span>Tax &amp; Fiscal</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: STORE & BUSINESS INFO (DAY / NIGHT)                                */}
        {/* ========================================================================= */}
        {activeTab === "info" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in-50 duration-200">
            {/* Left 2 Cols: Form Fields */}
            <div className="lg:col-span-2 space-y-6">
              <div className="p-6 sm:p-7 rounded-3xl bg-card border border-border/80 shadow-xs space-y-6">
                <div>
                  <h3 className="text-base font-bold text-foreground">General Information</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Primary business credentials printed on invoices and client communications.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Business / Store Name
                    </Label>
                    <Input
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="e.g. Apex Central Supermarket"
                      className="h-11 rounded-2xl text-xs font-medium"
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Tagline / Store Description
                    </Label>
                    <Input
                      value={businessTagline}
                      onChange={(e) => setBusinessTagline(e.target.value)}
                      placeholder="e.g. Quality Goods & High-Velocity Grocery Retail"
                      className="h-11 rounded-2xl text-xs font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Primary Contact Email
                    </Label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-muted-foreground" />
                      <Input
                        type="email"
                        value={businessEmail}
                        onChange={(e) => setBusinessEmail(e.target.value)}
                        placeholder="billing@apexretail.io"
                        className="h-11 pl-10 rounded-2xl text-xs font-medium"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Phone Number
                    </Label>
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute left-3.5 top-3.5 text-muted-foreground" />
                      <Input
                        value={businessPhone}
                        onChange={(e) => setBusinessPhone(e.target.value)}
                        placeholder="+1 (555) 392-0944"
                        className="h-11 pl-10 rounded-2xl text-xs font-medium"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Physical Store Address
                    </Label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 absolute left-3.5 top-3.5 text-muted-foreground" />
                      <Input
                        value={businessAddress}
                        onChange={(e) => setBusinessAddress(e.target.value)}
                        placeholder="742 Evergreen Terrace, Sector 4, CA 94103"
                        className="h-11 pl-10 rounded-2xl text-xs font-medium"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Business Registration / EIN
                    </Label>
                    <div className="relative">
                      <Hash className="w-4 h-4 absolute left-3.5 top-3.5 text-muted-foreground" />
                      <Input
                        value={registrationNumber}
                        onChange={(e) => setRegistrationNumber(e.target.value)}
                        placeholder="REG-892401-US"
                        className="h-11 pl-10 rounded-2xl text-xs font-medium"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Base Operating Currency
                      </Label>
                      <span className="flex items-center gap-1 text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                        <Lock className="w-2.5 h-2.5" /> Immutable
                      </span>
                    </div>
                    <div className="h-11 px-3.5 rounded-2xl bg-muted/40 border border-border/80 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-sky-500" />
                        <span className="text-xs font-bold text-foreground">
                          {currency} ({CURRENCIES.find((c) => c.code === currency)?.name || currency})
                        </span>
                      </div>
                      <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">
                        Set at Registration
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      Currency is fixed at business creation and cannot be changed. View details on <strong className="text-foreground">My Businesses</strong>.
                    </p>
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Store Timezone
                    </Label>
                    <Select value={timezone} onValueChange={setTimezone}>
                      <SelectTrigger className="h-11 rounded-2xl text-xs font-medium">
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UTC">UTC (Universal Coordinated Time)</SelectItem>
                        <SelectItem value="America/New_York">Eastern Time (US &amp; Canada) [UTC-5]</SelectItem>
                        <SelectItem value="America/Chicago">Central Time (US &amp; Canada) [UTC-6]</SelectItem>
                        <SelectItem value="America/Los_Angeles">Pacific Time (US &amp; Canada) [UTC-8]</SelectItem>
                        <SelectItem value="Europe/London">London / Dublin [UTC+0]</SelectItem>
                        <SelectItem value="Europe/Paris">Paris / Berlin / Rome [UTC+1]</SelectItem>
                        <SelectItem value="Asia/Dubai">Dubai / Gulf Standard [UTC+4]</SelectItem>
                        <SelectItem value="Asia/Karachi">Islamabad / Karachi [UTC+5]</SelectItem>
                        <SelectItem value="Asia/Kolkata">Mumbai / New Delhi [UTC+5:30]</SelectItem>
                        <SelectItem value="Asia/Tokyo">Tokyo / Seoul [UTC+9]</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* Right 1 Col: Logo Card & Quick Info */}
            <div className="space-y-6">
              {/* Store Logo Card */}
              <div className="p-6 sm:p-7 rounded-3xl bg-card border border-border/80 shadow-xs space-y-4">
                <h3 className="text-base font-bold text-foreground">Store Branding</h3>
                <p className="text-xs text-muted-foreground">
                  Your store logo will appear on receipts, emails, and the POS header.
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={handleLogoUpload}
                />

                <div className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-border/80 bg-muted/20 text-center space-y-3">
                  {logoUrl ? (
                    <div className="relative group">
                      <img
                        src={logoUrl}
                        alt="Store Logo"
                        className="w-24 h-24 rounded-2xl object-cover border border-border shadow-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setLogoUrl(null)}
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center text-xs shadow-md hover:bg-rose-600"
                        title="Remove Logo"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-sky-500/10 text-sky-500 flex items-center justify-center border border-sky-500/20">
                      <Store className="w-10 h-10" />
                    </div>
                  )}

                  <div className="space-y-1">
                    <p className="text-xs font-bold text-foreground">
                      {logoUrl ? "Store Logo Active" : "Upload Store Brand Logo"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      PNG, JPG, or SVG up to 2MB. Square 1:1 recommended.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-8 px-3 rounded-xl text-[10px] font-bold bg-sky-500 hover:bg-sky-600 text-white"
                    >
                      <Upload className="w-3 h-3 mr-1" /> Choose Brand Logo
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const demoUrl = "https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=150&auto=format&fit=crop&q=60";
                        setLogoUrl(demoUrl);
                        toast({ title: "Sample Logo Applied", description: "Store logo updated." });
                      }}
                      className="h-8 px-3 rounded-xl text-[10px] font-bold border-border/80"
                    >
                      Sample Logo
                    </Button>
                  </div>
                </div>
              </div>

              {/* Business Overview Card */}
              <div className="p-6 rounded-3xl bg-muted/40 dark:bg-muted/20 border border-border/80 space-y-3">
                <div className="flex items-center gap-2 text-sky-500">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Multi-Store Sync</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Changes made here instantly propagate to the live POS Terminal, team dispatch consoles, and customer receipts.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: POS & RECEIPT MECHANICS (DAY / NIGHT)                              */}
        {/* ========================================================================= */}
        {activeTab === "pos" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in-50 duration-200">
            {/* Left 2 Cols: POS Options */}
            <div className="lg:col-span-2 space-y-6">
              {/* Receipt Header & Footer Customization */}
              <div className="p-6 sm:p-7 rounded-3xl bg-card border border-border/80 shadow-xs space-y-5">
                <div>
                  <h3 className="text-base font-bold text-foreground">Receipt Customization</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Customize the thermal print header, customer greeting, and return disclaimer.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Receipt Header Title
                    </Label>
                    <Input
                      value={receiptHeader}
                      onChange={(e) => setReceiptHeader(e.target.value)}
                      placeholder="e.g. Apex Central Market"
                      className="h-11 rounded-2xl text-xs font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Subheader / Fiscal Slogan
                    </Label>
                    <Input
                      value={receiptSubheader}
                      onChange={(e) => setReceiptSubheader(e.target.value)}
                      placeholder="e.g. Official Fiscal Receipt"
                      className="h-11 rounded-2xl text-xs font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Receipt Footer / Return Policy
                    </Label>
                    <Textarea
                      value={receiptFooter}
                      onChange={(e) => setReceiptFooter(e.target.value)}
                      rows={3}
                      placeholder="e.g. Thank you for visiting! Returns accepted within 14 days with original receipt."
                      className="rounded-2xl text-xs font-medium resize-none"
                    />
                  </div>
                </div>

                {/* Print Flags Switches */}
                <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-border/60">
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/40 dark:bg-muted/20 border border-border/70">
                    <div className="space-y-0.5 pr-2">
                      <p className="text-xs font-bold text-foreground">Show Store Logo</p>
                      <p className="text-[10px] text-muted-foreground">Print store brand on receipt top</p>
                    </div>
                    <Switch
                      checked={showLogoOnReceipt}
                      onCheckedChange={setShowLogoOnReceipt}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/40 dark:bg-muted/20 border border-border/70">
                    <div className="space-y-0.5 pr-2">
                      <p className="text-xs font-bold text-foreground">Tax Breakdown</p>
                      <p className="text-[10px] text-muted-foreground">Itemize VAT/Sales tax on slip</p>
                    </div>
                    <Switch
                      checked={showTaxBreakdown}
                      onCheckedChange={setShowTaxBreakdown}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/40 dark:bg-muted/20 border border-border/70">
                    <div className="space-y-0.5 pr-2">
                      <p className="text-xs font-bold text-foreground">Show Cashier Name</p>
                      <p className="text-[10px] text-muted-foreground">Print operator identity on slip</p>
                    </div>
                    <Switch
                      checked={showCashierName}
                      onCheckedChange={setShowCashierName}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/40 dark:bg-muted/20 border border-border/70">
                    <div className="space-y-0.5 pr-2">
                      <p className="text-xs font-bold text-foreground">Receipt Barcode / QR</p>
                      <p className="text-[10px] text-muted-foreground">Enables quick return barcode scanning</p>
                    </div>
                    <Switch
                      checked={showBarcodeOnReceipt}
                      onCheckedChange={setShowBarcodeOnReceipt}
                    />
                  </div>
                </div>
              </div>

              {/* Operational POS Mechanics */}
              <div className="p-6 sm:p-7 rounded-3xl bg-card border border-border/80 shadow-xs space-y-5">
                <div>
                  <h3 className="text-base font-bold text-foreground">Hardware &amp; Scanner Mechanics</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Hardware integration for barcode guns, cash drawers, and thermal printers.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Primary Barcode Scanner Mode
                    </Label>
                    <Select
                      value={scannerMode}
                      onValueChange={(val: any) => setScannerMode(val)}
                    >
                      <SelectTrigger className="h-11 rounded-2xl text-xs font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hardware">Hardware USB / Bluetooth Gun (Fastest)</SelectItem>
                        <SelectItem value="camera">Integrated Device Camera Scanner</SelectItem>
                        <SelectItem value="keyboard">Keyboard Emulation / Manual Entry</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Quick Cash Tender Buttons
                    </Label>
                    <Input
                      value={quickAmounts}
                      onChange={(e) => setQuickAmounts(e.target.value)}
                      placeholder="10, 20, 50, 100"
                      className="h-11 rounded-2xl text-xs font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/40 dark:bg-muted/20 border border-border/70">
                    <div className="space-y-0.5 pr-2">
                      <p className="text-xs font-bold text-foreground">Audible Scan &amp; Tender Chimes</p>
                      <p className="text-[10px] text-muted-foreground">Play pleasant chime on barcode match and checkout</p>
                    </div>
                    <Switch
                      checked={posSoundEffects}
                      onCheckedChange={setPosSoundEffects}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/40 dark:bg-muted/20 border border-border/70">
                    <div className="space-y-0.5 pr-2">
                      <p className="text-xs font-bold text-foreground">Trigger Cash Drawer Kick</p>
                      <p className="text-[10px] text-muted-foreground">Send drawer pulse signal on cash settlement</p>
                    </div>
                    <Switch
                      checked={openDrawerOnCash}
                      onCheckedChange={setOpenDrawerOnCash}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/40 dark:bg-muted/20 border border-border/70">
                    <div className="space-y-0.5 pr-2">
                      <p className="text-xs font-bold text-foreground">Auto-Print Slip Upon Tender</p>
                      <p className="text-[10px] text-muted-foreground">Automatically trigger OS print dialog when transaction closes</p>
                    </div>
                    <Switch
                      checked={autoPrintReceipt}
                      onCheckedChange={setAutoPrintReceipt}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right 1 Col: Live Thermal Receipt Preview */}
            <div className="space-y-6">
              <div className="p-6 sm:p-7 rounded-3xl bg-card border border-border/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-foreground">Live Receipt Preview</h3>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    80mm Thermal
                  </span>
                </div>

                {/* The Visual Receipt Card */}
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono text-[11px] space-y-3 shadow-inner">
                  {showLogoOnReceipt && (
                    <div className="text-center pb-2 border-b border-dashed border-zinc-300 dark:border-zinc-700 space-y-1">
                      {logoUrl && (
                        <div className="flex justify-center mb-1">
                          <img
                            src={logoUrl}
                            alt="Logo"
                            className="h-10 max-w-[120px] object-contain rounded-md"
                          />
                        </div>
                      )}
                      <p className="text-xs font-black uppercase tracking-wider">{receiptHeader || businessName || "GEFLOW STORE"}</p>
                      <p className="text-[9px] text-zinc-500 dark:text-zinc-400">{receiptSubheader}</p>
                      {businessAddress && <p className="text-[9px] text-zinc-500 dark:text-zinc-400">{businessAddress}</p>}
                    </div>
                  )}

                  <div className="text-[10px] space-y-0.5 text-zinc-600 dark:text-zinc-400">
                    <div className="flex justify-between">
                      <span>DATE: 2026-03-15</span>
                      <span>TIME: 14:32</span>
                    </div>
                    <div className="flex justify-between">
                      <span>RECEIPT #: RC-89021</span>
                      {showCashierName && <span>CASHIER: Alex</span>}
                    </div>
                  </div>

                  <div className="border-t border-b border-dashed border-zinc-300 dark:border-zinc-700 py-2 space-y-1 text-[10px]">
                    <div className="flex justify-between font-bold">
                      <span>ITEM</span>
                      <span>QTY</span>
                      <span>AMT</span>
                    </div>
                    <div className="flex justify-between text-zinc-700 dark:text-zinc-300">
                      <span>Organic Milk 1L</span>
                      <span>2</span>
                      <span>$7.98</span>
                    </div>
                    <div className="flex justify-between text-zinc-700 dark:text-zinc-300">
                      <span>Sourdough Loaf</span>
                      <span>1</span>
                      <span>$4.50</span>
                    </div>
                    <div className="flex justify-between text-zinc-700 dark:text-zinc-300">
                      <span>Arabica Coffee 250g</span>
                      <span>1</span>
                      <span>$12.00</span>
                    </div>
                  </div>

                  <div className="space-y-1 text-[10px] pt-1">
                    <div className="flex justify-between">
                      <span>SUBTOTAL</span>
                      <span>$24.48</span>
                    </div>
                    {showTaxBreakdown && (
                      <div className="flex justify-between text-zinc-500 dark:text-zinc-400">
                        <span>TAX ({defaultTaxRate}%)</span>
                        <span>${(24.48 * (defaultTaxRate / 100)).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-black text-xs pt-1 border-t border-zinc-300 dark:border-zinc-700">
                      <span>TOTAL DUE</span>
                      <span>${(24.48 * (1 + defaultTaxRate / 100)).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-zinc-500 dark:text-zinc-400">
                      <span>TENDER (CASH)</span>
                      <span>$30.00</span>
                    </div>
                    <div className="flex justify-between text-zinc-500 dark:text-zinc-400">
                      <span>CHANGE</span>
                      <span>${(30.0 - 24.48 * (1 + defaultTaxRate / 100)).toFixed(2)}</span>
                    </div>
                  </div>

                  {showBarcodeOnReceipt && (
                    <div className="pt-2 text-center border-t border-dashed border-zinc-300 dark:border-zinc-700">
                      <div className="inline-block px-4 py-1.5 bg-zinc-200 dark:bg-zinc-800 rounded font-black tracking-widest text-[9px]">
                        ||| | |||| | ||||| || |
                      </div>
                      <p className="text-[8px] text-zinc-400 mt-0.5">RC-89021-RETURN-AUTH</p>
                    </div>
                  )}

                  <p className="text-[9px] text-center text-zinc-500 dark:text-zinc-400 pt-1 leading-tight">
                    {receiptFooter}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: STOCK ALERTS & MONITORING (DAY / NIGHT)                            */}
        {/* ========================================================================= */}
        {activeTab === "alert" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in-50 duration-200">
            {/* Left 2 Cols: Alert Form */}
            <div className="lg:col-span-2 space-y-6">
              <div className="p-6 sm:p-7 rounded-3xl bg-card border border-border/80 shadow-xs space-y-6">
                <div>
                  <h3 className="text-base font-bold text-foreground">Stock Alert Parameters</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Configure automated warnings for replenishments, zero stock events, and batch expirations.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Default Low Stock Alert (Units)
                      </Label>
                      <span className="text-xs font-black text-sky-500">{lowStockThreshold} units</span>
                    </div>
                    <Input
                      type="number"
                      min={1}
                      max={500}
                      value={lowStockThreshold}
                      onChange={(e) => setLowStockThreshold(parseInt(e.target.value) || 5)}
                      className="h-11 rounded-2xl text-xs font-medium"
                    />
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Current: <strong className="text-foreground">{lowStockThreshold} units</strong></span>
                      <span>Cat Default: <strong className="text-muted-foreground">{categorySettings?.stock_alert_limit ?? 10} units{categoryName ? ` (${categoryName})` : ""}</strong></span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Batch Expiry Warning (Days)
                      </Label>
                      <span className="text-xs font-black text-purple-400">{expiryWarningDays} days</span>
                    </div>
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      value={expiryWarningDays}
                      onChange={(e) => setExpiryWarningDays(parseInt(e.target.value) || 30)}
                      className="h-11 rounded-2xl text-xs font-medium"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Flag batches scheduled to expire within these days for prioritized discounting.
                    </p>
                  </div>
                </div>

                {/* Notification Rules */}
                <div className="space-y-3.5 pt-3 border-t border-border/60">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-foreground">
                    Notification Dispatch Mechanisms
                  </h4>

                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/40 dark:bg-muted/20 border border-border/70">
                    <div className="space-y-0.5 pr-2">
                      <p className="text-xs font-bold text-foreground">Zero Stock Immediate Alarm</p>
                      <p className="text-[10px] text-muted-foreground">
                        Instant notification when any item depletes to 0 units
                      </p>
                    </div>
                    <Switch
                      checked={outOfStockNotify}
                      onCheckedChange={setOutOfStockNotify}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/40 dark:bg-muted/20 border border-border/70">
                    <div className="space-y-0.5 pr-2">
                      <p className="text-xs font-bold text-foreground">In-App Notification Bell</p>
                      <p className="text-[10px] text-muted-foreground">
                        Show unread indicator in top navigation bar
                      </p>
                    </div>
                    <Switch
                      checked={inAppAlerts}
                      onCheckedChange={setInAppAlerts}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/40 dark:bg-muted/20 border border-border/70">
                    <div className="space-y-0.5 pr-2">
                      <p className="text-xs font-bold text-foreground">Audible Terminal Warning</p>
                      <p className="text-[10px] text-muted-foreground">
                        Chime audible caution sound on cashier checkout if stock dips below threshold
                      </p>
                    </div>
                    <Switch
                      checked={alertAudible}
                      onCheckedChange={setAlertAudible}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/40 dark:bg-muted/20 border border-border/70">
                    <div className="space-y-0.5 pr-2">
                      <p className="text-xs font-bold text-foreground">High Return Rate Spike</p>
                      <p className="text-[10px] text-muted-foreground">
                        Notify management when more than 3 returns occur on the same SKU in 24 hours
                      </p>
                    </div>
                    <Switch
                      checked={highReturnAlert}
                      onCheckedChange={setHighReturnAlert}
                    />
                  </div>
                </div>

                {/* Email Dispatch Configuration */}
                <div className="space-y-3 pt-3 border-t border-border/60">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-foreground">
                    Email Digest Cadence
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Digest Frequency
                      </Label>
                      <Select
                        value={emailDigestFrequency}
                        onValueChange={(val: any) => setEmailDigestFrequency(val)}
                      >
                        <SelectTrigger className="h-11 rounded-2xl text-xs font-medium">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="instant">Instant Dispatch (Every Trigger)</SelectItem>
                          <SelectItem value="daily">Daily Morning Digest (08:00 AM)</SelectItem>
                          <SelectItem value="weekly">Weekly Overview (Monday AM)</SelectItem>
                          <SelectItem value="off">Off (In-App Only)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Notification Emails (Comma Separated)
                      </Label>
                      <Input
                        value={alertRecipients}
                        onChange={(e) => setAlertRecipients(e.target.value)}
                        placeholder="manager@store.com, owner@store.com"
                        className="h-11 rounded-2xl text-xs font-medium"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right 1 Col: Test Alert Trigger & Telemetry */}
            <div className="space-y-6">
              <div className="p-6 sm:p-7 rounded-3xl bg-card border border-border/80 shadow-xs space-y-4">
                <div className="flex items-center gap-2 text-amber-500">
                  <AlertTriangle className="w-5 h-5" />
                  <h3 className="text-base font-bold text-foreground">Simulate Alert Signal</h3>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  Verify that sound chimes, email dispatch hooks, and in-app indicators operate correctly across your staff registers.
                </p>

                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                    <p className="text-xs font-bold">Rule Monitoring Active</p>
                  </div>
                  <p className="text-[11px] leading-tight">
                    Checking items below {lowStockThreshold} units and batches expiring within {expiryWarningDays} days.
                  </p>
                </div>

                <Button
                  type="button"
                  onClick={handleTestAlert}
                  variant="outline"
                  className="w-full h-11 rounded-2xl border-border/80 text-xs font-bold flex items-center justify-center gap-2 hover:bg-muted"
                >
                  <Bell className="w-4 h-4 text-amber-500" /> Dispatch Test Alert
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: PREFERENCES & APPEARANCE (DAY / NIGHT)                             */}
        {/* ========================================================================= */}
        {activeTab === "preference" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in-50 duration-200">
            {/* Left 2 Cols: UI Themes & Locales */}
            <div className="lg:col-span-2 space-y-6">
              {/* Day / Night Theme Cards */}
              <div className="p-6 sm:p-7 rounded-3xl bg-card border border-border/80 shadow-xs space-y-5">
                <div>
                  <h3 className="text-base font-bold text-foreground">Theme &amp; Display Archetype</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Toggle between pristine high-contrast Day light mode and eye-safe Night dark mode.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* LIGHT MODE CARD */}
                  <button
                    type="button"
                    onClick={() => {
                      applyTheme("light");
                      toast({ title: "Light Theme Activated", description: "Pristine daytime UI active." });
                    }}
                    className={`p-4 rounded-2xl border-2 flex flex-col items-center text-center gap-3 transition-all ${
                      selectedTheme === "light"
                        ? "border-sky-500 bg-sky-500/10 shadow-md ring-2 ring-sky-500/20"
                        : "border-border/80 hover:border-border bg-card opacity-70 hover:opacity-100"
                    }`}
                  >
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
                      <Sun className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">Day Light Mode</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Crisp, high-contrast daytime layout</p>
                    </div>
                    {selectedTheme === "light" ? (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-sky-500 text-white shadow-xs">
                        ACTIVE
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-medium uppercase text-muted-foreground border border-border">
                        SELECT
                      </span>
                    )}
                  </button>

                  {/* DARK MODE CARD */}
                  <button
                    type="button"
                    onClick={() => {
                      applyTheme("dark");
                      toast({ title: "Dark Theme Activated", description: "Night mode UI active." });
                    }}
                    className={`p-4 rounded-2xl border-2 flex flex-col items-center text-center gap-3 transition-all ${
                      selectedTheme === "dark"
                        ? "border-purple-500 bg-purple-500/10 shadow-md ring-2 ring-purple-500/20"
                        : "border-border/80 hover:border-border bg-card opacity-70 hover:opacity-100"
                    }`}
                  >
                    <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
                      <Moon className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">Night Dark Mode</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Low-glare twilight dark atmosphere</p>
                    </div>
                    {selectedTheme === "dark" ? (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-purple-500 text-white shadow-xs">
                        ACTIVE
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-medium uppercase text-muted-foreground border border-border">
                        SELECT
                      </span>
                    )}
                  </button>

                  {/* SYSTEM SYNC CARD */}
                  <button
                    type="button"
                    onClick={() => {
                      applyTheme("system");
                      toast({ title: "System Sync Activated", description: "Adapting automatically to OS setting." });
                    }}
                    className={`p-4 rounded-2xl border-2 flex flex-col items-center text-center gap-3 transition-all ${
                      selectedTheme === "system"
                        ? "border-emerald-500 bg-emerald-500/10 shadow-md ring-2 ring-emerald-500/20"
                        : "border-border/80 hover:border-border bg-card opacity-70 hover:opacity-100"
                    }`}
                  >
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">OS Auto Sync</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Sync with device system clock</p>
                    </div>
                    {selectedTheme === "system" ? (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-500 text-white shadow-xs">
                        ACTIVE
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-medium uppercase text-muted-foreground border border-border">
                        SELECT
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Formatting & Density Preferences */}
              <div className="p-6 sm:p-7 rounded-3xl bg-card border border-border/80 shadow-xs space-y-5">
                <div>
                  <h3 className="text-base font-bold text-foreground">Regional &amp; Numeric Formats</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Configure dates, time display, number decimals, and layout density.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Layout Density
                    </Label>
                    <Select
                      value={densityMode}
                      onValueChange={(val: any) => setDensityMode(val)}
                    >
                      <SelectTrigger className="h-11 rounded-2xl text-xs font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="comfortable">Comfortable (Spacious Padding &amp; Cards)</SelectItem>
                        <SelectItem value="compact">Compact (High-Density Fast POS Grid)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Interface Language
                    </Label>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger className="h-11 rounded-2xl text-xs font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English (US)</SelectItem>
                        <SelectItem value="es">Español (Spanish)</SelectItem>
                        <SelectItem value="fr">Français (French)</SelectItem>
                        <SelectItem value="de">Deutsch (German)</SelectItem>
                        <SelectItem value="ar">العربية (Arabic - RTL)</SelectItem>
                        <SelectItem value="ur">اردو (Urdu)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Date Format
                    </Label>
                    <Select value={dateFormat} onValueChange={setDateFormat}>
                      <SelectTrigger className="h-11 rounded-2xl text-xs font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (2026-03-15)</SelectItem>
                        <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (15/03/2026)</SelectItem>
                        <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (03/15/2026)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Time Format
                    </Label>
                    <Select value={timeFormat} onValueChange={setTimeFormat}>
                      <SelectTrigger className="h-11 rounded-2xl text-xs font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="12h">12-Hour (02:30 PM)</SelectItem>
                        <SelectItem value="24h">24-Hour Military (14:30)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Currency Decimal Precision
                    </Label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: "0 Decimals ($12)", val: 0 },
                        { label: "2 Decimals ($12.50)", val: 2 },
                        { label: "3 Decimals ($12.500)", val: 3 },
                      ].map((d) => (
                        <button
                          key={d.val}
                          type="button"
                          onClick={() => setDecimalPrecision(d.val)}
                          className={`p-3 rounded-2xl border text-xs font-bold transition-all ${
                            decimalPrecision === d.val
                              ? "border-sky-500 bg-sky-500/10 text-sky-500"
                              : "border-border/80 text-muted-foreground hover:bg-muted/40"
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/40 dark:bg-muted/20 border border-border/70">
                    <div className="space-y-0.5 pr-2">
                      <p className="text-xs font-bold text-foreground">Smooth Micro-Animations</p>
                      <p className="text-[10px] text-muted-foreground">
                        Enable spring layout transitions and responsive hover effects
                      </p>
                    </div>
                    <Switch
                      checked={enableAnimations}
                      onCheckedChange={setEnableAnimations}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right 1 Col: Quick Tips */}
            <div className="space-y-6">
              <div className="p-6 sm:p-7 rounded-3xl bg-card border border-border/80 shadow-xs space-y-4">
                <h3 className="text-base font-bold text-foreground">Display Summary</h3>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between py-2 border-b border-border/40">
                    <span className="text-muted-foreground">Theme Mode</span>
                    <span className="font-bold text-foreground capitalize">{theme}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border/40">
                    <span className="text-muted-foreground">Density</span>
                    <span className="font-bold text-foreground capitalize">{densityMode}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border/40">
                    <span className="text-muted-foreground">Precision</span>
                    <span className="font-bold text-foreground">{decimalPrecision} Places</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">Time Mode</span>
                    <span className="font-bold text-foreground">{timeFormat}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: TAX & FISCAL CONFIGURATION (DAY / NIGHT)                           */}
        {/* ========================================================================= */}
        {activeTab === "tax" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in-50 duration-200">
            {/* Left 2 Cols: Tax Brackets & Calculations */}
            <div className="lg:col-span-2 space-y-6">
              {/* Primary Tax Engine Card */}
              <div className="p-6 sm:p-7 rounded-3xl bg-card border border-border/80 shadow-xs space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-foreground">Automated Tax Engine</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Configure baseline sales tax, GST/VAT registration numbers, and pricing modes.
                    </p>
                  </div>
                  <Switch
                    checked={enableTaxCalculation}
                    onCheckedChange={setEnableTaxCalculation}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Universal Default Tax Rate
                      </Label>
                      <span className="flex items-center gap-1 text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                        <Lock className="w-2.5 h-2.5" /> Immutable
                      </span>
                    </div>
                    <div className="h-11 px-3.5 rounded-2xl bg-muted/40 border border-border/80 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Percent className="w-4 h-4 text-rose-500" />
                        <span className="text-xs font-bold text-foreground">
                          {defaultTaxRate}% Base Default Tax
                        </span>
                      </div>
                      <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">
                        Set at Registration
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      Default tax rate is fixed at business creation and cannot be changed.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Tax Label on Invoice
                    </Label>
                    <Input
                      value={taxLabel}
                      onChange={(e) => setTaxLabel(e.target.value)}
                      placeholder="e.g. Sales Tax, VAT, GST"
                      className="h-11 rounded-2xl text-xs font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Tax Registration / VAT ID
                    </Label>
                    <Input
                      value={taxRegistrationNumber}
                      onChange={(e) => setTaxRegistrationNumber(e.target.value)}
                      placeholder="e.g. VAT-GB902812"
                      className="h-11 rounded-2xl text-xs font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Price Tax Inclusivity
                    </Label>
                    <Select
                      value={taxPricingMode}
                      onValueChange={(val: any) => setTaxPricingMode(val)}
                    >
                      <SelectTrigger className="h-11 rounded-2xl text-xs font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="exclusive">Tax Exclusive (Tax Added on Top at Checkout)</SelectItem>
                        <SelectItem value="inclusive">Tax Inclusive (Prices Already Include Tax)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Secondary Surcharge Option */}
                <div className="space-y-4 pt-3 border-t border-border/60">
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/40 dark:bg-muted/20 border border-border/70">
                    <div className="space-y-0.5 pr-2">
                      <p className="text-xs font-bold text-foreground">Secondary Environmental / Local Surcharge</p>
                      <p className="text-[10px] text-muted-foreground">
                        Additional municipal surcharge or bottle deposit
                      </p>
                    </div>
                    <Switch
                      checked={enableSecondaryTax}
                      onCheckedChange={setEnableSecondaryTax}
                    />
                  </div>

                  {enableSecondaryTax && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-muted/20 border border-border/60 animate-in fade-in-50">
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          Surcharge Label
                        </Label>
                        <Input
                          value={secondaryTaxLabel}
                          onChange={(e) => setSecondaryTaxLabel(e.target.value)}
                          placeholder="e.g. Eco Surcharge"
                          className="h-10 rounded-xl text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          Surcharge Rate (%)
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={secondaryTaxRate}
                          onChange={(e) => setSecondaryTaxRate(parseFloat(e.target.value) || 0)}
                          className="h-10 rounded-xl text-xs"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/40 dark:bg-muted/20 border border-border/70">
                    <div className="space-y-0.5 pr-2">
                      <p className="text-xs font-bold text-foreground">B2B Wholesale Tax Exemption</p>
                      <p className="text-[10px] text-muted-foreground">
                        Allow registered wholesale buyers to bypass retail sales tax with verified tax exemption ID
                      </p>
                    </div>
                    <Switch
                      checked={taxExemptionB2B}
                      onCheckedChange={setTaxExemptionB2B}
                    />
                  </div>
                </div>
              </div>

              {/* Itemized Tax Brackets Table */}
              <div className="p-6 sm:p-7 rounded-3xl bg-card border border-border/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-foreground">Custom Tax Brackets</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Assign special tax rates to specific categories or product groups.
                    </p>
                  </div>
                </div>

                <div className="space-y-2 divide-y divide-border/40">
                  {customTaxBrackets.map((bracket) => (
                    <div key={bracket.id} className="pt-2 first:pt-0 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center font-bold text-xs border border-rose-500/20">
                          %
                        </div>
                        <div>
                          <p className="font-bold text-foreground">{bracket.name}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">{bracket.type} bracket</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-muted text-foreground border border-border">
                          {bracket.rate}%
                        </span>
                        {!bracket.isDefault && (
                          <button
                            type="button"
                            onClick={() => handleRemoveTaxBracket(bracket.id)}
                            className="w-7 h-7 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 flex items-center justify-center transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Bracket Form */}
                <div className="pt-3 border-t border-border/60 flex flex-col sm:flex-row items-center gap-3">
                  <Input
                    value={newBracketName}
                    onChange={(e) => setNewBracketName(e.target.value)}
                    placeholder="Bracket Name (e.g. Luxury Tobacco, Medical)"
                    className="h-10 rounded-2xl text-xs flex-1"
                  />
                  <Input
                    type="number"
                    step="0.1"
                    value={newBracketRate}
                    onChange={(e) => setNewBracketRate(e.target.value)}
                    placeholder="Rate %"
                    className="h-10 rounded-2xl text-xs w-full sm:w-24"
                  />
                  <Button
                    type="button"
                    onClick={handleAddTaxBracket}
                    className="h-10 px-4 rounded-2xl text-xs font-bold bg-sky-400 hover:bg-sky-500 text-slate-950 shadow-sm shrink-0"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add Bracket
                  </Button>
                </div>
              </div>
            </div>

            {/* Right 1 Col: Live Fiscal Calculation Simulator */}
            <div className="space-y-6">
              <div className="p-6 sm:p-7 rounded-3xl bg-card border border-border/80 shadow-xs space-y-5">
                <div className="flex items-center gap-2 text-rose-500">
                  <Calculator className="w-5 h-5" />
                  <h3 className="text-base font-bold text-foreground">Tax Simulator</h3>
                </div>

                <p className="text-xs text-muted-foreground">
                  Test your tax configuration against a sample subtotal to verify compliance.
                </p>

                <div className="space-y-2">
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Test Cart Subtotal ($)
                  </Label>
                  <Input
                    type="number"
                    step="5"
                    min="1"
                    value={calcSubtotal}
                    onChange={(e) => setCalcSubtotal(parseFloat(e.target.value) || 0)}
                    className="h-11 rounded-2xl text-xs font-bold"
                  />
                </div>

                <div className="p-4 rounded-2xl bg-muted/40 dark:bg-muted/20 border border-border/80 space-y-2.5 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Pricing Mode</span>
                    <span className="font-bold text-foreground uppercase">{taxPricingMode}</span>
                  </div>

                  <div className="flex justify-between text-muted-foreground">
                    <span>Net Base</span>
                    <span className="font-bold text-foreground">
                      ${taxCalculations.netBase ? taxCalculations.netBase.toFixed(2) : "0.00"}
                    </span>
                  </div>

                  <div className="flex justify-between text-muted-foreground">
                    <span>{taxLabel} ({defaultTaxRate}%)</span>
                    <span className="font-bold text-foreground">
                      +${taxCalculations.taxAmount.toFixed(2)}
                    </span>
                  </div>

                  {enableSecondaryTax && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>{secondaryTaxLabel} ({secondaryTaxRate}%)</span>
                      <span className="font-bold text-foreground">
                        +${taxCalculations.secondaryTaxAmount.toFixed(2)}
                      </span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-border/60 flex justify-between font-black text-sm text-foreground">
                    <span>FINAL BILLED</span>
                    <span className="text-sky-500">${taxCalculations.total.toFixed(2)}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-600 dark:text-emerald-400 space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Ready for POS Checkout
                  </p>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Calculations match the fiscal rules in POS Terminal and Reports.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </UserPanelGate>
  );
};

export default UserSettings;
