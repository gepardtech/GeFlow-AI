import * as React from "react";
import { cn } from "@/lib/utils";

interface TooltipContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const TooltipContext = React.createContext<TooltipContextType | null>(null);

interface TooltipProviderProps {
  children?: React.ReactNode;
  delayDuration?: number;
  skipDelayDuration?: number;
  disableHoverableContent?: boolean;
}

const TooltipProviderContext = React.createContext<{ delayDuration: number }>({ delayDuration: 300 });

export const TooltipProvider: React.FC<TooltipProviderProps> = ({
  children,
  delayDuration = 300,
}) => {
  return (
    <TooltipProviderContext.Provider value={{ delayDuration }}>
      {children}
    </TooltipProviderContext.Provider>
  );
};

export const Tooltip: React.FC<{
  children: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  delayDuration?: number;
}> = ({ children, open: controlledOpen, defaultOpen = false, onOpenChange }) => {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange]
  );

  return (
    <TooltipContext.Provider value={{ open: isOpen, setOpen }}>
      {children}
    </TooltipContext.Provider>
  );
};

export const TooltipTrigger = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement> & { asChild?: boolean }
>(({ children, asChild, ...props }, forwardedRef) => {
  const ctx = React.useContext(TooltipContext);
  const providerCtx = React.useContext(TooltipProviderContext);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = (e: React.MouseEvent<HTMLElement>) => {
    (props as any).onMouseEnter?.(e);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      ctx?.setOpen(true);
    }, providerCtx.delayDuration || 200);
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLElement>) => {
    (props as any).onMouseLeave?.(e);
    if (timerRef.current) clearTimeout(timerRef.current);
    ctx?.setOpen(false);
  };

  const handleFocus = (e: React.FocusEvent<HTMLElement>) => {
    (props as any).onFocus?.(e);
    ctx?.setOpen(true);
  };

  const handleBlur = (e: React.FocusEvent<HTMLElement>) => {
    (props as any).onBlur?.(e);
    ctx?.setOpen(false);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      ref: forwardedRef,
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
      onFocus: handleFocus,
      onBlur: handleBlur,
      ...props,
    });
  }

  return (
    <span
      ref={forwardedRef as any}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      {...props}
    >
      {children}
    </span>
  );
});
TooltipTrigger.displayName = "TooltipTrigger";

export const TooltipContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    side?: "top" | "right" | "bottom" | "left";
    align?: "start" | "center" | "end";
    sideOffset?: number;
    hidden?: boolean;
  }
>(({ className, hidden, children, ...props }, ref) => {
  const ctx = React.useContext(TooltipContext);
  if (!ctx?.open || hidden) return null;

  return (
    <div
      ref={ref}
      role="tooltip"
      className={cn(
        "z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-xs font-medium text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 pointer-events-none select-none",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});
TooltipContent.displayName = "TooltipContent";
