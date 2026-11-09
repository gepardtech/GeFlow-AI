import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function TableRowSkeletons({ rows = 5, columns = 6 }: { rows?: number; columns?: number }) {
  const widths = ["w-32", "w-44", "w-24", "w-28", "w-16", "w-20", "w-36"];
  return (
    <>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <tr key={rIdx} className="border-b border-border/60 hover:bg-muted/10">
          {Array.from({ length: columns }).map((_, cIdx) => (
            <td key={cIdx} className="px-4 py-3.5">
              <Skeleton
                className={`h-4 ${widths[(rIdx + cIdx) % widths.length]} ${
                  cIdx === 0 ? "rounded-md" : ""
                }`}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function TablePageSkeleton({
  title = true,
  filterBar = true,
  rows = 6,
  columns = 6,
}: {
  title?: boolean;
  filterBar?: boolean;
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="space-y-6 w-full animate-in fade-in-50 duration-300">
      {title && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-24 rounded-lg" />
            <Skeleton className="h-9 w-32 rounded-lg" />
          </div>
        </div>
      )}

      {filterBar && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-4 rounded-xl bg-card border border-border/70">
          <Skeleton className="h-10 flex-1 rounded-lg" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-32 rounded-lg" />
            <Skeleton className="h-10 w-28 rounded-lg" />
            <Skeleton className="h-10 w-10 rounded-lg" />
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
        <div className="p-4 border-b border-border/70 bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/70 bg-muted/10">
                {Array.from({ length: columns }).map((_, i) => (
                  <th key={i} className="px-4 py-3 text-left">
                    <Skeleton className="h-3 w-20" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <TableRowSkeletons rows={rows} columns={columns} />
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-border/70 flex items-center justify-between">
          <Skeleton className="h-4 w-36" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardPageSkeleton() {
  return (
    <div className="space-y-6 w-full animate-in fade-in-50 duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-60" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-32 rounded-lg" />
          <Skeleton className="h-9 w-36 rounded-lg" />
        </div>
      </div>

      {/* KPI 4-Card Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-5 rounded-2xl bg-card border border-border/80 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-8 rounded-xl" />
            </div>
            <Skeleton className="h-8 w-36" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-12 rounded-full" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
        ))}
      </div>

      {/* Charts / Middle Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 rounded-2xl bg-card border border-border/80 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3.5 w-60" />
            </div>
            <Skeleton className="h-8 w-28 rounded-lg" />
          </div>
          <div className="h-64 rounded-xl bg-muted/30 p-4 flex items-end gap-3 justify-between">
            {Array.from({ length: 12 }).map((_, i) => {
              const hPct = [40, 65, 30, 80, 55, 90, 45, 70, 85, 60, 75, 95][i % 12];
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <Skeleton className="w-full rounded-t-md" style={{ height: `${hPct}%` }} />
                  <Skeleton className="h-2.5 w-6" />
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-card border border-border/80 space-y-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3.5 w-48" />
          <div className="h-48 rounded-full border-8 border-muted/40 mx-auto w-48 flex items-center justify-center">
            <Skeleton className="h-12 w-20" />
          </div>
          <div className="space-y-2 pt-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-3 rounded-full" />
                  <Skeleton className="h-3.5 w-24" />
                </div>
                <Skeleton className="h-3.5 w-12" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity Table Skeleton */}
      <div className="p-6 rounded-2xl bg-card border border-border/80 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/20">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <div className="text-right space-y-1.5">
                <Skeleton className="h-4 w-20 ml-auto" />
                <Skeleton className="h-3 w-14 ml-auto" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function POSPageSkeleton() {
  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col lg:flex-row gap-4 p-4 animate-in fade-in-50 duration-300">
      {/* Product Catalog Side */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {/* Search & Categories */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Skeleton className="h-11 flex-1 rounded-xl" />
          <Skeleton className="h-11 w-44 rounded-xl" />
        </div>

        {/* Category Filter Pills */}
        <div className="flex gap-2 overflow-x-hidden pb-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-full shrink-0" />
          ))}
        </div>

        {/* Product Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 flex-1 overflow-y-auto">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="p-3.5 rounded-2xl bg-card border border-border/80 space-y-3">
              <Skeleton className="h-28 w-full rounded-xl" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <div className="flex items-center justify-between pt-1">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-7 w-14 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cart / Checkout Side */}
      <div className="w-full lg:w-96 rounded-2xl bg-card border border-border/80 p-5 flex flex-col gap-4 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-border/70">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>

        <Skeleton className="h-10 w-full rounded-xl" />

        {/* Cart Item Placeholders */}
        <div className="flex-1 space-y-3 overflow-y-auto py-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-3 rounded-xl bg-muted/25 flex items-center justify-between">
              <div className="space-y-1.5 flex-1 pr-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-16" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-7 w-20 rounded-lg" />
                <Skeleton className="h-4 w-12" />
              </div>
            </div>
          ))}
        </div>

        {/* Cart Totals & Button */}
        <div className="space-y-3 pt-3 border-t border-border/70">
          <div className="flex justify-between">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-3.5 w-14" />
          </div>
          <div className="flex justify-between">
            <Skeleton className="h-3.5 w-12" />
            <Skeleton className="h-3.5 w-14" />
          </div>
          <div className="flex justify-between pt-1">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-6 w-24" />
          </div>
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function ReportsPageSkeleton() {
  return (
    <div className="space-y-6 w-full animate-in fade-in-50 duration-300">
      {/* Top Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-48 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-36 rounded-xl" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-28 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-5 rounded-2xl bg-card border border-border/80 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-8 w-8 rounded-xl" />
            </div>
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>

      {/* Big Chart Skeleton */}
      <div className="p-6 rounded-2xl bg-card border border-border/80 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3.5 w-72" />
          </div>
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
        <div className="h-72 rounded-xl bg-muted/20 flex items-end gap-3 p-6">
          {Array.from({ length: 14 }).map((_, i) => {
            const h = [30, 45, 60, 50, 75, 40, 85, 90, 65, 70, 80, 55, 95, 60][i % 14];
            return <Skeleton key={i} className="flex-1 rounded-t-md" style={{ height: `${h}%` }} />;
          })}
        </div>
      </div>

      {/* Ledger Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border/70 flex items-center justify-between">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-8 w-28 rounded-lg" />
        </div>
        <div className="p-4 space-y-3">
          <TableRowSkeletons rows={5} columns={6} />
        </div>
      </div>
    </div>
  );
}

export function CardGridPageSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="space-y-6 w-full animate-in fade-in-50 duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-36 rounded-xl" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="p-5 rounded-2xl bg-card border border-border/80 space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-2/3" />
            </div>
            <div className="pt-2 border-t border-border/60 flex items-center justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-20 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FullWorkspaceSkeleton({ title = "Loading Workspace..." }: { title?: string }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col animate-in fade-in-50 duration-300">
      {/* Top Navbar Skeleton */}
      <header className="h-16 border-b border-border/80 px-4 sm:px-6 flex items-center justify-between bg-card/60 backdrop-blur-xs sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        </div>
        <div className="hidden md:flex items-center gap-3 flex-1 max-w-md mx-8">
          <Skeleton className="h-9 w-full rounded-xl" />
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-8 w-28 rounded-lg hidden sm:block" />
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>
      </header>

      {/* Main Workspace Body: Sidebar + Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar Skeleton (hidden on small mobile) */}
        <aside className="w-64 border-r border-border/80 bg-card/40 p-4 hidden md:flex flex-col gap-2 shrink-0">
          <div className="px-2 py-1 mb-2">
            <Skeleton className="h-3 w-20" />
          </div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-muted/20">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-3.5 flex-1 rounded" />
            </div>
          ))}
          <div className="mt-auto pt-4 border-t border-border/70 space-y-2">
            <Skeleton className="h-8 w-full rounded-xl" />
            <Skeleton className="h-8 w-full rounded-xl" />
          </div>
        </aside>

        {/* Workspace Content Skeleton */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto space-y-6">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-48 sm:w-64" />
                <span className="sr-only">{title}</span>
              </div>
              <Skeleton className="h-4 w-72 sm:w-96" />
            </div>
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-9 w-24 rounded-xl" />
              <Skeleton className="h-9 w-32 rounded-xl" />
            </div>
          </div>

          {/* 4 Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-5 rounded-2xl bg-card border border-border/80 space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-8 w-8 rounded-xl" />
                </div>
                <Skeleton className="h-7 w-32" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3.5 w-12 rounded-full" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>

          {/* Middle Chart + Summary Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 p-6 rounded-2xl bg-card border border-border/80 space-y-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-8 w-24 rounded-lg" />
              </div>
              <div className="h-64 rounded-xl bg-muted/20 p-4 flex items-end gap-3 justify-between">
                {Array.from({ length: 12 }).map((_, i) => {
                  const hPct = [40, 70, 35, 85, 60, 95, 50, 75, 90, 65, 80, 100][i % 12];
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2">
                      <Skeleton className="w-full rounded-t-md" style={{ height: `${hPct}%` }} />
                      <Skeleton className="h-2 w-5" />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-card border border-border/80 space-y-4">
              <Skeleton className="h-5 w-32" />
              <div className="h-44 rounded-full border-8 border-muted/40 mx-auto w-44 flex items-center justify-center">
                <Skeleton className="h-10 w-16" />
              </div>
              <div className="space-y-2 pt-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3.5 w-14" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Table Skeleton */}
          <div className="rounded-2xl border border-border/80 bg-card overflow-hidden">
            <div className="p-4 border-b border-border/70 flex items-center justify-between">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
            <div className="p-4 space-y-3">
              <TableRowSkeletons rows={5} columns={6} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
