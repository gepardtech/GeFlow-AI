import { TrendingUp, Package, DollarSign, AlertTriangle } from "lucide-react";

const DashboardPreview = () => (
  <div className="bg-card rounded-2xl shadow-xl border border-border/50 p-6 w-full max-w-lg">
    <div className="flex items-center justify-between mb-6">
      <h3 className="font-semibold text-foreground text-sm">Dashboard Overview</h3>
      <span className="text-xs text-muted-foreground">Today</span>
    </div>
    <div className="grid grid-cols-2 gap-3 mb-4">
      {[
        { icon: DollarSign, label: "Sales Today", value: "$2,847", color: "text-accent" },
        { icon: Package, label: "Items in Stock", value: "1,234", color: "text-primary" },
        { icon: TrendingUp, label: "Profit", value: "+18.2%", color: "text-accent" },
        { icon: AlertTriangle, label: "Low Stock", value: "7 items", color: "text-destructive" },
      ].map((item) => (
        <div key={item.label} className="bg-muted/50 rounded-xl p-3">
          <item.icon className={`h-4 w-4 ${item.color} mb-1`} />
          <p className="text-xs text-muted-foreground">{item.label}</p>
          <p className="text-lg font-bold text-foreground">{item.value}</p>
        </div>
      ))}
    </div>
    <div className="space-y-2">
      {["Paracetamol 500mg — 12 sold", "Vitamin C — 8 sold", "Bandage Pack — 5 sold"].map((item) => (
        <div key={item} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2 text-xs">
          <span className="text-foreground">{item}</span>
          <span className="text-accent font-medium">✓</span>
        </div>
      ))}
    </div>
  </div>
);

export default DashboardPreview;
