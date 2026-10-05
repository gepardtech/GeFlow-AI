import React, { useState, useMemo, useRef, useEffect } from "react";
import { Check, ChevronsUpDown, Search, Package, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  UOMOption,
  getUOMsForBusiness,
  searchUOMs,
  ALL_STANDARD_UOMS,
} from "@/lib/uomRegistry";

interface DbCategoryUom {
  mappingId: string;
  uomId: string;
  name: string;
  symbol: string;
  type: string;
  baseUnit: string;
  subUnit: string;
  conversionFactor: number;
  conversionUnit: string;
  decimalAllowed: boolean;
  fractionAllowed: boolean;
  recommended: boolean;
  defaultUom: boolean;
  sortOrder: number;
}

interface UOMSelectProps {
  value: string;
  onChange: (value: string, uomMeta?: { unitsPerUom?: number; baseUnit?: string; decimalAllowed?: boolean }) => void;
  categoryId?: string | null;
  industryType?: string | null;
  categoryName?: string | null;
  hasError?: boolean;
  disabled?: boolean;
  id?: string;
}

export const UOMSelect: React.FC<UOMSelectProps> = ({
  value,
  onChange,
  categoryId,
  industryType,
  categoryName,
  hasError = false,
  disabled = false,
  id = "uom-select",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dbUoms, setDbUoms] = useState<DbCategoryUom[]>([]);
  const [loadingDb, setLoadingDb] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 1. Fetch category-appointed UoMs from database
  useEffect(() => {
    let active = true;
    if (!categoryId) {
      setDbUoms([]);
      return;
    }

    setLoadingDb(true);
    fetch(`/api/business-category-uoms/${encodeURIComponent(categoryId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        if (data?.success && Array.isArray(data?.uoms) && data.uoms.length > 0) {
          setDbUoms(data.uoms);

          // Smart default: If no value is currently set, or value is default "box" in non-pharmacy, pick category's default
          const defaultUnit = data.uoms.find((u: DbCategoryUom) => u.defaultUom);
          if (defaultUnit && (!value || value === "box")) {
            const unitName = defaultUnit.name.toLowerCase();
            onChange(unitName, {
              unitsPerUom: defaultUnit.conversionFactor || 1,
              baseUnit: defaultUnit.subUnit || defaultUnit.baseUnit,
              decimalAllowed: defaultUnit.decimalAllowed,
            });
          }
        } else {
          setDbUoms([]);
        }
      })
      .catch(() => {
        if (active) setDbUoms([]);
      })
      .finally(() => {
        if (active) setLoadingDb(false);
      });

    return () => {
      active = false;
    };
  }, [categoryId]);

  // 2. Compute available UOMs: Prefer database category mappings if present; else fallback to industry registry
  const availableUOMs: UOMOption[] = useMemo(() => {
    if (dbUoms.length > 0) {
      return dbUoms.map((d) => ({
        id: d.name.toLowerCase(),
        name: d.name,
        abbreviation: d.symbol,
        category: (d.type.toLowerCase().includes("weight")
          ? "weight"
          : d.type.toLowerCase().includes("volume")
          ? "volume"
          : d.type.toLowerCase().includes("pack")
          ? "packaging"
          : "quantity") as any,
        description: d.recommended ? "Recommended for this category" : `${d.type} unit`,
        baseUnit: d.baseUnit,
        defaultMultiplier: d.conversionFactor || 1,
      }));
    }
    return getUOMsForBusiness(industryType, categoryName);
  }, [dbUoms, industryType, categoryName]);

  const filteredUOMs = useMemo(() => {
    return searchUOMs(search, availableUOMs);
  }, [search, availableUOMs]);

  const selectedUOM = useMemo(() => {
    if (!value) return null;
    const lower = value.toLowerCase();
    // Check in available UOMs first
    const fromAvailable = availableUOMs.find(
      (u) => u.id.toLowerCase() === lower || u.name.toLowerCase() === lower || u.abbreviation.toLowerCase() === lower
    );
    if (fromAvailable) return fromAvailable;

    // Check in all standard UOMs
    const fromStandard = ALL_STANDARD_UOMS.find(
      (u) => u.id.toLowerCase() === lower || u.name.toLowerCase() === lower || u.abbreviation.toLowerCase() === lower
    );
    if (fromStandard) return fromStandard;

    return {
      id: value,
      name: value.charAt(0).toUpperCase() + value.slice(1),
      abbreviation: value.slice(0, 3).toLowerCase(),
      category: "quantity" as const,
      description: "Custom Unit",
    };
  }, [value, availableUOMs]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (uom: UOMOption) => {
    const matchingDb = dbUoms.find((d) => d.name.toLowerCase() === uom.name.toLowerCase());
    onChange(uom.name.toLowerCase(), {
      unitsPerUom: matchingDb?.conversionFactor || uom.defaultMultiplier || 1,
      baseUnit: matchingDb?.subUnit || uom.baseUnit || uom.name.toLowerCase(),
      decimalAllowed: matchingDb?.decimalAllowed ?? true,
    });
    setIsOpen(false);
    setSearch("");
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`flex h-10 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors ${
          hasError
            ? "border-destructive focus:ring-destructive/30"
            : "border-input hover:border-sky-400"
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          {selectedUOM ? (
            <>
              <span className="font-medium text-foreground truncate">{selectedUOM.name}</span>
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 shrink-0 font-mono">
                {selectedUOM.abbreviation}
              </Badge>
            </>
          ) : (
            <span className="text-muted-foreground text-xs">Select Unit of Measure...</span>
          )}
        </div>
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-72 w-full rounded-xl border border-border bg-popover shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95">
          <div className="p-2 border-b border-border bg-muted/30">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search unit (e.g. Pizza, kg, Piece)..."
                className="h-8 pl-8 text-xs bg-background rounded-lg border-border"
              />
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto p-1 divide-y divide-border/40">
            {filteredUOMs.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                No matching units found
              </div>
            ) : (
              filteredUOMs.map((u) => {
                const isSelected = selectedUOM?.id.toLowerCase() === u.id.toLowerCase();
                const dbMatch = dbUoms.find((d) => d.name.toLowerCase() === u.name.toLowerCase());

                return (
                  <div
                    key={u.id}
                    onClick={() => handleSelect(u)}
                    className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer text-xs transition-colors hover:bg-muted/80 ${
                      isSelected ? "bg-primary/10 font-bold text-primary" : "text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold truncate">{u.name}</span>
                      <Badge variant="outline" className="text-[9px] px-1 font-mono shrink-0">
                        {u.abbreviation}
                      </Badge>
                      {dbMatch?.recommended && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                          Recommended
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-[10px] text-muted-foreground capitalize">
                        {u.category}
                      </span>
                      {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
