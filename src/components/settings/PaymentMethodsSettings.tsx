import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  CreditCard,
  Banknote,
  Smartphone,
  QrCode,
  Building2,
  FileText,
  Zap,
  Plus,
  Minus,
  Trash2,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  RefreshCw,
  Save,
  Info,
  Users,
  Wallet,
  ExternalLink,
  DollarSign,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import {
  BusinessPaymentMethod,
  PaymentMethodType,
  getBusinessPaymentMethods,
  saveBusinessPaymentMethods,
  fetchServerPaymentMethods,
  resolveBusinessCountry,
  getDefaultPaymentMethodsForCountry,
} from "@/lib/paymentMethods";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface Props {
  business: any;
  onSaved?: () => void;
}

export const PaymentMethodsSettings: React.FC<Props> = ({ business, onSaved }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [methods, setMethods] = useState<BusinessPaymentMethod[]>([]);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  // New Method Form State
  const [newMethodName, setNewMethodName] = useState("");
  const [newMethodType, setNewMethodType] = useState<PaymentMethodType>("wallet");
  const [newMethodDetails, setNewMethodDetails] = useState("");

  // Store Credit / Udhar Ledger State
  const [storeCredits, setStoreCredits] = useState<any[]>([]);
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [addBuyerOpen, setAddBuyerOpen] = useState(false);
  const [newBuyerName, setNewBuyerName] = useState("");
  const [newBuyerPhone, setNewBuyerPhone] = useState("");
  const [newBuyerCreditLimit, setNewBuyerCreditLimit] = useState("1000");
  const [creatingBuyer, setCreatingBuyer] = useState(false);

  // Quick Udhar Adjust Dialog State (+ Add debt, - Settle debt)
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [selectedBuyer, setSelectedBuyer] = useState<any>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustType, setAdjustType] = useState<"udhar_charge" | "udhar_repayment">("udhar_charge");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  const countryKey = resolveBusinessCountry(business);
  const businessId = business?.id;

  const loadCredits = useCallback(async (bId: string) => {
    if (!bId) return;
    setLoadingCredits(true);
    try {
      const res = await fetch(`/api/sync/store-credits?businessId=${bId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.credits)) {
          setStoreCredits(data.credits);
        }
      }
    } catch (e) {
      console.debug("Notice loading store credits:", e);
    } finally {
      setLoadingCredits(false);
    }
  }, []);

  useEffect(() => {
    if (businessId) {
      // 1. Initial cached or default methods
      setMethods(getBusinessPaymentMethods(business));

      // 2. Guaranteed server database fetch (survives refreshes & clears)
      fetchServerPaymentMethods(businessId).then((serverMethods) => {
        if (serverMethods && serverMethods.length > 0) {
          setMethods(serverMethods);
        }
      });

      // 3. Load Udhar / Store Credits collection
      loadCredits(businessId);
    }
  }, [businessId, loadCredits, business]);

  const handleCreateBuyer = async () => {
    if (!businessId || !newBuyerName.trim()) {
      toast({ title: "Name Required", description: "Please enter buyer name", variant: "destructive" });
      return;
    }
    setCreatingBuyer(true);
    try {
      const res = await fetch("/api/sync/store-credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          customerName: newBuyerName.trim(),
          customerPhone: newBuyerPhone.trim(),
          creditLimit: parseFloat(newBuyerCreditLimit) || 1000,
          outstandingUdhar: 0,
          availableDeposit: 0,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Buyer Added", description: `${newBuyerName} registered to Udhar Khata.` });
        setNewBuyerName("");
        setNewBuyerPhone("");
        setAddBuyerOpen(false);
        loadCredits(businessId);
      } else {
        throw new Error(data.error || "Failed adding buyer");
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setCreatingBuyer(false);
    }
  };

  const handleAdjustUdhar = async () => {
    if (!businessId || !selectedBuyer?.id || !adjustAmount) {
      toast({ title: "Invalid Input", description: "Select buyer and enter amount", variant: "destructive" });
      return;
    }
    const amt = parseFloat(adjustAmount);
    if (isNaN(amt) || amt <= 0) {
      toast({ title: "Invalid Amount", description: "Enter valid positive amount", variant: "destructive" });
      return;
    }
    setAdjusting(true);
    try {
      const res = await fetch("/api/sync/store-credits/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          creditId: selectedBuyer.id,
          amount: amt,
          type: adjustType,
          note: adjustNote.trim() || (adjustType === "udhar_charge" ? "Added store credit" : "Received customer payment"),
          processedBy: "Owner/Admin",
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: adjustType === "udhar_charge" ? "Udhar Added" : "Payment Settled",
          description: `Updated balance for ${selectedBuyer.customerName}.`,
        });
        setAdjustOpen(false);
        setAdjustAmount("");
        setAdjustNote("");
        setSelectedBuyer(null);
        loadCredits(businessId);
      } else {
        throw new Error(data.error || "Failed updating udhar");
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setAdjusting(false);
    }
  };


  const handleToggle = (id: string, enabled: boolean) => {
    setMethods((prev) => {
      // Must have at least 1 method enabled
      if (!enabled && prev.filter((m) => m.enabled).length <= 1) {
        toast({
          title: "Cannot disable all payment methods",
          description: "At least one payment method must remain active for POS checkout.",
          variant: "destructive",
        });
        return prev;
      }

      const updated = prev.map((m) => {
        if (m.id === id) {
          return {
            ...m,
            enabled,
            isDefault: !enabled && m.isDefault ? false : m.isDefault,
          };
        }
        return m;
      });

      // If we disabled the default method, re-assign default to another enabled one
      const hasDefault = updated.some((m) => m.enabled && m.isDefault);
      if (!hasDefault) {
        const firstEnabled = updated.find((m) => m.enabled);
        if (firstEnabled) firstEnabled.isDefault = true;
      }

      // Auto-persist immediately to localStorage & sync server
      if (businessId) {
        saveBusinessPaymentMethods(businessId, updated).catch(console.warn);
      }

      const target = prev.find((m) => m.id === id);
      toast({
        title: `${target?.name || "Method"} ${enabled ? "Enabled" : "Disabled"}`,
        description: enabled
          ? "Now available in POS checkout and customer receipts."
          : "Hidden from POS terminal.",
      });

      return updated;
    });
  };

  const handleSetDefault = (id: string) => {
    setMethods((prev) => {
      const updated = prev.map((m) => ({
        ...m,
        isDefault: m.id === id,
        enabled: m.id === id ? true : m.enabled,
      }));

      if (businessId) {
        saveBusinessPaymentMethods(businessId, updated).catch(console.warn);
      }

      const target = prev.find((m) => m.id === id);
      toast({
        title: "Default payment method updated",
        description: `${target?.name || "Method"} will be preselected during checkout.`,
      });

      return updated;
    });
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    setMethods((prev) => {
      const copy = [...prev];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= copy.length) return prev;
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      const updated = copy.map((m, idx) => ({ ...m, sortOrder: idx + 1 }));

      if (businessId) {
        saveBusinessPaymentMethods(businessId, updated).catch(console.warn);
      }

      return updated;
    });
  };

  const handleDelete = (id: string) => {
    setMethods((prev) => {
      const updated = prev.filter((m) => m.id !== id);
      if (businessId) {
        saveBusinessPaymentMethods(businessId, updated).catch(console.warn);
      }
      toast({
        title: "Custom method removed",
        description: "Payment method deleted successfully.",
      });
      return updated;
    });
  };

  const handleResetDefaults = () => {
    const defaults = getDefaultPaymentMethodsForCountry(countryKey);
    setMethods(defaults);
    if (businessId) {
      saveBusinessPaymentMethods(businessId, defaults).catch(console.warn);
    }
    toast({
      title: "Reset to Country Defaults",
      description: `Loaded standard payment methods for ${countryKey.toUpperCase()}.`,
    });
  };

  const handleAddCustom = () => {
    const cleanName = newMethodName.trim();
    if (!cleanName) {
      toast({
        title: "Name required",
        description: "Please enter a name for the payment method.",
        variant: "destructive",
      });
      return;
    }

    const newId = `custom_${cleanName.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${Date.now()}`;
    let iconName = "CreditCard";
    if (newMethodType === "cash") iconName = "Banknote";
    if (newMethodType === "wallet" || newMethodType === "digital") iconName = "Smartphone";
    if (newMethodType === "bank") iconName = "Building2";
    if (newMethodType === "credit") iconName = "FileText";

    const newItem: BusinessPaymentMethod = {
      id: newId,
      name: cleanName,
      type: newMethodType,
      iconName,
      enabled: true,
      isDefault: false,
      accountDetails: newMethodDetails.trim(),
      sortOrder: methods.length + 1,
    };

    setMethods((prev) => [...prev, newItem]);
    setNewMethodName("");
    setNewMethodDetails("");
    setAddOpen(false);
    toast({
      title: "Method added",
      description: `Added "${cleanName}". Don't forget to click Save Changes.`,
    });
  };

  const handleSave = async () => {
    if (!business?.id) return;
    setSaving(true);
    try {
      await saveBusinessPaymentMethods(business.id, methods);
      toast({
        title: "Payment methods saved",
        description: "Your POS terminal and store checkout have been synchronized.",
      });
      onSaved?.();
    } catch (err: any) {
      toast({
        title: "Failed to save",
        description: err.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const renderIcon = (type: PaymentMethodType, iconName?: string) => {
    if (type === "cash" || iconName === "Banknote") return <Banknote className="h-4 w-4 text-emerald-500" />;
    if (type === "card" || iconName === "CreditCard") return <CreditCard className="h-4 w-4 text-sky-500" />;
    if (type === "wallet" || iconName === "Smartphone") return <Smartphone className="h-4 w-4 text-purple-500" />;
    if (type === "digital" || iconName === "QrCode") return <QrCode className="h-4 w-4 text-amber-500" />;
    if (type === "bank" || iconName === "Building2") return <Building2 className="h-4 w-4 text-indigo-500" />;
    if (type === "credit" || iconName === "FileText") return <FileText className="h-4 w-4 text-rose-500" />;
    return <Zap className="h-4 w-4 text-sky-500" />;
  };

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-card border border-border">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-foreground">POS & Billing Payment Methods</h3>
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-500 border border-sky-500/20">
              {countryKey.toUpperCase()} REGION
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure payment methods visible on your POS terminal, receipts, and split payments.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleResetDefaults}
            className="h-9 px-3 rounded-xl text-xs font-bold gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Reset Defaults
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => setAddOpen(true)}
            className="h-9 px-3 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Add Method
          </Button>
        </div>
      </div>

      {/* Methods List */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
        {methods.map((method, index) => (
          <div
            key={method.id}
            className={`p-4 flex items-center justify-between gap-4 transition ${
              method.enabled ? "bg-card" : "bg-muted/30 opacity-60"
            }`}
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-muted/60 border border-border/80 flex items-center justify-center shrink-0">
                {renderIcon(method.type, method.iconName)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-foreground truncate">{method.name}</span>
                  {method.isDefault && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      DEFAULT
                    </span>
                  )}
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground px-1.5 py-0.2 rounded bg-muted">
                    {method.type}
                  </span>
                </div>
                {method.accountDetails ? (
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    Account: {method.accountDetails}
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Available in POS terminal
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Up / Down sort */}
              <div className="flex items-center">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => handleMove(index, "up")}
                  className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                  title="Move Up"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={index === methods.length - 1}
                  onClick={() => handleMove(index, "down")}
                  className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                  title="Move Down"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Set Default */}
              {!method.isDefault && method.enabled && (
                <button
                  type="button"
                  onClick={() => handleSetDefault(method.id)}
                  className="text-[11px] font-bold text-muted-foreground hover:text-primary px-2 py-1 rounded-lg hover:bg-muted cursor-pointer transition hidden sm:inline-block"
                >
                  Make Default
                </button>
              )}

              {/* Toggle Switch */}
              <div className="flex items-center gap-2 pl-3 border-l border-border">
                <span className={`text-[11px] font-bold select-none ${method.enabled ? "text-emerald-500" : "text-muted-foreground"}`}>
                  {method.enabled ? "Enabled" : "Disabled"}
                </span>
                <Switch
                  id={`payment-method-switch-${method.id}`}
                  checked={method.enabled}
                  onCheckedChange={(val) => handleToggle(method.id, val)}
                  aria-label={`Enable or disable ${method.name}`}
                />
              </div>

              {/* Delete if custom */}
              {method.id.startsWith("custom_") && (
                <button
                  type="button"
                  onClick={() => handleDelete(method.id)}
                  className="p-1.5 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                  title="Delete Custom Method"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-2">
        <Button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="h-11 px-6 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-sm shadow-md gap-2"
        >
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Payment Methods
        </Button>
      </div>

      {/* Store Credit & Udhar Customer Khata Collection */}
      <div className="p-6 rounded-3xl bg-card border border-border/80 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20 font-bold">
                <FileText className="h-4 w-4" />
              </div>
              <h3 className="text-base font-bold text-foreground">Store Credit &amp; Customer Udhar (Khata Collection)</h3>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Active Ledger
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Buyer accounts, outstanding credit (Udhar), and advance deposits saved in the central database collection.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAddBuyerOpen(true)}
              className="h-9 px-3.5 rounded-xl text-xs font-bold gap-1.5 border-border/80"
            >
              <Plus className="h-3.5 w-3.5" /> Add Buyer
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => navigate("/dashboard/customer-credits")}
              className="h-9 px-3.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold gap-1.5 shadow-sm"
            >
              Open Udhar Manager <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-muted/40 dark:bg-muted/20 border border-border/70 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-muted-foreground">Total Udhar Outstanding</span>
              <span className="h-6 w-6 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center text-xs font-bold">
                <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className="text-xl font-black text-rose-500">
              ${storeCredits.reduce((acc, c) => acc + (Number(c.outstandingUdhar) || 0), 0).toFixed(2)}
            </p>
            <p className="text-[10px] text-muted-foreground">Money owed by customers to store</p>
          </div>

          <div className="p-4 rounded-2xl bg-muted/40 dark:bg-muted/20 border border-border/70 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-muted-foreground">Advance Deposits Held</span>
              <span className="h-6 w-6 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-xs font-bold">
                <ArrowDownLeft className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className="text-xl font-black text-emerald-500">
              ${storeCredits.reduce((acc, c) => acc + (Number(c.availableDeposit) || 0), 0).toFixed(2)}
            </p>
            <p className="text-[10px] text-muted-foreground">Advance store credit held for checkout</p>
          </div>

          <div className="p-4 rounded-2xl bg-muted/40 dark:bg-muted/20 border border-border/70 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-muted-foreground">Registered Buyers</span>
              <span className="h-6 w-6 rounded-lg bg-sky-500/10 text-sky-500 flex items-center justify-center text-xs font-bold">
                <Users className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className="text-xl font-black text-foreground">{storeCredits.length} Buyers</p>
            <p className="text-[10px] text-muted-foreground">Linked to POS payment ledger</p>
          </div>
        </div>

        {/* Buyers Quick Ledger List */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between text-xs font-bold text-foreground">
            <span>Recent Udhar Buyer Records</span>
            {businessId && (
              <button
                type="button"
                onClick={() => loadCredits(businessId)}
                className="text-[11px] text-sky-500 hover:text-sky-600 flex items-center gap-1 font-semibold cursor-pointer"
              >
                <RefreshCw className={`h-3 w-3 ${loadingCredits ? "animate-spin" : ""}`} /> Refresh
              </button>
            )}
          </div>

          {storeCredits.length === 0 ? (
            <div className="p-6 text-center rounded-2xl border border-dashed border-border/80 bg-muted/20 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                No store credit or Udhar accounts recorded yet for this business.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setAddBuyerOpen(true)}
                className="h-8 rounded-xl text-xs font-bold"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add First Buyer
              </Button>
            </div>
          ) : (
            <div className="rounded-2xl border border-border overflow-hidden divide-y divide-border">
              {storeCredits.slice(0, 5).map((credit) => (
                <div key={credit.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground">{credit.customerName}</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {credit.buyerId || "BUY-10001"}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {credit.customerPhone || "No phone"} • Limit: ${credit.creditLimit ?? 1000}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Udhar Debt</p>
                      <p className={`text-xs font-black ${Number(credit.outstandingUdhar) > 0 ? "text-rose-500" : "text-emerald-500"}`}>
                        ${Number(credit.outstandingUdhar || 0).toFixed(2)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedBuyer(credit);
                          setAdjustType("udhar_charge");
                          setAdjustOpen(true);
                        }}
                        className="h-8 px-2.5 rounded-xl text-[11px] font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 border-rose-500/20"
                        title="Add Udhar (Customer Owes)"
                      >
                        <Plus className="h-3 w-3 mr-0.5" /> Udhar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedBuyer(credit);
                          setAdjustType("udhar_repayment");
                          setAdjustOpen(true);
                        }}
                        className="h-8 px-2.5 rounded-xl text-[11px] font-bold text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10 border-emerald-500/20"
                        title="Settle Payment (Minus Udhar)"
                      >
                        <Minus className="h-3 w-3 mr-0.5" /> Settle
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Custom Method Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Add Custom Payment Method</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-bold text-muted-foreground">Method Name</Label>
              <Input
                value={newMethodName}
                onChange={(e) => setNewMethodName(e.target.value)}
                placeholder="e.g. Nayapay, Sadapay, Store Gift Card, Crypto"
                className="mt-1 h-10 rounded-xl"
              />
            </div>

            <div>
              <Label className="text-xs font-bold text-muted-foreground">Category / Type</Label>
              <Select
                value={newMethodType}
                onValueChange={(val) => setNewMethodType(val as PaymentMethodType)}
              >
                <SelectTrigger className="mt-1 h-10 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wallet">Mobile Wallet (Easypaisa, JazzCash, Paytm)</SelectItem>
                  <SelectItem value="digital">Digital / UPI / QR</SelectItem>
                  <SelectItem value="card">Card / Terminal</SelectItem>
                  <SelectItem value="bank">Bank Transfer</SelectItem>
                  <SelectItem value="credit">Customer Credit / Udhar</SelectItem>
                  <SelectItem value="cash">Cash Counter</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-bold text-muted-foreground">Account / Merchant Details (Optional)</Label>
              <Input
                value={newMethodDetails}
                onChange={(e) => setNewMethodDetails(e.target.value)}
                placeholder="e.g. 0300-1234567 or IBAN / Till Number"
                className="mt-1 h-10 rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button onClick={handleAddCustom} className="rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold">
              Add to List
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add New Buyer Dialog */}
      <Dialog open={addBuyerOpen} onOpenChange={setAddBuyerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Register New Udhar Buyer Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-3.5 py-2">
            <div>
              <Label className="text-xs font-bold text-muted-foreground">Customer / Buyer Full Name *</Label>
              <Input
                value={newBuyerName}
                onChange={(e) => setNewBuyerName(e.target.value)}
                placeholder="e.g. Tariq Mehmood, Apex Mart"
                className="mt-1 h-10 rounded-xl"
              />
            </div>

            <div>
              <Label className="text-xs font-bold text-muted-foreground">Phone Number</Label>
              <Input
                value={newBuyerPhone}
                onChange={(e) => setNewBuyerPhone(e.target.value)}
                placeholder="e.g. +92 300 1234567"
                className="mt-1 h-10 rounded-xl"
              />
            </div>

            <div>
              <Label className="text-xs font-bold text-muted-foreground">Credit Limit ($)</Label>
              <Input
                type="number"
                value={newBuyerCreditLimit}
                onChange={(e) => setNewBuyerCreditLimit(e.target.value)}
                placeholder="1000"
                className="mt-1 h-10 rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddBuyerOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={handleCreateBuyer}
              disabled={creatingBuyer}
              className="rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold"
            >
              {creatingBuyer ? "Saving..." : "Create Buyer Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Adjust Udhar Dialog (+ Add / - Minus) */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {adjustType === "udhar_charge" ? "Add Customer Udhar (+ Debt)" : "Record Udhar Settlement (- Repayment)"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3.5 py-2">
            <div className="p-3 rounded-xl bg-muted/40 border border-border">
              <p className="text-xs font-bold text-foreground">{selectedBuyer?.customerName}</p>
              <p className="text-[11px] text-muted-foreground">
                Current Udhar Debt: <strong className="text-rose-500">${Number(selectedBuyer?.outstandingUdhar || 0).toFixed(2)}</strong>
              </p>
            </div>

            <div>
              <Label className="text-xs font-bold text-muted-foreground">Operation</Label>
              <Select value={adjustType} onValueChange={(val: any) => setAdjustType(val)}>
                <SelectTrigger className="mt-1 h-10 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="udhar_charge">+ Add Udhar (Customer purchased on credit)</SelectItem>
                  <SelectItem value="udhar_repayment">- Minus / Settle Udhar (Customer paid cash/card)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-bold text-muted-foreground">Amount ($) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                placeholder="0.00"
                className="mt-1 h-10 rounded-xl font-bold"
              />
            </div>

            <div>
              <Label className="text-xs font-bold text-muted-foreground">Note / Reference</Label>
              <Input
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
                placeholder="e.g. Counter purchase or partial payment"
                className="mt-1 h-10 rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={handleAdjustUdhar}
              disabled={adjusting}
              className={`rounded-xl text-white font-bold ${
                adjustType === "udhar_charge" ? "bg-rose-500 hover:bg-rose-600" : "bg-emerald-500 hover:bg-emerald-600"
              }`}
            >
              {adjusting ? "Processing..." : adjustType === "udhar_charge" ? "Confirm + Add Udhar" : "Confirm - Settle Udhar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

