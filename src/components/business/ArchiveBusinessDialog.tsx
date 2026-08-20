import { BusinessItem } from "@/types/business";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Loader2 } from "lucide-react";

interface ArchiveBusinessDialogProps {
  business: BusinessItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (business: BusinessItem) => Promise<void>;
  busy: boolean;
}

export const ArchiveBusinessDialog = ({
  business,
  open,
  onOpenChange,
  onConfirm,
  busy,
}: ArchiveBusinessDialogProps) => {
  if (!business) return null;

  const isArchived = business.status === "archived";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md rounded-3xl border-border bg-card">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/15 text-rose-500 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <AlertDialogTitle className="text-lg font-bold text-foreground">
                {isArchived ? "Restore Business" : "Archive Business"}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-muted-foreground">
                {business.business_name}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <div className="text-xs text-muted-foreground py-2 leading-relaxed">
          {isArchived ? (
            <p>
              Restoring <strong className="text-foreground">{business.business_name}</strong> will reactivate its operational inventory and POS workspace.
            </p>
          ) : (
            <p>
              Are you sure you want to archive <strong className="text-foreground">{business.business_name}</strong>? It will no longer be available in quick-switch routing until restored. Historical sales and inventory records will remain safely preserved.
            </p>
          )}
        </div>

        <AlertDialogFooter className="gap-2 pt-2 border-t border-border">
          <AlertDialogCancel className="rounded-xl text-xs" disabled={busy}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(e) => {
              e.preventDefault();
              onConfirm(business);
            }}
            className={`rounded-xl text-xs font-bold text-white ${
              isArchived
                ? "bg-emerald-500 hover:bg-emerald-600"
                : "bg-rose-500 hover:bg-rose-600"
            }`}
          >
            {busy ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Processing...
              </>
            ) : isArchived ? (
              "Restore Business"
            ) : (
              "Archive Business"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
