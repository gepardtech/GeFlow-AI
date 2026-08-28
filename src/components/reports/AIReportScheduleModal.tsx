import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
  Sparkles,
  Clock,
  Calendar,
  DollarSign,
  Boxes,
  PackageX,
  AlertTriangle,
  Flame,
  ShieldAlert,
  Crown,
  Lock,
  CheckCircle2,
  BellRing,
  Send,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { usePlan } from "@/hooks/usePlan";
import {
  AIReportScheduleConfig,
  ReportFrequency,
  getScheduleConfig,
  saveScheduleConfig,
  generateScheduledAIReport,
} from "@/lib/aiReportSchedulerService";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId?: string;
  businessName?: string;
  onReportGenerated?: () => void;
}

export const AIReportScheduleModal: React.FC<Props> = ({
  open,
  onOpenChange,
  businessId,
  businessName = "Business",
  onReportGenerated,
}) => {
  const { planId, isPremiumOrLifetime } = usePlan();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [config, setConfig] = useState<AIReportScheduleConfig>(() =>
    businessId ? getScheduleConfig(businessId) : ({} as any)
  );
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (businessId && open) {
      setConfig(getScheduleConfig(businessId));
    }
  }, [businessId, open]);

  const handleSave = () => {
    if (!businessId) return;
    setSaving(true);
    saveScheduleConfig(businessId, config);
    setTimeout(() => {
      setSaving(false);
      toast({
        title: "AI Report Schedule Saved",
        description: `Automated ${config.frequency.toUpperCase()} reports will be compiled at ${config.timeOfDay} and delivered to notifications.`,
      });
      onOpenChange(false);
    }, 300);
  };

  const handleTriggerNow = async () => {
    if (!businessId) return;
    setGenerating(true);
    try {
      const rep = await generateScheduledAIReport(businessId, businessName, config.frequency);
      toast({
        title: "AI Report Generated Instantly",
        description: `New ${config.frequency} report added to your Audit Ledger with real-time profit, stock, and supplier insights.`,
      });
      onReportGenerated?.();
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to generate report", err);
      toast({
        title: "Generation Issue",
        description: "Could not compile automated report at this moment.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  // If user is on Free or Standard tier, render the premium upgrade dialog
  if (!isPremiumOrLifetime) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-md p-6 bg-card border-border shadow-2xl rounded-2xl"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="text-center space-y-3">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
              <Crown className="w-7 h-7" />
            </div>
            <DialogTitle className="text-xl font-bold text-foreground">
              Scheduled AI Reports is Premium
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
              Automated daily, weekly, and monthly AI performance audits with in-app notifications and supplier procurement research are available exclusively on <span className="font-bold text-foreground">Premium & Lifetime plans</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 p-4 rounded-xl bg-muted/40 border border-border space-y-2 text-xs">
            <p className="font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-500" />
              What you unlock with Premium:
            </p>
            <ul className="space-y-1.5 text-muted-foreground pl-6 list-disc">
              <li>Automatic Daily, Weekly, or Monthly Profit & Stock Reports</li>
              <li>Instant in-app alerts on new report generation</li>
              <li>Autonomous low & out-of-stock supplier contact sheets</li>
              <li>One-click export to PDF & CSV in the Audit Ledger</li>
            </ul>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-1/2 rounded-xl text-xs font-semibold"
            >
              Maybe Later
            </Button>
            <Button
              onClick={() => {
                onOpenChange(false);
                navigate("/dashboard/subscription");
              }}
              className="w-full sm:w-1/2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:opacity-90 shadow-md"
            >
              <Crown className="w-3.5 h-3.5 mr-1.5" />
              Upgrade Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-xl p-0 overflow-hidden bg-card border-border shadow-2xl rounded-2xl flex flex-col max-h-[90vh]"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="p-5 border-b border-border bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-sky-500 text-white flex items-center justify-center shadow-sm shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base font-bold text-foreground">
                  AI Report Schedule Settings
                </DialogTitle>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-1">
                  <Crown className="w-3 h-3" />
                  Premium Active
                </span>
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Set automated timeline frequency for AI audit reports and instant in-app alerts.
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Master Enable Switch */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/20">
            <div className="space-y-0.5">
              <Label className="text-sm font-bold text-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-500" />
                Enable Automated AI Intelligence Reports
              </Label>
              <p className="text-xs text-muted-foreground">
                AI will continuously compute business analytics and deliver scheduled audit reports.
              </p>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={(val) => setConfig({ ...config, enabled: val })}
            />
          </div>

          {/* Timeline & Frequency Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-bold text-foreground block mb-1.5">
                Report Timeline Frequency
              </Label>
              <Select
                value={config.frequency}
                onValueChange={(val: ReportFrequency) => setConfig({ ...config, frequency: val })}
              >
                <SelectTrigger className="h-10 rounded-xl bg-background border-border text-xs font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  <SelectItem value="daily">Daily Report (24-Hour Cycle)</SelectItem>
                  <SelectItem value="weekly">Weekly Report (7-Day Cycle)</SelectItem>
                  <SelectItem value="monthly">Monthly Report (30-Day Cycle)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-bold text-foreground block mb-1.5">
                Delivery Time (Local Time)
              </Label>
              <Select
                value={config.timeOfDay}
                onValueChange={(val) => setConfig({ ...config, timeOfDay: val })}
              >
                <SelectTrigger className="h-10 rounded-xl bg-background border-border text-xs font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  <SelectItem value="08:00">08:00 AM (Morning Kickoff)</SelectItem>
                  <SelectItem value="12:00">12:00 PM (Midday Review)</SelectItem>
                  <SelectItem value="18:00">06:00 PM (Evening Closing)</SelectItem>
                  <SelectItem value="21:00">09:00 PM (Night Audit)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Report Sections Customizer (The 6 Mandatory Pillars) */}
          <div className="space-y-3 pt-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
              Included In AI Report Package:
            </Label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* 1. Profit */}
              <div className="p-3 rounded-xl border border-border bg-card flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold text-xs">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">1. Profit & Margins</p>
                    <p className="text-[10px] text-muted-foreground">Net revenue & margin %</p>
                  </div>
                </div>
                <Switch
                  checked={config.includeProfit}
                  onCheckedChange={(v) => setConfig({ ...config, includeProfit: v })}
                />
              </div>

              {/* 2. Total Inventory */}
              <div className="p-3 rounded-xl border border-border bg-card flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-sky-500/10 text-sky-500 flex items-center justify-center font-bold text-xs">
                    <Boxes className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">2. Total Inventory</p>
                    <p className="text-[10px] text-muted-foreground">Valuation & total units</p>
                  </div>
                </div>
                <Switch
                  checked={config.includeTotalInventory}
                  onCheckedChange={(v) => setConfig({ ...config, includeTotalInventory: v })}
                />
              </div>

              {/* 3. Out of Stock */}
              <div className="p-3 rounded-xl border border-border bg-card flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center font-bold text-xs">
                    <PackageX className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">3. Out of Stock</p>
                    <p className="text-[10px] text-muted-foreground">Zero-stock SKU alert</p>
                  </div>
                </div>
                <Switch
                  checked={config.includeOutOfStock}
                  onCheckedChange={(v) => setConfig({ ...config, includeOutOfStock: v })}
                />
              </div>

              {/* 4. Low Stock */}
              <div className="p-3 rounded-xl border border-border bg-card flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold text-xs">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">4. Low Stock Warning</p>
                    <p className="text-[10px] text-muted-foreground">Depletion thresholds</p>
                  </div>
                </div>
                <Switch
                  checked={config.includeLowStock}
                  onCheckedChange={(v) => setConfig({ ...config, includeLowStock: v })}
                />
              </div>

              {/* 5. Highly Demanded */}
              <div className="p-3 rounded-xl border border-border bg-card flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold text-xs">
                    <Flame className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">5. Highly Demanded</p>
                    <p className="text-[10px] text-muted-foreground">Top sales velocity items</p>
                  </div>
                </div>
                <Switch
                  checked={config.includeHighlyDemanded}
                  onCheckedChange={(v) => setConfig({ ...config, includeHighlyDemanded: v })}
                />
              </div>

              {/* 6. Issue Products */}
              <div className="p-3 rounded-xl border border-border bg-card flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center font-bold text-xs">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">6. Issue Products</p>
                    <p className="text-[10px] text-muted-foreground">Expiring & negative margin</p>
                  </div>
                </div>
                <Switch
                  checked={config.includeIssueProducts}
                  onCheckedChange={(v) => setConfig({ ...config, includeIssueProducts: v })}
                />
              </div>
            </div>
          </div>

          {/* Notification Alert Preview */}
          <div className="p-3 rounded-xl bg-muted/40 border border-border text-xs flex items-center gap-2.5 text-muted-foreground">
            <BellRing className="w-4 h-4 text-sky-500 shrink-0" />
            <span>
              Every time a scheduled report is generated, a notification will be pushed to your in-app notification bell with a direct link to the Audit Ledger.
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={generating}
            onClick={handleTriggerNow}
            className="w-full sm:w-auto h-9 rounded-xl text-xs font-bold border-sky-500/30 text-sky-600 hover:bg-sky-500/10"
          >
            {generating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                Compiling Report…
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5 mr-2" />
                Generate Now & Send
              </>
            )}
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="h-9 px-4 rounded-xl text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="h-9 px-5 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 shadow-xs"
            >
              {saving ? "Saving…" : "Save Schedule"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
