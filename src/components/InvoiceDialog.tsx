import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Download, ArrowRight } from "lucide-react";
import jsPDF from "jspdf";

export interface InvoiceData {
  invoiceNumber: string;
  date: string;
  customerName: string;
  customerEmail: string;
  planName: string;
  period: string;
  paymentMethod: string;
  subtotal: number;
  discount: number;
  couponCode?: string;
  tax: number;
  total: number;
  currencySymbol?: string;
  taxRate?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onContinue: () => void;
  invoice: InvoiceData | null;
}

const InvoiceDialog = ({ open, onClose, onContinue, invoice }: Props) => {
  if (!invoice) return null;

  const cur = invoice.currencySymbol ?? "$";
  const taxPct = invoice.taxRate ?? 10;


  const handleDownload = () => {
    const doc = new jsPDF();
    const left = 20;
    let y = 20;

    // Header
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("GeFlow", left, y);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("by Gepard Tech", left, y + 6);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("INVOICE", 190, y, { align: "right" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`#${invoice.invoiceNumber}`, 190, y + 6, { align: "right" });
    doc.text(invoice.date, 190, y + 11, { align: "right" });

    y += 25;
    doc.setDrawColor(200);
    doc.line(left, y, 190, y);

    // Bill To
    y += 10;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("BILL TO", left, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(invoice.customerName, left, y + 7);
    doc.setFontSize(9);
    doc.text(invoice.customerEmail, left, y + 13);

    doc.setFont("helvetica", "bold");
    doc.text("PAYMENT METHOD", 190, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(invoice.paymentMethod, 190, y + 7, { align: "right" });

    // Table
    y += 28;
    doc.setFillColor(245, 245, 250);
    doc.rect(left, y, 170, 10, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("DESCRIPTION", left + 3, y + 7);
    doc.text("BILLING", 130, y + 7);
    doc.text("AMOUNT", 187, y + 7, { align: "right" });

    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(invoice.planName, left + 3, y);
    doc.setFontSize(9);
    doc.text(invoice.period, 130, y);
    doc.setFontSize(11);
    doc.text(`${cur}${invoice.subtotal.toFixed(2)}`, 187, y, { align: "right" });

    // Totals
    y += 15;
    doc.line(left, y, 190, y);
    y += 8;
    doc.setFontSize(10);
    doc.text("Subtotal", 130, y);
    doc.text(`${cur}${invoice.subtotal.toFixed(2)}`, 187, y, { align: "right" });

    if (invoice.discount > 0) {
      y += 7;
      doc.text(`Discount (${invoice.couponCode})`, 130, y);
      doc.text(`-${cur}${invoice.discount.toFixed(2)}`, 187, y, { align: "right" });
    }

    y += 7;
    doc.text(`Tax (${taxPct}%)`, 130, y);
    doc.text(`${cur}${invoice.tax.toFixed(2)}`, 187, y, { align: "right" });

    y += 5;
    doc.line(125, y, 190, y);
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("TOTAL PAID", 130, y);
    doc.text(`${cur}${invoice.total.toFixed(2)}`, 187, y, { align: "right" });

    // Footer
    y = 270;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text("Thank you for choosing GeFlow. For support, contact gepardwebs@gmail.com", 105, y, { align: "center" });
    doc.text("This is an electronically generated invoice and does not require a signature.", 105, y + 5, { align: "center" });

    doc.save(`GeFlow-Invoice-${invoice.invoiceNumber}.pdf`);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-6 text-center border-b border-border">
          <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="h-9 w-9 text-primary" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">Payment Successful 🎉</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mt-2">Your <span className="font-semibold text-foreground">{invoice.planName}</span> is now active.</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-muted/40 rounded-xl p-5 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold tracking-wider text-muted-foreground">INVOICE NUMBER</span>
              <span className="font-bold">#{invoice.invoiceNumber}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold tracking-wider text-muted-foreground">DATE</span>
              <span className="font-semibold text-sm">{invoice.date}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold tracking-wider text-muted-foreground">CUSTOMER</span>
              <span className="font-semibold text-sm">{invoice.customerName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold tracking-wider text-muted-foreground">METHOD</span>
              <span className="font-semibold text-sm">{invoice.paymentMethod}</span>
            </div>
            <div className="border-t border-border pt-3 flex justify-between items-center">
              <span className="font-bold">Total Paid</span>
              <span className="text-2xl font-bold text-primary">{cur}{invoice.total.toFixed(2)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button onClick={handleDownload} variant="outline" className="h-12 font-bold gap-2">
              <Download className="h-4 w-4" /> Download PDF
            </Button>
            <Button onClick={onContinue} className="h-12 font-bold gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceDialog;
