import React, { useState, useMemo, useRef, useEffect } from "react";
import { Check, ChevronsUpDown, Search, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  UOMOption,
  getUOMsForBusiness,
  searchUOMs,
  ALL_STANDARD_UOMS,
} from "@/lib/uomRegistry";

interface UOMSelectProps {
  value: string;
  onChange: (value: string) => void;
  industryType?: string | null;
  categoryName?: string | null;
  hasError?: boolean;
  disabled?: boolean;
  id?: string;
}

export const UOMSelect: React.FC<UOMSelectProps> = ({
  value,
  onChange,
  industryType,
  categoryName,
  hasError = false,
  disabled = false,
  id = "uom-select",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Business tailored UOMs
  const availableUOMs = useMemo(() => {
    return getUOMsForBusiness(industryType, categoryName);
  }, [industryType, categoryName]);

  const filteredUOMs = useMemo(() => {
    return searchUOMs(search, availableUOMs);
  }, [search, availableUOMs]);

  const selectedUOM = useMemo(() => {
    if (!value) return null;
    return (
      ALL_STANDARD_UOMS.find(
        (u) => u.id.toLowerCase() === value.toLowerCase() || u.name.toLowerCase() === value.toLowerCase()
      ) || {
        id: value,
        name: value,
        abbreviation: value,
        category: "quantity" as const,
        description: "Custom Unit",
      }
    );
  }, [value]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      // Auto-focus search
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (uomId: string) => {
    onChange(uomId);
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
              <Badge variant="secondary" className="text-[10px] h-4 px-1 shrink-0 font-normal">
                {selectedUOM.abbreviation}
              </Badge>
            </>
          ) : (
            <span className="text-muted-foreground">Select Unit of Measure...</span>
          )}
        </div>
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-64 w-full min-w-[240px] rounded-md border border-border bg-popover text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95 overflow-hidden flex flex-col">
          {/* Search bar */}
          <div className="p-2 border-b border-border bg-muted/40 flex items-center gap-1.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-1" />
            <Input
              ref={searchInputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search units (e.g. Tablet, Box, kg)..."
              className="h-7 text-xs border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-1"
            />
          </div>

          {/* List of UOMs */}
          <div className="overflow-y-auto max-h-48 p-1">
            {filteredUOMs.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground">
                No matching units found.
              </div>
            ) : (
              filteredUOMs.map((opt) => {
                const isSelected = selectedUOM?.id.toLowerCase() === opt.id.toLowerCase();
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelect(opt.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-sm text-xs text-left transition-colors ${
                      isSelected
                        ? "bg-primary text-primary-foreground font-medium"
                        : "hover:bg-muted text-foreground"
                    }`}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="truncate">{opt.name}</span>
                        <span
                          className={`text-[10px] ${
                            isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                          }`}
                        >
                          ({opt.abbreviation})
                        </span>
                      </div>
                      {opt.description && (
                        <span
                          className={`text-[9px] truncate ${
                            isSelected ? "text-primary-foreground/70" : "text-muted-foreground/80"
                          }`}
                        >
                          {opt.description}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
