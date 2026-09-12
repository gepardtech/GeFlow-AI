import React, { useState, useEffect } from "react";
import {
  CreditCard,
  Banknote,
  Smartphone,
  QrCode,
  Building2,
  FileText,
  Zap,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  RefreshCw,
  Save,
  Info,
} from "lucide-react";
import {
  BusinessPaymentMethod,
  PaymentMethodType,
  getBusinessPaymentMethods,
  saveBusinessPaymentMethods,
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
  const { toast } = useToast();
  const [methods, setMethods] = useState<BusinessPaymentMethod[]>([]);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  // New Method Form State
  const [newMethodName, setNewMethodName] = useState("");
  const [newMethodType, setNewMethodType] = useState<PaymentMethodType>("wallet");
  const [newMethodDetails, setNewMethodDetails] = useState("");

  const countryKey = resolveBusinessCountry(business);

  const businessId = business?.id;

  useEffect(() => {
    if (businessId) {
      setMethods(getBusinessPaymentMethods(business));
    }
  }, [businessId]);

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
    </div>
  );
};
