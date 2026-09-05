import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock, Trash2, ArrowRight, User, ShoppingBag, Phone, FileText } from "lucide-react";

export interface HeldOrderRecord {
  id: string;
  business_id: string;
  owner_user_id?: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_note?: string | null;
  cart_data: any[];
  total_amount: number;
  item_count: number;
  created_at: string;
  updated_at?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: HeldOrderRecord[];
  onResume: (order: HeldOrderRecord) => void;
  onDelete: (orderId: string) => void;
  formatMoney: (amt: number) => string;
}

export const HeldOrdersModal: React.FC<Props> = ({
  open,
  onOpenChange,
  orders,
  onResume,
  onDelete,
  formatMoney,
}) => {
  const getElapsed = (dateStr: string) => {
    try {
      const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
      if (diff < 60) return "Just now";
      const mins = Math.floor(diff / 60);
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}h ago`;
      return `${Math.floor(hrs / 24)}d ago`;
    } catch {
      return "Recently";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden border border-border shadow-2xl">
        <DialogHeader className="p-4 sm:p-5 border-b border-border bg-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-extrabold text-foreground">
                  Held Orders Queue
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Resume or cancel paused transactions ({orders.length} order{orders.length === 1 ? "" : "s"})
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="p-4 sm:p-5 max-h-[65vh] overflow-y-auto space-y-3">
          {orders.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground space-y-2">
              <ShoppingBag className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <p className="text-sm font-bold text-foreground">No orders on hold</p>
              <p className="text-xs">
                To hold an order, add items to the cart and click the &ldquo;Hold&rdquo; button in POS.
              </p>
            </div>
          ) : (
            orders.map((order) => {
              const lines = Array.isArray(order.cart_data) ? order.cart_data : [];
              return (
                <div
                  key={order.id}
                  className="bg-card border border-border/80 rounded-xl p-3.5 hover:border-amber-500/50 hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-sky-500" />
                        {order.customer_name || "Walk-in Customer"}
                      </span>
                      {order.customer_phone && (
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                          <Phone className="h-3 w-3 text-muted-foreground/70" />
                          {order.customer_phone}
                        </span>
                      )}
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted font-bold text-muted-foreground ml-auto sm:ml-0">
                        {getElapsed(order.created_at)}
                      </span>
                    </div>

                    {order.customer_note && (
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1 italic truncate">
                        <FileText className="h-3 w-3 shrink-0" />
                        {order.customer_note}
                      </p>
                    )}

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        {order.item_count || lines.length} item(s):
                      </span>
                      <span className="truncate max-w-[280px] sm:max-w-xs text-[11px]">
                        {lines.map((l: any) => `${l.name} (x${l.qty})`).join(", ")}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
                    <div className="text-left sm:text-right">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                        Total
                      </p>
                      <p className="text-sm font-extrabold text-foreground">
                        {formatMoney(order.total_amount)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onDelete(order.id)}
                        className="h-9 w-9 rounded-xl border border-border/80 hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/30 flex items-center justify-center text-muted-foreground transition"
                        title="Delete Held Order"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <Button
                        type="button"
                        onClick={() => onResume(order)}
                        className="h-9 px-3.5 bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm"
                      >
                        <span>Resume</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
