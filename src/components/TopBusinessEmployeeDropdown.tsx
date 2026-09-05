import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useActiveBusiness } from "@/hooks/useActiveBusiness";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Building2,
  Briefcase,
  Store,
  UserCheck,
  ChevronsUpDown,
  Check,
  Plus,
  Search,
  Users,
  ShieldAlert,
  Loader2,
} from "lucide-react";

interface Props {
  variant?: "header" | "sidebar";
  collapsed?: boolean;
}

export const TopBusinessEmployeeDropdown: React.FC<Props> = ({
  variant = "header",
  collapsed = false,
}) => {
  const navigate = useNavigate();
  const {
    ownedBusinesses,
    staffBusinesses,
    workspaceMode,
    setWorkspaceMode,
    activeBusiness,
    activeId,
    setActive,
    loading,
    hasLoaded,
  } = useActiveBusiness();

  const [search, setSearch] = useState("");

  const isOwnerMode = workspaceMode === "business";
  const currentList = isOwnerMode ? ownedBusinesses : staffBusinesses;

  const filteredList = useMemo(() => {
    if (!search.trim()) return currentList;
    const s = search.toLowerCase();
    return currentList.filter(
      (b) =>
        (b.business_name || "").toLowerCase().includes(s) ||
        (b.business_address || "").toLowerCase().includes(s)
    );
  }, [currentList, search]);

  const activeName =
    activeBusiness?.business_name ||
    (isOwnerMode
      ? ownedBusinesses.length > 0
        ? "Select Store"
        : "No Stores Registered"
      : staffBusinesses.length > 0
      ? "Select Assigned Store"
      : "No Staff Stores");

  const roleLabel = isOwnerMode
    ? "Store Owner"
    : activeBusiness?.staff_role
    ? activeBusiness.staff_role.toUpperCase()
    : "Staff";

  // Collapsed icon variant for mini sidebar
  if (variant === "sidebar" && collapsed) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title={`${activeName} (${roleLabel})`}
            className="w-10 h-10 mx-auto rounded-xl flex items-center justify-center border border-border/80 bg-card hover:bg-muted/80 transition-all shadow-xs cursor-pointer group"
          >
            {isOwnerMode ? (
              <Store className="w-4 h-4 text-sky-500 group-hover:scale-110 transition-transform" />
            ) : (
              <Briefcase className="w-4 h-4 text-violet-500 group-hover:scale-110 transition-transform" />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="right" className="w-72 p-2 shadow-xl border border-border/80">
          <div className="p-1 bg-muted/60 rounded-xl flex gap-1 mb-2">
            <button
              type="button"
              onClick={() => setWorkspaceMode("business")}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                isOwnerMode
                  ? "bg-background text-foreground shadow-xs font-bold border border-border/50"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Store className="w-3.5 h-3.5 text-sky-500" />
              Owner ({ownedBusinesses.length})
            </button>
            <button
              type="button"
              onClick={() => setWorkspaceMode("employee")}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                !isOwnerMode
                  ? "bg-background text-foreground shadow-xs font-bold border border-border/50"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Briefcase className="w-3.5 h-3.5 text-violet-500" />
              Staff ({staffBusinesses.length})
            </button>
          </div>
          <div className="max-h-56 overflow-y-auto space-y-1">
            {filteredList.map((biz) => (
              <button
                key={biz.id}
                type="button"
                onClick={() => setActive(biz.id)}
                className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                  biz.id === activeId ? "bg-sky-500/15 text-sky-700 dark:text-sky-300 font-bold" : "hover:bg-muted text-foreground"
                }`}
              >
                <span className="truncate">{biz.business_name}</span>
                {biz.id === activeId && <Check className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />}
              </button>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          id="top-business-employee-dropdown"
          className={`flex items-center justify-between gap-2.5 rounded-xl border border-border/80 transition-all shadow-xs select-none cursor-pointer group ${
            variant === "header"
              ? "h-10 px-3 bg-muted/30 hover:bg-muted/60 max-w-[280px] sm:max-w-[340px]"
              : "w-full p-2.5 bg-card hover:bg-muted/70"
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 font-extrabold text-xs transition-colors ${
                isOwnerMode
                  ? "bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/20"
                  : "bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/20"
              }`}
            >
              {isOwnerMode ? (
                <Building2 className="w-3.5 h-3.5 text-sky-500" />
              ) : (
                <UserCheck className="w-3.5 h-3.5 text-violet-500" />
              )}
            </div>
            <div className="min-w-0 text-left">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-bold truncate text-foreground leading-tight">
                  {activeName}
                </p>
                <span
                  className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-md uppercase tracking-wider shrink-0 ${
                    isOwnerMode
                      ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20"
                      : "bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20"
                  }`}
                >
                  {roleLabel}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">
                {isOwnerMode
                  ? `${ownedBusinesses.length} Store${ownedBusinesses.length === 1 ? "" : "s"} · Full Access`
                  : activeBusiness
                  ? `${activeBusiness.business_name} · Staff`
                  : "No Staff Stores"}
              </p>
            </div>
          </div>
          <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground shrink-0 opacity-70 group-hover:opacity-100 transition-opacity" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={variant === "header" ? "start" : "start"}
        className="w-80 p-3 space-y-2.5 shadow-xl border border-border/80 rounded-2xl bg-popover"
      >
        {/* Workspace Mode Switcher (Business vs Employee) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
              Workspace Mode
            </span>
            <span className="text-[10px] text-muted-foreground font-medium">
              {isOwnerMode ? "Owner Dashboard" : "Staff Dashboard"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1 p-1 bg-muted/60 rounded-xl border border-border/60">
            <button
              type="button"
              id="dropdown-mode-business"
              onClick={() => setWorkspaceMode("business")}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs transition-all cursor-pointer ${
                isOwnerMode
                  ? "bg-background text-foreground shadow-xs border border-border/80 font-bold"
                  : "text-muted-foreground hover:text-foreground font-medium"
              }`}
            >
              <Store className={`w-3.5 h-3.5 ${isOwnerMode ? "text-sky-500" : "text-muted-foreground"}`} />
              <span>Owner</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-400 font-bold">
                {ownedBusinesses.length}
              </span>
            </button>

            <button
              type="button"
              id="dropdown-mode-employee"
              onClick={() => setWorkspaceMode("employee")}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs transition-all cursor-pointer ${
                !isOwnerMode
                  ? "bg-background text-foreground shadow-xs border border-border/80 font-bold"
                  : "text-muted-foreground hover:text-foreground font-medium"
              }`}
            >
              <Briefcase className={`w-3.5 h-3.5 ${!isOwnerMode ? "text-violet-500" : "text-muted-foreground"}`} />
              <span>Employee</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-400 font-bold">
                {staffBusinesses.length}
              </span>
            </button>
          </div>
        </div>

        <DropdownMenuSeparator />

        {/* Store Search if > 3 items */}
        {currentList.length > 3 && (
          <div className="relative px-1">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={`Search ${isOwnerMode ? "stores" : "assigned stores"}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs bg-muted/50 border border-border/60 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>
        )}

        {/* Store List */}
        <div className="space-y-1">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground px-1 py-0.5">
            {isOwnerMode ? "Your Stores" : "Assigned Employer Stores"}
          </p>
          <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
            {filteredList.map((biz) => {
              const isSelected = biz.id === activeId;
              return (
                <button
                  key={biz.id}
                  type="button"
                  onClick={() => setActive(biz.id)}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition-all cursor-pointer ${
                    isSelected
                      ? isOwnerMode
                        ? "bg-sky-500/15 text-sky-700 dark:text-sky-300 font-bold border border-sky-500/30"
                        : "bg-violet-500/15 text-violet-700 dark:text-violet-300 font-bold border border-violet-500/30"
                      : "hover:bg-muted/70 text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <div
                      className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-[10px] font-bold ${
                        isSelected
                          ? isOwnerMode
                            ? "bg-sky-500 text-white"
                            : "bg-violet-500 text-white"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {(biz.business_name || "S").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-xs leading-tight">
                        {biz.business_name}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">
                        {isOwnerMode
                          ? `Currency: ${biz.currency || "USD"}`
                          : `Role: ${biz.staff_role ? biz.staff_role.toUpperCase() : "STAFF"}`}
                      </p>
                    </div>
                  </div>
                  {isSelected && (
                    <Check
                      className={`w-4 h-4 shrink-0 ${
                        isOwnerMode ? "text-sky-600 dark:text-sky-400" : "text-violet-600 dark:text-violet-400"
                      }`}
                    />
                  )}
                </button>
              );
            })}

            {filteredList.length === 0 && (
              <div className="p-4 text-center text-xs text-muted-foreground space-y-1.5">
                <ShieldAlert className="w-5 h-5 mx-auto text-muted-foreground/60" />
                <p className="font-medium">
                  {isOwnerMode
                    ? "No businesses registered under this account."
                    : "You are not assigned as staff to any store."}
                </p>
                {!isOwnerMode && (
                  <p className="text-[10px] text-muted-foreground/80">
                    When a store owner invites your email to their team hub, their store will automatically appear here.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Quick Footer Action */}
        {isOwnerMode && (
          <>
            <DropdownMenuSeparator />
            <button
              type="button"
              onClick={() => navigate("/dashboard/businesses")}
              className="w-full flex items-center gap-2 p-2 rounded-xl text-xs font-bold text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Register New Store
            </button>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
