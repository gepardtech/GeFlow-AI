import { BusinessItem } from "@/types/business";
import { getExtendedBusinessData } from "@/lib/businessStorage";
import { currencyLabel, currencySymbol } from "@/lib/currencies";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Globe,
  Tag,
  DollarSign,
  Package,
  Calendar,
  CheckCircle2,
  Copy,
  ExternalLink,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BusinessDetailsDrawerProps {
  business: BusinessItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnterWorkspace: (business: BusinessItem) => void;
  onOpenEdit: (business: BusinessItem) => void;
  isActive: boolean;
}

export const BusinessDetailsDrawer = ({
  business,
  open,
  onOpenChange,
  onEnterWorkspace,
  onOpenEdit,
  isActive,
}: BusinessDetailsDrawerProps) => {
  const { toast } = useToast();

  if (!business) return null;

  const ext = getExtendedBusinessData(business.id);
  const cur = (business.currency || "USD").toUpperCase();

  const handleCopyId = () => {
    navigator.clipboard.writeText(business.id);
    toast({
      title: "Business ID Copied",
      description: `Copied ID: ${business.id}`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-0 rounded-3xl border-border bg-card">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-500/10 via-primary/10 to-indigo-500/10 border-b border-border p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-sky-500 text-white flex items-center justify-center shadow-md shadow-sky-500/20 font-bold text-xl">
                {business.business_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                    {business.business_name}
                  </DialogTitle>
                  {isActive && (
                    <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 text-[10px] uppercase font-bold">
                      Active Workspace
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-sky-500 font-bold tracking-wider uppercase mt-0.5">
                  {business.category_name || "General Commercial"}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyId}
              className="rounded-xl text-xs h-8 gap-1"
            >
              <Copy className="w-3.5 h-3.5" /> ID
            </Button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 text-xs">
          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="p-3 rounded-2xl bg-muted/20 border border-border">
              <span className="text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground block">
                Currency
              </span>
              <span className="text-sm font-extrabold text-sky-500 mt-0.5 block">
                {cur} ({currencySymbol(cur)})
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-muted/20 border border-border">
              <span className="text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground block">
                Default Tax
              </span>
              <span className="text-sm font-extrabold text-foreground mt-0.5 block">
                {business.default_tax ?? 0}%
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-muted/20 border border-border">
              <span className="text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground block">
                Status
              </span>
              <span className="text-sm font-extrabold text-emerald-500 uppercase mt-0.5 block">
                {business.status || "Active"}
              </span>
            </div>
          </div>

          {/* Description */}
          {ext.description && (
            <div className="p-4 rounded-2xl bg-muted/20 border border-border">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Description
              </span>
              <p className="text-xs text-foreground leading-relaxed">{ext.description}</p>
            </div>
          )}

          {/* Location & Contact Information */}
          <div className="p-4 rounded-2xl bg-muted/20 border border-border space-y-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Contact &amp; Location
            </span>

            <div className="space-y-2 text-muted-foreground">
              <div className="flex items-center gap-2.5">
                <MapPin className="w-4 h-4 text-sky-500 shrink-0" />
                <span className="text-foreground">
                  {business.business_address || "No address assigned"}
                </span>
              </div>

              {ext.phone && (
                <div className="flex items-center gap-2.5">
                  <Phone className="w-4 h-4 text-sky-500 shrink-0" />
                  <span className="text-foreground">{ext.phone}</span>
                </div>
              )}

              {ext.email && (
                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-sky-500 shrink-0" />
                  <span className="text-foreground">{ext.email}</span>
                </div>
              )}

              {ext.website && (
                <div className="flex items-center gap-2.5">
                  <Globe className="w-4 h-4 text-sky-500 shrink-0" />
                  <a
                    href={ext.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-500 hover:underline flex items-center gap-1"
                  >
                    {ext.website} <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Configuration & Modules */}
          <div className="p-4 rounded-2xl bg-muted/20 border border-border space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              System Configuration
            </span>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
              <div>
                Timezone: <strong className="text-foreground">{ext.timezone || "UTC"}</strong>
              </div>
              <div>
                Low Stock Alert Limit:{" "}
                <strong className="text-foreground">{business.stock_alert_limit ?? 10} units</strong>
              </div>
              <div>
                Created:{" "}
                <strong className="text-foreground">
                  {new Date(business.created_at).toLocaleDateString()}
                </strong>
              </div>
              <div>
                POS Terminal: <strong className="text-foreground">Enabled</strong>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                onOpenEdit(business);
              }}
              className="rounded-xl text-xs h-10 px-4 font-bold"
            >
              Edit Configuration
            </Button>
            <Button
              onClick={() => {
                onOpenChange(false);
                onEnterWorkspace(business);
              }}
              className="rounded-xl text-xs h-10 px-5 font-bold bg-sky-500 hover:bg-sky-600 text-white shadow-xs"
            >
              Enter Workspace
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
