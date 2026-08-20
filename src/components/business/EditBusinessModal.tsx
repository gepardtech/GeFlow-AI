import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CURRENCIES, currencyLabel } from "@/lib/currencies";
import { COUNTRIES, TIMEZONES } from "@/lib/countries";
import { BusinessCategoryDef, BusinessItem } from "@/types/business";
import { getExtendedBusinessData, saveExtendedBusinessData } from "@/lib/businessStorage";
import { refreshBusinessMoney } from "@/lib/currency";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  AlertTriangle,
  Loader2,
  Phone,
  Mail,
  Globe,
  MapPin,
  CheckCircle2,
  Percent,
  Lock,
  DollarSign,
} from "lucide-react";

interface EditBusinessModalProps {
  business: BusinessItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export const EditBusinessModal = ({
  business,
  open,
  onOpenChange,
  onUpdated,
}: EditBusinessModalProps) => {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const [categories, setCategories] = useState<BusinessCategoryDef[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [originalCurrency, setOriginalCurrency] = useState("USD");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [defaultTax, setDefaultTax] = useState(0);
  const [stockAlertLimit, setStockAlertLimit] = useState(10);
  const [status, setStatus] = useState("active");

  // Load Categories & Current Values
  useEffect(() => {
    if (!open || !business) return;

    setName(business.business_name || "");
    setCategoryId(business.category_id || "");
    const cur = (business.currency || "USD").toUpperCase();
    setCurrency(cur);
    setOriginalCurrency(cur);
    setAddress(business.business_address || "");
    setDefaultTax(business.default_tax ?? 0);
    setStockAlertLimit(business.stock_alert_limit ?? 10);
    setStatus(business.status || "active");

    const ext = getExtendedBusinessData(business.id);
    setPhone(ext.phone || "");
    setEmail(ext.email || "");
    setWebsite(ext.website || "");
    setDescription(ext.description || "");
    setTimezone(ext.timezone || "UTC");

    const fetchCategories = async () => {
      setLoadingCategories(true);
      const { data } = await supabase
        .from("business_categories")
        .select("*")
        .order("name", { ascending: true });

      setCategories((data as any[]) || []);
      setLoadingCategories(false);
    };

    fetchCategories();
  }, [open, business]);

  const currencyChanged = currency !== originalCurrency;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business || !name.trim()) {
      toast({ title: "Business Name is required", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const chosenCurrency = (business.currency || "USD").toUpperCase();
    const fixedDefaultTax = Number(business.default_tax ?? 0);

    try {
      const { error } = await supabase
        .from("businesses")
        .update({
          business_name: name.trim(),
          business_address: address.trim() || null,
          category_id: categoryId || null,
          currency: chosenCurrency,
          base_currency: chosenCurrency,
          default_tax: fixedDefaultTax,
          stock_alert_limit: Number(stockAlertLimit || 10),
          status: status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", business.id);

      if (error) throw error;

      // Save extended info
      const ext = getExtendedBusinessData(business.id);
      saveExtendedBusinessData(business.id, {
        ...ext,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        website: website.trim() || undefined,
        description: description.trim() || undefined,
        timezone,
      });

      // Synchronize reactive caches
      await refreshBusinessMoney();
      window.dispatchEvent(new CustomEvent("geflow:business-changed", { detail: { id: business.id, currency: chosenCurrency } }));
      window.dispatchEvent(new CustomEvent("geflow:business-updated", { detail: { id: business.id, currency: chosenCurrency } }));
      window.dispatchEvent(new CustomEvent("geflow:currency-changed", { detail: { currency: chosenCurrency } }));

      toast({
        title: "Business Updated Successfully",
        description: `${name} configuration & currency (${chosenCurrency}) have been saved.`,
      });

      onOpenChange(false);
      onUpdated();
    } catch (err: any) {
      toast({
        title: "Update Failed",
        description: err.message || "Could not update business details.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 rounded-3xl border-border bg-card">
        <div className="bg-gradient-to-r from-sky-500/10 via-primary/10 to-indigo-500/10 border-b border-border p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500 text-white flex items-center justify-center shadow-md shadow-sky-500/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                Edit Business Details
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Modify category, currency, and operational parameters for {business?.business_name}.
              </DialogDescription>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* Basic Fields */}
          <div className="space-y-3.5">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">
                Business Name <span className="text-rose-500">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Business Name"
                className="rounded-xl h-11 text-xs sm:text-sm"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Category */}
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  Business Category
                </label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className="rounded-xl h-11 text-xs">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent className="text-xs max-h-56">
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name} {cat.status !== "active" ? "(Inactive)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  Status
                </label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="rounded-xl h-11 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="text-xs">
                    <SelectItem value="active">Active (Online)</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Immutable Currency & Tax Information */}
            <div className="p-4 rounded-2xl bg-muted/20 border border-border space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-xs font-bold text-foreground">
                    Base Currency &amp; Default Tax
                  </span>
                </div>
                <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                  Fixed at Registration
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="h-10 px-3 rounded-xl bg-card border border-border/80 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground font-semibold">Currency:</span>
                  <span className="text-xs font-bold text-sky-500">
                    {currencyLabel(originalCurrency)}
                  </span>
                </div>

                <div className="h-10 px-3 rounded-xl bg-card border border-border/80 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground font-semibold">Tax Rate:</span>
                  <span className="text-xs font-bold text-foreground">
                    {business?.default_tax ?? 0}%
                  </span>
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground leading-tight">
                Currency and default tax rate are locked to protect accounting history and cannot be modified.
              </p>
            </div>

            {/* Address */}
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">
                Branch Location &amp; Address
              </label>
              <div className="relative">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. 742 Evergreen Terrace, Springfield"
                  className="rounded-xl h-11 pl-9 text-xs"
                />
              </div>
            </div>

            {/* Contact details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  Phone Number
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
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contact@business.com"
                    type="email"
                    className="rounded-xl h-11 pl-9 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Inventory Alerts & Timezone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  Low Stock Alert Threshold
                </label>
                <Input
                  type="number"
                  min="1"
                  value={stockAlertLimit}
                  onChange={(e) => setStockAlertLimit(parseInt(e.target.value) || 5)}
                  className="rounded-xl h-11 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  Timezone
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
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-border gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-xs"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Saving Changes...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
