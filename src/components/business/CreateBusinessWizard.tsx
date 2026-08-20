import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { CURRENCIES, currencyLabel } from "@/lib/currencies";
import { COUNTRIES, TIMEZONES } from "@/lib/countries";
import { BusinessCategoryDef, BusinessExtendedData, TeamMemberInvite } from "@/types/business";
import { saveExtendedBusinessData } from "@/lib/businessStorage";
import { refreshBusinessMoney } from "@/lib/currency";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Tag,
  MapPin,
  Settings2,
  Package,
  ShoppingCart,
  Users,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  Sparkles,
  Search,
  Upload,
  Globe,
  Phone,
  Mail,
  Receipt,
  Store,
  ShieldCheck,
  Zap,
  Lock,
} from "lucide-react";

interface CreateBusinessWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (newBizId: string) => void;
}

export const CreateBusinessWizard = ({
  open,
  onOpenChange,
  onCreated,
}: CreateBusinessWizardProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<BusinessCategoryDef[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // Success state container
  const [createdBiz, setCreatedBiz] = useState<{
    id: string;
    name: string;
    categoryName: string;
    currency: string;
  } | null>(null);

  // Step 1: Basic Information
  const [businessName, setBusinessName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");

  // Step 2: Category
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [categorySearch, setCategorySearch] = useState("");

  // Step 3: Location
  const [country, setCountry] = useState("United States");
  const [stateProvince, setStateProvince] = useState("");
  const [city, setCity] = useState("");
  const [areaLocality, setAreaLocality] = useState("");
  const [address, setAddress] = useState("");
  const [postalZip, setPostalZip] = useState("");

  // Step 4: Business Settings
  const [currency, setCurrency] = useState("USD");
  const [currencySearch, setCurrencySearch] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [dateFormat, setDateFormat] = useState<"DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD">("DD/MM/YYYY");
  const [numberFormat, setNumberFormat] = useState<"1,234.56" | "1.234,56">("1,234.56");
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxName, setTaxName] = useState("VAT");
  const [defaultTaxRate, setDefaultTaxRate] = useState(0);

  // Step 5: Inventory Setup
  const [enableInventory, setEnableInventory] = useState(true);
  const [enableBarcode, setEnableBarcode] = useState(true);
  const [enableSku, setEnableSku] = useState(true);
  const [enableLowStockAlerts, setEnableLowStockAlerts] = useState(true);
  const [stockAlertLimit, setStockAlertLimit] = useState(10);
  const [enableBatchTracking, setEnableBatchTracking] = useState(false);
  const [enableExpiryTracking, setEnableExpiryTracking] = useState(false);

  // Step 6: POS Setup
  const [enablePOS, setEnablePOS] = useState(true);
  const [paymentMethods, setPaymentMethods] = useState({
    cash: true,
    card: true,
    bankTransfer: true,
    mobileWallet: true,
    other: false,
  });
  const [receiptHeaderName, setReceiptHeaderName] = useState("");
  const [receiptPhone, setReceiptPhone] = useState("");
  const [receiptAddress, setReceiptAddress] = useState("");
  const [receiptShowLogo, setReceiptShowLogo] = useState(true);
  const [receiptFooter, setReceiptFooter] = useState("Thank you for choosing us!");

  // Step 7: Team Setup
  const [teamMembers, setTeamMembers] = useState<TeamMemberInvite[]>([]);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<TeamMemberInvite["role"]>("cashier");

  // Load Categories from database (admin is source of truth)
  useEffect(() => {
    if (!open) return;
    const fetchCats = async () => {
      setLoadingCategories(true);
      const { data, error } = await supabase
        .from("business_categories")
        .select("*")
        .eq("status", "active")
        .order("name", { ascending: true });

      if (error) {
        toast({
          title: "Error loading categories",
          description: error.message,
          variant: "destructive",
        });
      } else {
        setCategories((data as any[]) || []);
        if (data && data.length > 0 && !selectedCategoryId) {
          setSelectedCategoryId(data[0].id);
          if (data[0].currency) {
            setCurrency(data[0].currency);
          }
          if (data[0].default_tax !== undefined) {
            setDefaultTaxRate(Number(data[0].default_tax || 0));
            if (Number(data[0].default_tax) > 0) setTaxEnabled(true);
          }
        }
      }
      setLoadingCategories(false);
    };

    fetchCats();
  }, [open, toast]);

  // Detected selected category object
  const selectedCategory = useMemo(() => {
    return categories.find((c) => c.id === selectedCategoryId) || null;
  }, [categories, selectedCategoryId]);

  // Apply smart category defaults when user picks a category
  const handleCategorySelect = (cat: BusinessCategoryDef) => {
    setSelectedCategoryId(cat.id);
    if (cat.currency) setCurrency(cat.currency);
    if (cat.default_tax !== undefined) {
      setDefaultTaxRate(Number(cat.default_tax));
      setTaxEnabled(Number(cat.default_tax) > 0);
    }
    if (cat.stock_alert_limit) setStockAlertLimit(cat.stock_alert_limit);

    // Apply smart recommendations based on industry
    const ind = (cat.industry_type || cat.name || "").toLowerCase();
    if (ind.includes("pharmacy") || ind.includes("health") || ind.includes("food") || ind.includes("bakery")) {
      setEnableBatchTracking(true);
      setEnableExpiryTracking(true);
    } else if (ind.includes("retail") || ind.includes("supermarket") || ind.includes("electronics")) {
      setEnableBarcode(true);
      setEnableSku(true);
      setEnableBatchTracking(false);
      setEnableExpiryTracking(false);
    }
  };

  // Step names
  const stepsList = [
    { n: 1, label: "Basic Info", icon: Building2 },
    { n: 2, label: "Category", icon: Tag },
    { n: 3, label: "Location", icon: MapPin },
    { n: 4, label: "Settings", icon: Settings2 },
    { n: 5, label: "Inventory", icon: Package },
    { n: 6, label: "POS & Sales", icon: ShoppingCart },
    { n: 7, label: "Team", icon: Users },
    { n: 8, label: "Review", icon: CheckCircle2 },
  ];

  // Quick geolocation detect
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "Geolocation not supported", variant: "destructive" });
      return;
    }
    toast({ title: "Detecting location...", description: "Querying browser location." });
    navigator.geolocation.getCurrentPosition(
      () => {
        try {
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          if (tz) setTimezone(tz);
        } catch (e) {
          console.warn("Timezone resolution fallback", e);
        }
        toast({ title: "Location updated", description: "Timezone synchronized." });
      },
      () => {
        toast({ title: "Location permission denied", description: "You can enter address manually." });
      }
    );
  };

  // Add team member
  const handleAddTeamMember = () => {
    if (!newMemberName.trim() || !newMemberEmail.trim()) {
      toast({ title: "Please provide member name and email", variant: "destructive" });
      return;
    }
    setTeamMembers((prev) => [
      ...prev,
      {
        name: newMemberName.trim(),
        email: newMemberEmail.trim(),
        role: newMemberRole,
      },
    ]);
    setNewMemberName("");
    setNewMemberEmail("");
  };

  const handleRemoveTeamMember = (index: number) => {
    setTeamMembers((prev) => prev.filter((_, i) => i !== index));
  };

  // Navigation handlers
  const handleNext = () => {
    if (step === 1) {
      if (!businessName.trim()) {
        toast({ title: "Business Name is required", variant: "destructive" });
        return;
      }
      if (!receiptHeaderName) setReceiptHeaderName(businessName.trim());
    }
    if (step === 2) {
      if (!selectedCategoryId) {
        toast({ title: "Please select a Business Category", variant: "destructive" });
        return;
      }
    }
    if (step === 3) {
      if (!city.trim() && !address.trim()) {
        // Soft autofill if completely empty
        if (!city.trim()) setCity("Central District");
      }
    }
    setStep((s) => Math.min(8, s + 1));
  };

  const handleBack = () => {
    setStep((s) => Math.max(1, s - 1));
  };

  // Final Submit
  const handleCreateBusiness = async () => {
    setSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast({
          title: "Authentication Required",
          description: "Please log in to register a business.",
          variant: "destructive",
        });
        return;
      }

      // Format location string
      const fullAddressParts = [address, areaLocality, city, stateProvince, country]
        .filter((p) => Boolean(p && p.trim()))
        .join(", ");

      const chosenCurrency = (currency || "USD").toUpperCase();

      const { data: newBiz, error } = await supabase
        .from("businesses")
        .insert({
          owner_user_id: user.id,
          business_name: businessName.trim(),
          business_address: fullAddressParts || null,
          category_id: selectedCategoryId || null,
          currency: chosenCurrency,
          base_currency: chosenCurrency,
          default_tax: taxEnabled ? Number(defaultTaxRate || 0) : 0,
          stock_alert_limit: enableLowStockAlerts ? Number(stockAlertLimit || 10) : 10,
          status: "active",
        })
        .select()
        .single();

      if (error) throw error;

      // Save extended settings (inventory, POS, receipt, team)
      const extendedData: BusinessExtendedData = {
        logoUrl: logoUrl.trim() || undefined,
        description: description.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        website: website.trim() || undefined,
        location: {
          country,
          stateProvince,
          city,
          areaLocality,
          address,
          postalZip,
        },
        timezone,
        dateFormat,
        numberFormat,
        taxEnabled,
        taxName,
        inventory: {
          enableInventory,
          enableBarcode,
          enableSku,
          enableLowStockAlerts,
          stockAlertLimit,
          enableBatchTracking,
          enableExpiryTracking,
        },
        pos: {
          enablePOS,
          paymentMethods,
          receipt: {
            headerName: receiptHeaderName || businessName.trim(),
            phone: receiptPhone || phone.trim(),
            address: receiptAddress || fullAddressParts,
            showLogo: receiptShowLogo,
            footerMessage: receiptFooter,
          },
        },
        teamInvites: teamMembers,
      };

      if (newBiz?.id) {
        saveExtendedBusinessData(newBiz.id, extendedData);
      }

      // Trigger currency and active business refresh
      await refreshBusinessMoney();
      window.dispatchEvent(new CustomEvent("geflow:business-changed", { detail: { id: newBiz.id, currency: chosenCurrency } }));
      window.dispatchEvent(new CustomEvent("geflow:business-updated", { detail: { id: newBiz.id, currency: chosenCurrency } }));
      window.dispatchEvent(new CustomEvent("geflow:currency-changed", { detail: { currency: chosenCurrency } }));

      setCreatedBiz({
        id: newBiz.id,
        name: newBiz.business_name,
        categoryName: selectedCategory?.name || "Business",
        currency: chosenCurrency,
      });

      // Advance to success step (Step 9)
      setStep(9);
      onCreated(newBiz.id);
    } catch (err: any) {
      toast({
        title: "Creation Failed",
        description: err.message || "Could not create business.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered Currencies for Search
  const filteredCurrencies = useMemo(() => {
    if (!currencySearch.trim()) return CURRENCIES;
    const q = currencySearch.toLowerCase();
    return CURRENCIES.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.symbol.toLowerCase().includes(q)
    );
  }, [currencySearch]);

  // Filtered Categories for Search
  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return categories;
    const q = categorySearch.toLowerCase();
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.industry_type.toLowerCase().includes(q)
    );
  }, [categories, categorySearch]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 rounded-3xl border-border bg-card">
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-sky-500/10 via-primary/10 to-indigo-500/10 border-b border-border/70 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-sky-500 text-white flex items-center justify-center shadow-md shadow-sky-500/20">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                  Create New Business
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Configure your multi-tenant workspace with industry defaults and currency.
                </DialogDescription>
              </div>
            </div>
            {step < 9 && (
              <span className="text-xs font-extrabold uppercase tracking-widest text-sky-500 bg-sky-500/10 px-3 py-1 rounded-full border border-sky-500/20">
                Step {step} of 8
              </span>
            )}
          </div>

          {/* Stepper Navigation bar */}
          {step < 9 && (
            <div className="grid grid-cols-8 gap-1.5 mt-6 pt-2">
              {stepsList.map((st) => {
                const isActive = step === st.n;
                const isDone = step > st.n;
                const Icon = st.icon;
                return (
                  <button
                    key={st.n}
                    type="button"
                    onClick={() => {
                      if (st.n < step) setStep(st.n);
                    }}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-xl text-center transition-all ${
                      isActive
                        ? "bg-card text-sky-500 shadow-xs border border-sky-500/30 font-bold"
                        : isDone
                        ? "text-emerald-500 hover:bg-card/50 cursor-pointer"
                        : "text-muted-foreground/60 cursor-default"
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        isDone
                          ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
                          : isActive
                          ? "bg-sky-500 text-white shadow-xs"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : st.n}
                    </div>
                    <span className="text-[10px] truncate w-full hidden md:inline-block">
                      {st.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Wizard Form Body */}
        <div className="p-6">
          {/* STEP 1: Basic Information */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div>
                <h3 className="text-base font-bold text-foreground">Basic Information</h3>
                <p className="text-xs text-muted-foreground">
                  Provide primary brand and contact details for this business node.
                </p>
              </div>

              <div className="space-y-3.5 pt-2">
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">
                    Business Name <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Apex Health Logistics"
                    className="rounded-xl h-11 text-xs sm:text-sm"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">
                    Logo / Avatar URL (Optional)
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      placeholder="https://example.com/logo.png"
                      className="rounded-xl h-11 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">
                    Business Description
                  </label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of products, services or branch purpose..."
                    rows={2}
                    className="rounded-xl text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-xs font-bold text-foreground block mb-1">
                      Business Phone
                    </label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <Input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+1 555 0192"
                        className="rounded-xl h-11 pl-9 text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-foreground block mb-1">
                      Business Email
                    </label>
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <Input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="contact@apexlogistics.com"
                        type="email"
                        className="rounded-xl h-11 pl-9 text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">
                    Website URL
                  </label>
                  <div className="relative">
                    <Globe className="w-3.5 h-3.5 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <Input
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://apexlogistics.com"
                      className="rounded-xl h-11 pl-9 text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Business Category */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div>
                <h3 className="text-base font-bold text-foreground">Business Category</h3>
                <p className="text-xs text-muted-foreground">
                  Categories configured in the Admin Panel dynamically determine recommended modules, tax, and inventory settings.
                </p>
              </div>

              {/* Search Category */}
              <div className="relative">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  placeholder="Search available business categories..."
                  className="rounded-xl h-10 pl-9 text-xs"
                />
              </div>

              {loadingCategories ? (
                <div className="p-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-sky-500" /> Loading active categories from database...
                </div>
              ) : filteredCategories.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-muted/20 border border-dashed border-border text-xs text-muted-foreground">
                  No active categories found matching your query.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[340px] overflow-y-auto pr-1">
                  {filteredCategories.map((cat) => {
                    const isSelected = selectedCategoryId === cat.id;
                    return (
                      <div
                        key={cat.id}
                        onClick={() => handleCategorySelect(cat)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-left flex flex-col justify-between ${
                          isSelected
                            ? "bg-sky-500/10 border-sky-500 shadow-xs ring-1 ring-sky-500/30"
                            : "bg-card border-border hover:border-sky-500/40 hover:bg-muted/30"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold text-foreground">
                              {cat.name}
                            </span>
                            <Badge variant="outline" className="text-[10px] font-bold uppercase">
                              {cat.industry_type || "Retail"}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                            {cat.internal_description || `Standard ${cat.industry_type} workflow with automated module assignment.`}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-border/50 text-[10px] text-muted-foreground font-semibold">
                          <span>Base: {cat.currency || "USD"}</span>
                          <span>Tax: {cat.default_tax ?? 0}%</span>
                          {isSelected && (
                            <span className="text-sky-500 font-extrabold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Selected
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Location */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-foreground">Location &amp; Address</h3>
                  <p className="text-xs text-muted-foreground">
                    Specify the physical location or regional center for invoices and receipts.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleUseCurrentLocation}
                  className="rounded-xl text-xs h-8 gap-1.5 text-sky-500"
                >
                  <MapPin className="w-3.5 h-3.5" /> Auto-Detect
                </Button>
              </div>

              <div className="space-y-3.5 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-xs font-bold text-foreground block mb-1">
                      Country <span className="text-rose-500">*</span>
                    </label>
                    <Select value={country} onValueChange={setCountry}>
                      <SelectTrigger className="rounded-xl h-11 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="text-xs max-h-56">
                        {COUNTRIES.map((c) => (
                          <SelectItem key={c.code} value={c.name}>
                            {c.name} ({c.currency})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-foreground block mb-1">
                      City <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. San Francisco or Karachi"
                      className="rounded-xl h-11 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-xs font-bold text-foreground block mb-1">
                      State / Province
                    </label>
                    <Input
                      value={stateProvince}
                      onChange={(e) => setStateProvince(e.target.value)}
                      placeholder="e.g. California or Sindh"
                      className="rounded-xl h-11 text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-foreground block mb-1">
                      Area / Locality / District
                    </label>
                    <Input
                      value={areaLocality}
                      onChange={(e) => setAreaLocality(e.target.value)}
                      placeholder="e.g. Downtown / Clifton"
                      className="rounded-xl h-11 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">
                    Street Address
                  </label>
                  <Input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. 742 Innovation Drive, Suite 400"
                    className="rounded-xl h-11 text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">
                    Postal / ZIP Code
                  </label>
                  <Input
                    value={postalZip}
                    onChange={(e) => setPostalZip(e.target.value)}
                    placeholder="e.g. 94105"
                    className="rounded-xl h-11 text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Business Settings & Currency */}
          {step === 4 && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div>
                <h3 className="text-base font-bold text-foreground">Currency &amp; Localization</h3>
                <p className="text-xs text-muted-foreground">
                  Select your primary operational currency and regional formatting.
                </p>
              </div>

              {/* Immutable Notice Banner */}
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-start gap-2.5">
                <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold">Permanent Currency &amp; Default Tax Selection</p>
                  <p className="text-[11px] opacity-90 mt-0.5">
                    Your chosen currency and tax rate are permanently locked at registration to maintain financial records integrity and cannot be modified later.
                  </p>
                </div>
              </div>

              <div className="space-y-4 pt-1">
                {/* Search Currency */}
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">
                    Base Currency <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger className="rounded-xl h-11 text-xs font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="text-xs max-h-56">
                        {CURRENCIES.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.code} — {c.name} ({c.symbol})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-xs flex items-center justify-between">
                      <span className="text-muted-foreground font-semibold">Active Currency:</span>
                      <span className="font-extrabold text-sky-500">{currencyLabel(currency)}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-xs font-bold text-foreground block mb-1">
                      Timezone <span className="text-rose-500">*</span>
                    </label>
                    <Select value={timezone} onValueChange={setTimezone}>
                      <SelectTrigger className="rounded-xl h-11 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="text-xs max-h-56">
                        {TIMEZONES.map((tz) => (
                          <SelectItem key={tz} value={tz}>
                            {tz}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-foreground block mb-1">
                      Date Format
                    </label>
                    <Select
                      value={dateFormat}
                      onValueChange={(v: any) => setDateFormat(v)}
                    >
                      <SelectTrigger className="rounded-xl h-11 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="text-xs">
                        <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (e.g. 15/08/2026)</SelectItem>
                        <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (e.g. 08/15/2026)</SelectItem>
                        <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-08-15)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Tax Configuration Toggle */}
                <div className="p-4 rounded-2xl bg-muted/20 border border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-foreground block">
                        Enable Automated Tax Calculations
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Apply global sales tax / VAT to invoices and POS receipts.
                      </span>
                    </div>
                    <Switch checked={taxEnabled} onCheckedChange={setTaxEnabled} />
                  </div>

                  {taxEnabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/60">
                      <div>
                        <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                          Tax Label / Name
                        </label>
                        <Input
                          value={taxName}
                          onChange={(e) => setTaxName(e.target.value)}
                          placeholder="e.g. GST or VAT"
                          className="rounded-xl h-9 text-xs"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                          Default Tax Rate (%)
                        </label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={defaultTaxRate}
                          onChange={(e) => setDefaultTaxRate(parseFloat(e.target.value) || 0)}
                          className="rounded-xl h-9 text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Inventory Setup */}
          {step === 5 && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div>
                <h3 className="text-base font-bold text-foreground">Inventory Setup</h3>
                <p className="text-xs text-muted-foreground">
                  Configure tracking controls and threshold triggers for this business branch.
                </p>
              </div>

              {/* Recommended features banner */}
              {selectedCategory && (
                <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-xs flex items-center gap-2.5 text-sky-500">
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>
                    Auto-calibrated for <strong>{selectedCategory.name}</strong> industry requirements.
                  </span>
                </div>
              )}

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/20 border border-border">
                  <div>
                    <span className="text-xs font-bold text-foreground block">
                      Enable Real-time Inventory Ledger
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Track item quantities, stock in/out movements, and valuation.
                    </span>
                  </div>
                  <Switch checked={enableInventory} onCheckedChange={setEnableInventory} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/20 border border-border">
                    <span className="text-xs font-bold text-foreground">Barcode Scanning</span>
                    <Switch checked={enableBarcode} onCheckedChange={setEnableBarcode} />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/20 border border-border">
                    <span className="text-xs font-bold text-foreground">Automatic SKU Generator</span>
                    <Switch checked={enableSku} onCheckedChange={setEnableSku} />
                  </div>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/20 border border-border">
                  <div>
                    <span className="text-xs font-bold text-foreground block">
                      Low Stock Alerts
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Trigger visual warnings when available quantity drops below threshold.
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      min="1"
                      value={stockAlertLimit}
                      onChange={(e) => setStockAlertLimit(parseInt(e.target.value) || 5)}
                      className="w-16 h-8 text-xs text-center rounded-xl"
                      disabled={!enableLowStockAlerts}
                    />
                    <Switch checked={enableLowStockAlerts} onCheckedChange={setEnableLowStockAlerts} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/20 border border-border">
                    <div>
                      <span className="text-xs font-bold text-foreground block">Batch Tracking</span>
                      <span className="text-[10px] text-muted-foreground">Lot / Batch numbers</span>
                    </div>
                    <Switch checked={enableBatchTracking} onCheckedChange={setEnableBatchTracking} />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/20 border border-border">
                    <div>
                      <span className="text-xs font-bold text-foreground block">Expiry Tracking</span>
                      <span className="text-[10px] text-muted-foreground">Perishable goods alert</span>
                    </div>
                    <Switch checked={enableExpiryTracking} onCheckedChange={setEnableExpiryTracking} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: POS Setup */}
          {step === 6 && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div>
                <h3 className="text-base font-bold text-foreground">POS Terminal &amp; Receipts</h3>
                <p className="text-xs text-muted-foreground">
                  Configure payment methods and customer receipt details.
                </p>
              </div>

              <div className="space-y-3.5 pt-2">
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/20 border border-border">
                  <div>
                    <span className="text-xs font-bold text-foreground block">
                      Enable Point of Sale (POS)
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Fast checkout register with barcode and cart checkout.
                    </span>
                  </div>
                  <Switch checked={enablePOS} onCheckedChange={setEnablePOS} />
                </div>

                {/* Payment Methods */}
                <div className="p-4 rounded-2xl bg-muted/20 border border-border space-y-2.5">
                  <span className="text-xs font-bold text-foreground block">
                    Accepted Payment Methods
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={paymentMethods.cash}
                        onChange={(e) =>
                          setPaymentMethods((p) => ({ ...p, cash: e.target.checked }))
                        }
                        className="rounded"
                      />
                      <span>Cash</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={paymentMethods.card}
                        onChange={(e) =>
                          setPaymentMethods((p) => ({ ...p, card: e.target.checked }))
                        }
                        className="rounded"
                      />
                      <span>Credit / Debit Card</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={paymentMethods.bankTransfer}
                        onChange={(e) =>
                          setPaymentMethods((p) => ({ ...p, bankTransfer: e.target.checked }))
                        }
                        className="rounded"
                      />
                      <span>Bank Transfer</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={paymentMethods.mobileWallet}
                        onChange={(e) =>
                          setPaymentMethods((p) => ({ ...p, mobileWallet: e.target.checked }))
                        }
                        className="rounded"
                      />
                      <span>Mobile Wallet (JazzCash / EasyPaisa / ApplePay)</span>
                    </label>
                  </div>
                </div>

                {/* Receipt Customization */}
                <div className="p-4 rounded-2xl bg-muted/20 border border-border space-y-3">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-sky-500" />
                    <span className="text-xs font-bold text-foreground">Receipt Customization</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                        Header Business Name
                      </label>
                      <Input
                        value={receiptHeaderName}
                        onChange={(e) => setReceiptHeaderName(e.target.value)}
                        placeholder={businessName || "Business Name"}
                        className="rounded-xl h-9 text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                        Receipt Footer Note
                      </label>
                      <Input
                        value={receiptFooter}
                        onChange={(e) => setReceiptFooter(e.target.value)}
                        placeholder="Thank you for your business!"
                        className="rounded-xl h-9 text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 7: Team Setup */}
          {step === 7 && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div>
                <h3 className="text-base font-bold text-foreground">Team Setup &amp; Invites</h3>
                <p className="text-xs text-muted-foreground">
                  You are registered as the Owner. You can invite additional managers or cashiers now, or skip this step.
                </p>
              </div>

              {/* Add member inputs */}
              <div className="p-4 rounded-2xl bg-muted/20 border border-border space-y-3">
                <span className="text-xs font-bold text-foreground block">
                  Add Team Member Invite
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <Input
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    placeholder="Full Name"
                    className="rounded-xl h-9 text-xs"
                  />
                  <Input
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    placeholder="Email address"
                    type="email"
                    className="rounded-xl h-9 text-xs"
                  />
                  <div className="flex gap-2">
                    <Select
                      value={newMemberRole}
                      onValueChange={(v: any) => setNewMemberRole(v)}
                    >
                      <SelectTrigger className="rounded-xl h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="text-xs">
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="cashier">Cashier</SelectItem>
                        <SelectItem value="inventory_clerk">Inventory Clerk</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddTeamMember}
                      className="rounded-xl h-9 px-3 bg-sky-500 hover:bg-sky-600 text-white font-bold"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Members list */}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                <div className="p-3 rounded-2xl bg-card border border-border flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-sky-500/15 text-sky-500 flex items-center justify-center font-bold text-xs">
                      O
                    </div>
                    <div>
                      <span className="font-bold text-foreground">You (Creator)</span>
                      <span className="text-muted-foreground block text-[11px]">Primary Workspace Owner</span>
                    </div>
                  </div>
                  <Badge className="bg-sky-500/15 text-sky-500 border border-sky-500/20 font-bold uppercase text-[10px]">
                    Owner
                  </Badge>
                </div>

                {teamMembers.map((m, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-2xl bg-card border border-border flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-muted text-muted-foreground flex items-center justify-center font-bold text-xs">
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-bold text-foreground">{m.name}</span>
                        <span className="text-muted-foreground block text-[11px]">{m.email}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] font-bold uppercase">
                        {m.role}
                      </Badge>
                      <button
                        type="button"
                        onClick={() => handleRemoveTeamMember(idx)}
                        className="text-muted-foreground hover:text-rose-500 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 8: Review & Create */}
          {step === 8 && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div>
                <h3 className="text-base font-bold text-foreground">Review &amp; Launch</h3>
                <p className="text-xs text-muted-foreground">
                  Confirm the configuration details before provisioning your new business node.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                <div className="p-4 rounded-2xl bg-muted/20 border border-border space-y-2 text-xs">
                  <span className="text-[10px] font-extrabold tracking-widest text-muted-foreground uppercase">
                    BUSINESS IDENTITY
                  </span>
                  <div className="font-bold text-foreground text-sm">{businessName}</div>
                  <div className="text-sky-500 font-bold">{selectedCategory?.name || "General"}</div>
                  <div className="text-muted-foreground text-[11px]">
                    {phone || "No phone provided"} | {email || "No email provided"}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-muted/20 border border-border space-y-2 text-xs">
                  <span className="text-[10px] font-extrabold tracking-widest text-muted-foreground uppercase">
                    CURRENCY &amp; LOCALIZATION
                  </span>
                  <div className="font-bold text-foreground text-sm">
                    {currencyLabel(currency)}
                  </div>
                  <div className="text-muted-foreground text-[11px]">
                    Timezone: {timezone} | Format: {dateFormat}
                  </div>
                  <div className="text-muted-foreground text-[11px]">
                    Tax: {taxEnabled ? `${taxName} (${defaultTaxRate}%)` : "Disabled"}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-muted/20 border border-border space-y-2 text-xs">
                  <span className="text-[10px] font-extrabold tracking-widest text-muted-foreground uppercase">
                    LOCATION
                  </span>
                  <div className="font-bold text-foreground">
                    {city || "Central"}, {country}
                  </div>
                  <div className="text-muted-foreground text-[11px] truncate">
                    {address || "Primary branch address"}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-muted/20 border border-border space-y-2 text-xs">
                  <span className="text-[10px] font-extrabold tracking-widest text-muted-foreground uppercase">
                    MODULES &amp; SERVICES
                  </span>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {enableInventory && (
                      <Badge variant="secondary" className="text-[10px]">Inventory</Badge>
                    )}
                    {enablePOS && (
                      <Badge variant="secondary" className="text-[10px]">POS Terminal</Badge>
                    )}
                    {enableBarcode && (
                      <Badge variant="secondary" className="text-[10px]">Barcode</Badge>
                    )}
                    {enableBatchTracking && (
                      <Badge variant="secondary" className="text-[10px]">Batch</Badge>
                    )}
                    {enableExpiryTracking && (
                      <Badge variant="secondary" className="text-[10px]">Expiry</Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 9: Success Confirmation */}
          {step === 9 && createdBiz && (
            <div className="text-center space-y-6 py-6 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 text-emerald-500 mx-auto flex items-center justify-center border-2 border-emerald-500/30">
                <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
              </div>

              <div>
                <h3 className="text-xl font-bold text-foreground">
                  Business Created Successfully!
                </h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                  <strong className="text-foreground">{createdBiz.name}</strong> is now live and synchronized with your workspace network.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-muted/30 border border-border max-w-md mx-auto grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                    Category
                  </span>
                  <span className="font-extrabold text-foreground">{createdBiz.categoryName}</span>
                </div>
                <div className="border-x border-border">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                    Currency
                  </span>
                  <span className="font-extrabold text-sky-500">{createdBiz.currency}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                    Status
                  </span>
                  <span className="font-extrabold text-emerald-500">ACTIVE</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <Button
                  onClick={() => {
                    localStorage.setItem("geflow.activeBusinessId", createdBiz.id);
                    window.dispatchEvent(new CustomEvent("geflow:business-changed"));
                    onOpenChange(false);
                    navigate("/dashboard");
                  }}
                  className="w-full sm:w-auto h-11 px-6 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-md shadow-sky-500/10"
                >
                  Open Business Workspace <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>

                <Button
                  variant="outline"
                  onClick={() => {
                    localStorage.setItem("geflow.activeBusinessId", createdBiz.id);
                    window.dispatchEvent(new CustomEvent("geflow:business-changed"));
                    onOpenChange(false);
                    navigate("/dashboard/inventory");
                  }}
                  className="w-full sm:w-auto h-11 px-5 rounded-2xl text-xs font-bold"
                >
                  Add First Product
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  className="w-full sm:w-auto h-11 px-4 rounded-2xl text-xs"
                >
                  Stay on My Businesses
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Controls */}
        {step < 9 && (
          <div className="p-6 border-t border-border bg-muted/10 flex items-center justify-between gap-3">
            {step > 1 ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                className="rounded-xl text-xs h-10 px-4 gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="rounded-xl text-xs h-10 px-4 text-muted-foreground"
              >
                Cancel
              </Button>
            )}

            {step < 8 ? (
              <Button
                type="button"
                onClick={handleNext}
                className="rounded-xl text-xs h-10 px-5 font-bold bg-sky-500 hover:bg-sky-600 text-white gap-1.5 shadow-xs"
              >
                Next Step <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <Button
                type="button"
                disabled={submitting}
                onClick={handleCreateBusiness}
                className="rounded-xl text-xs h-10 px-6 font-bold bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5 shadow-md shadow-emerald-500/10"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Provisioning...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" /> Create Business
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
