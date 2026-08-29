import React from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, ShoppingCart, Package, LayoutDashboard, ArrowRight, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StaffRole } from "@/hooks/useStaffRole";

interface Props {
  role: StaffRole;
  pageTitle?: string;
  path?: string;
}

export const RoleRestrictedScreen: React.FC<Props> = ({ role, pageTitle, path }) => {
  const navigate = useNavigate();

  const isInventory = role === "inventory";
  const isCashier = role === "cashier";

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-lg w-full p-8 rounded-3xl bg-card border border-border/80 shadow-2xl text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto shadow-inner">
          <ShieldAlert className="w-8 h-8 stroke-[2.2]" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20">
            {role === "inventory" ? "📦 INVENTORY CLERK ACCESS" : role === "cashier" ? "👦 CASHIER ACCESS" : "RESTRICTED ACCESS"}
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Access Restricted to {pageTitle || "This Page"}
          </h2>

          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Your active staff role (<span className="font-bold text-foreground capitalize">{role}</span>) does not have permission to view or manage <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">{path || "this module"}</code>.
          </p>
        </div>

        {/* Role Permissions Summary Box */}
        <div className="p-4 rounded-2xl bg-muted/40 border border-border text-left text-xs space-y-2">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
            YOUR ASSIGNED OPERATIONAL WORKSPACE:
          </p>
          {isInventory ? (
            <ul className="space-y-1 text-muted-foreground list-disc list-inside">
              <li><strong className="text-foreground">Inventory Catalog</strong> &bull; Manage products, variants &amp; prices</li>
              <li><strong className="text-foreground">Low Stock Alerts</strong> &bull; Monitor threshold replenishments</li>
              <li><strong className="text-foreground">Out of Stock Tracker</strong> &bull; Track stockouts</li>
            </ul>
          ) : isCashier ? (
            <ul className="space-y-1 text-muted-foreground list-disc list-inside">
              <li><strong className="text-foreground">POS Terminal</strong> &bull; Point-of-Sale billing, dose calculations &amp; receipts</li>
              <li><strong className="text-foreground">Dashboard Overview</strong> &bull; View daily sales &amp; performance metrics</li>
              <li><strong className="text-foreground">Analytics &amp; Reports</strong> &bull; Read-only overview</li>
            </ul>
          ) : (
            <p className="text-muted-foreground">Please contact your business manager for elevated role permissions.</p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          {isInventory ? (
            <Button
              onClick={() => navigate("/dashboard/inventory")}
              className="w-full sm:w-auto flex-1 h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md border-0"
            >
              <Package className="w-4 h-4" /> Go to Inventory <ArrowRight className="w-4 h-4" />
            </Button>
          ) : isCashier ? (
            <Button
              onClick={() => navigate("/dashboard/pos")}
              className="w-full sm:w-auto flex-1 h-12 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md border-0"
            >
              <ShoppingCart className="w-4 h-4" /> Open POS Terminal <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={() => navigate("/dashboard")}
              className="w-full sm:w-auto flex-1 h-12 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md border-0"
            >
              <LayoutDashboard className="w-4 h-4" /> Go to Dashboard
            </Button>
          )}

          <Button
            variant="outline"
            onClick={() => navigate("/dashboard/support")}
            className="w-full sm:w-auto h-12 px-5 rounded-2xl text-xs font-bold gap-2"
          >
            <LifeBuoy className="w-4 h-4" /> Support
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RoleRestrictedScreen;
