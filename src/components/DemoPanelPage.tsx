import { ReactNode } from "react";
import {
  LucideIcon,
  Sparkles,
  TrendingUp,
  Activity,
  ArrowUpRight,
  Plus,
  Search,
  Filter,
} from "lucide-react";
import PanelLayout, { NavItem } from "@/components/PanelLayout";

interface Props {
  title: string;
  description: string;
  icon: LucideIcon;
  sidebarLabel?: string;
  navItems?: NavItem[];
  identityName?: string;
  identityRole?: string;
  identityBadgeClass?: string;
  initial?: string;
  children?: ReactNode;
  /** When true, render only the page content (no PanelLayout wrapper).
   *  Used when the page is already inside a gate that provides the layout. */
  bare?: boolean;
}

const DemoPanelPage = ({
  title,
  description,
  icon: Icon,
  sidebarLabel,
  navItems,
  identityName,
  identityRole,
  identityBadgeClass,
  initial,
  children,
  bare,
}: Props) => {
  const isAdmin = (navItems ?? []).some((n) => n.to.startsWith("/admin"));

  const stats = [
    {
      label: "TOTAL",
      value: "—",
      change: "+0%",
      icon: Sparkles,
      accent: "hover:shadow-sky-500/15",
      iconBg: "bg-sky-400/15 text-sky-500",
    },
    {
      label: "ACTIVE",
      value: "—",
      change: "+0%",
      icon: Activity,
      accent: "hover:shadow-emerald-500/15",
      iconBg: "bg-emerald-400/15 text-emerald-500",
    },
    {
      label: "GROWTH",
      value: "—",
      change: "+0%",
      icon: TrendingUp,
      accent: "hover:shadow-violet-500/15",
      iconBg: "bg-violet-400/15 text-violet-500",
    },
    {
      label: "PENDING",
      value: "—",
      change: "0",
      icon: ArrowUpRight,
      accent: "hover:shadow-amber-500/15",
      iconBg: "bg-amber-400/15 text-amber-500",
    },
  ];

  const body = (
    <div className="w-full space-y-6 min-w-0 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-1 truncate text-foreground">
            {title}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground truncate">
            {description}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <div className="relative min-w-0 flex-1 sm:flex-initial">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Search..."
              className="h-9 sm:h-10 w-full sm:w-52 md:w-60 pl-9 pr-3 bg-card border border-border/80 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <button className="h-9 sm:h-10 px-3.5 sm:px-4 rounded-xl bg-card border border-border/80 text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 hover:bg-muted transition shrink-0">
            <Filter className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Filter
          </button>
          <button className="h-9 sm:h-10 px-3.5 sm:px-4 rounded-xl bg-gradient-to-r from-sky-500 to-blue-500 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 hover:shadow-lg hover:shadow-sky-500/30 hover:-translate-y-0.5 transition-all shrink-0">
            <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> New
          </button>
        </div>
      </div>

      {children ?? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 min-w-0">
            {stats.map((s) => (
              <div
                key={s.label}
                className={`bg-card border border-border/80 rounded-2xl p-4 sm:p-5 transition-all hover:-translate-y-0.5 hover:shadow-xl min-w-0 overflow-hidden ${s.accent}`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div
                    className={`h-8 w-8 sm:h-9 sm:w-9 rounded-lg flex items-center justify-center shrink-0 ${s.iconBg}`}
                  >
                    <s.icon className="h-4 w-4" />
                  </div>
                  <span className="text-[10px] font-bold tracking-widest text-emerald-500 px-2 py-0.5 bg-emerald-500/10 rounded-full shrink-0">
                    {s.change}
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] font-bold tracking-wider text-muted-foreground mb-1 truncate uppercase">
                  {s.label}
                </p>
                <p className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
                  {s.value}
                </p>
              </div>
            ))}
          </div>

          <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-6 min-w-0 overflow-hidden shadow-xs">
            <div className="flex items-center justify-between gap-3 mb-4 min-w-0">
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-base sm:text-lg truncate text-foreground">
                  {title} Records
                </h3>
                <p className="text-xs text-muted-foreground truncate">
                  Live view — connect this module to populate real data.
                </p>
              </div>
              <span className="text-[10px] font-bold tracking-widest text-sky-500 bg-sky-400/10 px-2.5 py-1 rounded-full shrink-0">
                REAL-TIME
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm min-w-[500px]">
                <thead>
                  <tr className="text-[10px] font-bold tracking-widest text-muted-foreground border-b border-border/60">
                    <th className="text-left px-3 sm:px-4 py-3">NAME</th>
                    <th className="text-left px-3 sm:px-4 py-3">CATEGORY</th>
                    <th className="text-left px-3 sm:px-4 py-3">STATUS</th>
                    <th className="text-right px-3 sm:px-4 py-3">UPDATED</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <tr
                      key={i}
                      className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-3 sm:px-4 py-3 sm:py-4">
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                          <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-gradient-to-br from-sky-400/20 to-violet-400/20 flex items-center justify-center shrink-0">
                            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-sky-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-xs sm:text-sm truncate text-foreground">
                              Record #{i + 1001}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              Auto-generated placeholder
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 py-3 sm:py-4 text-muted-foreground truncate text-xs">
                        {
                          [
                            "Operations",
                            "Catalog",
                            "Customer",
                            "Vendor",
                            "Inventory",
                            "Finance",
                          ][i % 6]
                        }
                      </td>
                      <td className="px-3 sm:px-4 py-3 sm:py-4">
                        <span className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold whitespace-nowrap">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />{" "}
                          Active
                        </span>
                      </td>
                      <td className="px-3 sm:px-4 py-3 sm:py-4 text-right text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
                        {i + 1}h ago
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-gradient-to-br from-sky-500/10 to-violet-500/10 border border-border/80 rounded-2xl p-4 sm:p-6 min-w-0 overflow-hidden">
            <div className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest bg-sky-500/15 text-sky-600 dark:text-sky-300 px-2.5 py-1 rounded-full mb-3 whitespace-nowrap">
              <Sparkles className="h-3 w-3 shrink-0" /> GEFLOW INTELLIGENCE
            </div>
            <h3 className="font-bold text-base sm:text-lg text-foreground">
              Module ready to be activated
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
              This {title.toLowerCase()} workspace is set up with realtime hooks.
              We'll wire it to real records next.
            </p>
          </div>
        </>
      )}
    </div>
  );

  if (bare) return body;

  return (
    <PanelLayout
      sidebarLabel={sidebarLabel!}
      navItems={navItems ?? []}
      identityName={identityName!}
      identityRole={identityRole!}
      identityBadgeClass={identityBadgeClass}
      initial={initial!}
      isAdmin={isAdmin}
    >
      {body}
    </PanelLayout>
  );
};

export default DemoPanelPage;
