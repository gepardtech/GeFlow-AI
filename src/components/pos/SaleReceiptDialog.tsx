import { useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { CheckCircle2, Printer, ArrowRight, Download, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ReceiptLine {
  name: string;
  qty: number;
  unit: number;
  total: number;
}

export interface ReceiptData {
  invoiceNo: string;
  date: Date;
  businessName: string;
  businessAddress?: string;
  businessPhone?: string;
  logoUrl?: string | null;
  receiptHeader?: string;
  receiptSubheader?: string;
  receiptFooter?: string;
  cashierName?: string;
  customerName?: string;
  customerPhone?: string;
  patientNote?: string;
  showLogoOnReceipt?: boolean;
  showTaxBreakdown?: boolean;
  showCashierName?: boolean;
  showBarcodeOnReceipt?: boolean;
  autoPrintReceipt?: boolean;
  lines: ReceiptLine[];
  subtotal: number;
  discount: number;
  taxRate: number;
  tax: number;
  total: number;
  payMethod: "cash" | "card";
  cashGiven: number;
  changeDue: number;
  symbol: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: ReceiptData | null;
  onNewCustomer: () => void;
}

const money = (sym: string, n: number) =>
  `${sym}${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-CA"); // YYYY-MM-DD

const fmtTime = (d: Date) =>
  d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

export const SaleReceiptDialog = ({ open, onOpenChange, data, onNewCustomer }: Props) => {
  const printedRef = useRef(false);

  const sym = data?.symbol || "$";
  const showLogo = data?.showLogoOnReceipt !== false;
  const showTax = data?.showTaxBreakdown !== false;
  const showCashier = data?.showCashierName !== false;
  const showBarcode = data?.showBarcodeOnReceipt !== false;
  const headerTitle = data?.receiptHeader || data?.businessName || "GEFLOW STORE";
  const subheader = data?.receiptSubheader || "Official Store Receipt & Fiscal Log";
  const footerMsg = data?.receiptFooter || "Thank you for choosing us! Returns accepted within 14 days.";
  const storeAddress = data?.businessAddress || "";

  const handlePrint = useCallback(() => {
    if (!data) return;
    const rows = data.lines
      .map(
        (l) =>
          `<tr>
            <td class="nm">${l.name}</td>
            <td class="qt">${l.qty}</td>
            <td class="pr">${money(sym, l.total)}</td>
          </tr>`,
      )
      .join("");

    const logoHtml = showLogo && data.logoUrl
      ? `<div style="text-align:center;margin-bottom:6px;"><img src="${data.logoUrl}" style="max-height:48px;max-width:120px;object-fit:contain;" alt="Logo" /></div>`
      : "";

    const barcodeHtml = showBarcode
      ? `<div class="barcode-box">
          <div class="bars">||| | |||| | ||||| || | |||</div>
          <div class="bar-num">${data.invoiceNo}-RETURN-AUTH</div>
         </div>`
      : "";

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${data.invoiceNo}</title>
      <style>
        @page { size: 80mm auto; margin: 0; }
        * { font-family: 'Courier New', Courier, monospace; box-sizing: border-box; }
        body { width: 72mm; margin: 0 auto; padding: 12px 6px; color: #111; font-size: 11px; line-height: 1.3; }
        .center { text-align: center; }
        .head { text-transform: uppercase; font-size: 13px; font-weight: 900; letter-spacing: 0.5px; margin: 0; }
        .sub { font-size: 9px; color: #555; margin: 2px 0; }
        .addr { font-size: 9px; color: #555; margin-bottom: 6px; }
        .meta { font-size: 10px; color: #333; margin: 6px 0; }
        .meta-row { display: flex; justify-content: space-between; }
        .dash { border-top: 1px dashed #777; margin: 6px 0; }
        table { width: 100%; border-collapse: collapse; font-size: 10px; }
        th { text-align: left; padding: 2px 0; font-size: 10px; }
        th.qt { text-align: center; width: 30px; }
        th.pr { text-align: right; width: 55px; }
        td { padding: 2px 0; vertical-align: top; }
        td.nm { max-width: 140px; word-break: break-word; }
        td.qt { text-align: center; }
        td.pr { text-align: right; }
        .calc-row { display: flex; justify-content: space-between; font-size: 10px; padding: 1.5px 0; }
        .calc-row.muted { color: #555; }
        .total-due { display: flex; justify-content: space-between; font-size: 13px; font-weight: 900; border-top: 1px solid #111; padding-top: 4px; margin-top: 4px; }
        .barcode-box { text-align: center; margin: 8px 0 4px; padding-top: 6px; border-top: 1px dashed #777; }
        .bars { font-size: 10px; font-weight: 900; letter-spacing: 2px; background: #eee; padding: 3px 6px; display: inline-block; border-radius: 3px; }
        .bar-num { font-size: 8px; color: #666; margin-top: 2px; }
        .foot { text-align: center; font-size: 9px; color: #555; margin-top: 8px; line-height: 1.3; }
        .powered { text-align: center; font-size: 8px; color: #888; margin-top: 4px; }
      </style></head><body>
      ${logoHtml}
      <div class="center">
        <div class="head">${headerTitle}</div>
        <div class="sub">${subheader}</div>
        ${storeAddress ? `<div class="addr">${storeAddress}</div>` : ""}
      </div>
      <div class="dash"></div>
      <div class="meta">
        <div class="meta-row"><span>DATE: ${fmtDate(data.date)}</span><span>TIME: ${fmtTime(data.date)}</span></div>
        <div class="meta-row"><span>RECEIPT #: ${data.invoiceNo}</span>${showCashier && data.cashierName ? `<span>CASHIER: ${data.cashierName}</span>` : ""}</div>
        ${(data.customerName || data.customerPhone) ? `<div class="meta-row" style="margin-top:2px;font-weight:bold;"><span>CUSTOMER: ${data.customerName || "Walk-in"}</span>${data.customerPhone ? `<span>TEL: ${data.customerPhone}</span>` : ""}</div>` : ""}
        ${data.patientNote ? `<div class="meta-row" style="margin-top:2px;font-size:9px;color:#444;"><span>RX / NOTE: ${data.patientNote}</span></div>` : ""}
      </div>
      <div class="dash"></div>
      <table>
        <thead>
          <tr><th>ITEM</th><th class="qt">QTY</th><th class="pr">AMT</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="dash"></div>
      <div class="calc-row"><span>SUBTOTAL</span><span>${money(sym, data.subtotal)}</span></div>
      ${data.discount > 0 ? `<div class="calc-row muted"><span>DISCOUNT</span><span>-${money(sym, data.discount)}</span></div>` : ""}
      ${showTax ? `<div class="calc-row muted"><span>TAX (${data.taxRate}%)</span><span>${money(sym, data.tax)}</span></div>` : ""}
      <div class="total-due"><span>TOTAL DUE</span><span>${money(sym, data.total)}</span></div>
      <div class="calc-row muted" style="margin-top:4px;"><span>TENDER (${data.payMethod.toUpperCase()})</span><span>${data.payMethod === "cash" ? money(sym, data.cashGiven) : money(sym, data.total)}</span></div>
      ${data.payMethod === "cash" ? `<div class="calc-row muted"><span>CHANGE</span><span>${money(sym, data.changeDue)}</span></div>` : ""}
      ${barcodeHtml}
      <div class="foot">${footerMsg}</div>
      <div class="powered">Powered by GeFlow OS</div>
      </body></html>`;

    const existing = document.getElementById("geflow-print-frame");
    if (existing) existing.remove();
    const frame = document.createElement("iframe");
    frame.id = "geflow-print-frame";
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    document.body.appendChild(frame);
    const doc = frame.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
    const run = () => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      setTimeout(() => frame.remove(), 1000);
    };
    if (frame.contentWindow?.document.readyState === "complete") setTimeout(run, 200);
    else frame.onload = () => setTimeout(run, 200);
  }, [data, sym, showLogo, showTax, showCashier, showBarcode, headerTitle, subheader, storeAddress, footerMsg]);

  useEffect(() => {
    if (open && data && data.autoPrintReceipt && !printedRef.current) {
      printedRef.current = true;
      const t = setTimeout(() => {
        handlePrint();
      }, 350);
      return () => clearTimeout(t);
    }
    if (!open) {
      printedRef.current = false;
    }
  }, [open, data, handlePrint]);

  if (!data) return null;

  const downloadReceipt = () => {
    const line = (a: string, b: string) => `${a}${" ".repeat(Math.max(1, 32 - a.length - b.length))}${b}`;
    const rows = data.lines
      .map((l) => line(`${l.qty} x ${l.name}`.slice(0, 22), money(sym, l.total)))
      .join("\n");
    const txt = [
      "=".repeat(32),
      headerTitle.toUpperCase().padStart((32 + headerTitle.length) / 2).slice(0, 32),
      subheader.padStart((32 + subheader.length) / 2).slice(0, 32),
      ...(storeAddress ? [storeAddress.padStart((32 + storeAddress.length) / 2).slice(0, 32)] : []),
      "-".repeat(32),
      `DATE: ${fmtDate(data.date)}  TIME: ${fmtTime(data.date)}`,
      `RECEIPT #: ${data.invoiceNo}`,
      ...(showCashier && data.cashierName ? [`CASHIER: ${data.cashierName}`] : []),
      ...(data.customerName || data.customerPhone ? [`CUSTOMER: ${data.customerName || "Walk-in"}${data.customerPhone ? ` (TEL: ${data.customerPhone})` : ""}`] : []),
      ...(data.patientNote ? [`RX / NOTE: ${data.patientNote}`] : []),
      "-".repeat(32),
      line("ITEM", "AMT"),
      rows,
      "-".repeat(32),
      line("SUBTOTAL", money(sym, data.subtotal)),
      ...(data.discount > 0 ? [line("DISCOUNT", `-${money(sym, data.discount)}`)] : []),
      ...(showTax ? [line(`TAX (${data.taxRate}%)`, money(sym, data.tax))] : []),
      line("TOTAL DUE", money(sym, data.total)),
      "-".repeat(32),
      line(`TENDER (${data.payMethod.toUpperCase()})`, data.payMethod === "cash" ? money(sym, data.cashGiven) : money(sym, data.total)),
      ...(data.payMethod === "cash" ? [line("CHANGE", money(sym, data.changeDue))] : []),
      ...(showBarcode ? ["-".repeat(32), `BARCODE: ${data.invoiceNo}-RETURN-AUTH`] : []),
      "-".repeat(32),
      footerMsg,
      "Powered by GeFlow OS",
      "=".repeat(32),
    ].join("\n");
    const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${data.invoiceNo}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-3xl border-border bg-card shadow-2xl">
        <div className="p-6 sm:p-7 max-h-[90vh] overflow-y-auto">
          {/* Header Banner */}
          <div className="flex items-center justify-between pb-4 border-b border-border/80">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center border border-emerald-500/20">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-foreground">Transaction Settled</h2>
                <p className="text-[10px] font-mono text-muted-foreground">INVOICE #{data.invoiceNo}</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[9px] font-extrabold uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              80mm Thermal Slip
            </span>
          </div>

          {/* EXACT THERMAL RECEIPT PREVIEW CARD */}
          <div className="mt-4 p-5 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono text-[11px] space-y-3 shadow-inner">
            {/* Header / Branding */}
            {showLogo && (
              <div className="text-center pb-2 border-b border-dashed border-zinc-300 dark:border-zinc-700 space-y-1">
                {data.logoUrl && (
                  <div className="flex justify-center mb-1">
                    <img
                      src={data.logoUrl}
                      alt="Logo"
                      className="h-10 max-w-[120px] object-contain rounded-md"
                    />
                  </div>
                )}
                <p className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-zinc-50">{headerTitle}</p>
                <p className="text-[9px] text-zinc-500 dark:text-zinc-400">{subheader}</p>
                {storeAddress && <p className="text-[9px] text-zinc-500 dark:text-zinc-400">{storeAddress}</p>}
              </div>
            )}

            {/* Date / Time / Cashier Metadata */}
            <div className="text-[10px] space-y-0.5 text-zinc-600 dark:text-zinc-400">
              <div className="flex justify-between">
                <span>DATE: {fmtDate(data.date)}</span>
                <span>TIME: {fmtTime(data.date)}</span>
              </div>
              <div className="flex justify-between">
                <span>RECEIPT #: {data.invoiceNo}</span>
                {showCashier && data.cashierName && <span>CASHIER: {data.cashierName}</span>}
              </div>
              {(data.customerName || data.customerPhone) && (
                <div className="flex justify-between font-bold text-zinc-800 dark:text-zinc-200 pt-0.5 border-t border-dotted border-zinc-300 dark:border-zinc-700">
                  <span className="truncate max-w-[60%]">CUST: {data.customerName || "Walk-in"}</span>
                  {data.customerPhone && <span>TEL: {data.customerPhone}</span>}
                </div>
              )}
              {data.patientNote && (
                <div className="text-[9px] text-zinc-500 dark:text-zinc-400 truncate">
                  <span>RX/NOTE: {data.patientNote}</span>
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="border-t border-b border-dashed border-zinc-300 dark:border-zinc-700 py-2 space-y-1 text-[10px]">
              <div className="flex justify-between font-bold text-zinc-800 dark:text-zinc-200">
                <span className="max-w-[55%]">ITEM</span>
                <span className="w-8 text-center">QTY</span>
                <span className="w-16 text-right">AMT</span>
              </div>
              {data.lines.map((line, idx) => (
                <div key={idx} className="flex justify-between text-zinc-700 dark:text-zinc-300">
                  <span className="truncate max-w-[55%]">{line.name}</span>
                  <span className="w-8 text-center">{line.qty}</span>
                  <span className="w-16 text-right font-medium">{money(sym, line.total)}</span>
                </div>
              ))}
            </div>

            {/* Totals Calculation */}
            <div className="space-y-1 text-[10px] pt-1">
              <div className="flex justify-between">
                <span>SUBTOTAL</span>
                <span>{money(sym, data.subtotal)}</span>
              </div>
              {data.discount > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span>DISCOUNT</span>
                  <span>-{money(sym, data.discount)}</span>
                </div>
              )}
              {showTax && (
                <div className="flex justify-between text-zinc-500 dark:text-zinc-400">
                  <span>TAX ({data.taxRate}%)</span>
                  <span>{money(sym, data.tax)}</span>
                </div>
              )}
              <div className="flex justify-between font-black text-xs pt-1.5 border-t border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100">
                <span>TOTAL DUE</span>
                <span>{money(sym, data.total)}</span>
              </div>
              <div className="flex justify-between text-zinc-500 dark:text-zinc-400 pt-0.5">
                <span>TENDER ({data.payMethod.toUpperCase()})</span>
                <span>{data.payMethod === "cash" ? money(sym, data.cashGiven) : money(sym, data.total)}</span>
              </div>
              {data.payMethod === "cash" && (
                <div className="flex justify-between text-zinc-500 dark:text-zinc-400">
                  <span>CHANGE</span>
                  <span>{money(sym, data.changeDue)}</span>
                </div>
              )}
            </div>

            {/* Barcode Section */}
            {showBarcode && (
              <div className="pt-2 text-center border-t border-dashed border-zinc-300 dark:border-zinc-700">
                <div className="inline-block px-4 py-1.5 bg-zinc-200 dark:bg-zinc-800 rounded font-black tracking-widest text-[9px] text-zinc-800 dark:text-zinc-200">
                  ||| | |||| | ||||| || |
                </div>
                <p className="text-[8px] text-zinc-400 mt-0.5">{data.invoiceNo}-RETURN-AUTH</p>
              </div>
            )}

            {/* Footer Message */}
            <p className="text-[9px] text-center text-zinc-500 dark:text-zinc-400 pt-1 leading-tight">
              {footerMsg}
            </p>
            <p className="text-[8px] text-center text-zinc-400 dark:text-zinc-500 pt-0.5">
              Powered by GeFlow OS
            </p>
          </div>

          {/* Action Buttons */}
          <div className="mt-5 space-y-2.5">
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                onClick={handlePrint}
                className="h-11 rounded-2xl bg-foreground text-background font-bold flex items-center justify-center gap-2 hover:opacity-90 transition shadow-sm"
              >
                <Printer className="h-4 w-4" /> Print Thermal Slip
              </Button>
              <Button
                type="button"
                onClick={downloadReceipt}
                variant="outline"
                className="h-11 rounded-2xl border-border font-bold flex items-center justify-center gap-2 hover:bg-muted transition"
              >
                <Download className="h-4 w-4 text-sky-500" /> Download
              </Button>
            </div>
            <Button
              type="button"
              onClick={onNewCustomer}
              className="w-full h-11 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-bold flex items-center justify-center gap-2 transition shadow-sm"
            >
              New Sale / Next Customer <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SaleReceiptDialog;
