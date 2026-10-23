import fs from "fs";
import path from "path";

export type CreditTransactionType =
  | "deposit_add"
  | "deposit_spend"
  | "udhar_charge"
  | "udhar_repayment"
  | "charge"
  | "payment"
  | "adjustment";

export interface StoreCreditTransaction {
  id: string;
  date: string;
  type: CreditTransactionType;
  amount: number;
  note?: string;
  invoice_no?: string;
  payment_method?: string;
  processed_by?: string;
  deposit_balance_after?: number;
  udhar_balance_after?: number;
  balance_after?: number; // legacy compatibility
}

export interface StoreCreditRecord {
  id: string;
  buyer_id: string; // e.g. BUY-10482
  business_id: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  customer_address?: string;
  outstanding_udhar: number; // positive = customer owes store (Udhar)
  available_deposit: number; // positive = advance customer deposit held by store
  balance: number; // backward compatibility: mirrors outstanding_udhar
  credit_limit: number;
  notes?: string;
  transactions: StoreCreditTransaction[];
  created_at: string;
  updated_at: string;
}

const DATA_FILE = path.join(process.cwd(), "data", "business_store_credits.json");

function generateBuyerId(existingList: StoreCreditRecord[]): string {
  const usedNumbers = new Set<number>();
  existingList.forEach((r) => {
    if (r.buyer_id && r.buyer_id.startsWith("BUY-")) {
      const num = parseInt(r.buyer_id.replace("BUY-", ""), 10);
      if (!isNaN(num)) usedNumbers.add(num);
    }
  });

  let candidate = 10001;
  while (usedNumbers.has(candidate)) {
    candidate++;
  }
  return `BUY-${candidate}`;
}

class StoreCreditsStorage {
  private cache: Record<string, StoreCreditRecord[]> = {};

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, "utf-8");
        this.cache = JSON.parse(raw);
        // Normalize any old records to ensure buyer_id, outstanding_udhar, available_deposit
        Object.keys(this.cache).forEach((bId) => {
          const list = this.cache[bId];
          if (Array.isArray(list)) {
            list.forEach((rec, idx) => {
              if (!rec.buyer_id) {
                rec.buyer_id = `BUY-${10000 + idx + 1}`;
              }
              if (rec.outstanding_udhar === undefined) {
                rec.outstanding_udhar = Number(rec.balance || 0);
              }
              if (rec.available_deposit === undefined) {
                rec.available_deposit = 0;
              }
              rec.balance = rec.outstanding_udhar;
            });
          }
        });
      }
    } catch {
      this.cache = {};
    }
  }

  private persist() {
    try {
      const dir = path.dirname(DATA_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.cache, null, 2), "utf-8");
    } catch (e) {
      console.warn("Failed to persist store credits data:", e);
    }
  }

  public getByBusiness(businessId: string): StoreCreditRecord[] {
    return this.cache[businessId] || [];
  }

  public getById(businessId: string, creditId: string): StoreCreditRecord | undefined {
    const list = this.getByBusiness(businessId);
    return list.find((c) => c.id === creditId || c.buyer_id === creditId);
  }

  public findByIdentity(businessId: string, query: string): StoreCreditRecord[] {
    const list = this.getByBusiness(businessId);
    const q = query.trim().toLowerCase();
    if (!q) return list;

    return list.filter((c) => {
      const bId = (c.buyer_id || "").toLowerCase();
      const phone = (c.customer_phone || "").replace(/[^0-9]/g, "");
      const cleanQ = q.replace(/[^0-9]/g, "");
      const name = (c.customer_name || "").toLowerCase();

      if (bId === q || bId.includes(q)) return true;
      if (cleanQ && phone && (phone === cleanQ || phone.endsWith(cleanQ))) return true;
      if (name.includes(q)) return true;
      return false;
    });
  }

  public upsert(businessId: string, payload: Partial<StoreCreditRecord>): StoreCreditRecord {
    if (!this.cache[businessId]) {
      this.cache[businessId] = [];
    }
    const list = this.cache[businessId];
    const now = new Date().toISOString();

    const existingIndex = payload.id ? list.findIndex((c) => c.id === payload.id) : -1;
    if (existingIndex >= 0) {
      const current = list[existingIndex];
      const updatedUdhar =
        payload.outstanding_udhar !== undefined
          ? Math.max(0, Number(payload.outstanding_udhar))
          : payload.balance !== undefined
          ? Math.max(0, Number(payload.balance))
          : current.outstanding_udhar;
      const updatedDeposit =
        payload.available_deposit !== undefined
          ? Math.max(0, Number(payload.available_deposit))
          : current.available_deposit;

      const updated: StoreCreditRecord = {
        ...current,
        ...payload,
        buyer_id: current.buyer_id || payload.buyer_id || generateBuyerId(list),
        outstanding_udhar: updatedUdhar,
        available_deposit: updatedDeposit,
        balance: updatedUdhar, // legacy compatibility
        updated_at: now,
      };
      list[existingIndex] = updated;
      this.persist();
      return updated;
    }

    const assignedBuyerId = payload.buyer_id || generateBuyerId(list);
    const initialUdhar = Math.max(0, Number(payload.outstanding_udhar ?? payload.balance ?? 0));
    const initialDeposit = Math.max(0, Number(payload.available_deposit ?? 0));

    const newRecord: StoreCreditRecord = {
      id: payload.id || `credit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      buyer_id: assignedBuyerId,
      business_id: businessId,
      customer_name: (payload.customer_name || "Customer").trim(),
      customer_phone: payload.customer_phone?.trim(),
      customer_email: payload.customer_email?.trim(),
      customer_address: payload.customer_address?.trim(),
      outstanding_udhar: initialUdhar,
      available_deposit: initialDeposit,
      balance: initialUdhar,
      credit_limit: Number(payload.credit_limit) || 1000,
      notes: payload.notes || "",
      transactions: Array.isArray(payload.transactions) ? payload.transactions : [],
      created_at: now,
      updated_at: now,
    };

    // If an initial deposit was supplied, record a deposit transaction
    if (initialDeposit > 0 && newRecord.transactions.length === 0) {
      newRecord.transactions.push({
        id: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        date: now,
        type: "deposit_add",
        amount: initialDeposit,
        note: "Initial advance store credit deposit",
        payment_method: "Cash",
        deposit_balance_after: initialDeposit,
        udhar_balance_after: initialUdhar,
        balance_after: initialUdhar,
      });
    }

    list.unshift(newRecord);
    this.persist();
    return newRecord;
  }

  public adjustBalance(
    businessId: string,
    creditId: string,
    amount: number,
    type: CreditTransactionType,
    note?: string,
    invoiceNo?: string,
    processedBy?: string,
    paymentMethod?: string
  ): StoreCreditRecord | null {
    const record = this.getById(businessId, creditId);
    if (!record) return null;

    const absAmount = Math.abs(Number(amount) || 0);
    const now = new Date().toISOString();

    if (!Array.isArray(record.transactions)) {
      record.transactions = [];
    }

    // CRITICAL: Outstanding Udhar and Available Deposit balances MUST be maintained separately and never auto-offset silently.
    if (type === "deposit_add") {
      record.available_deposit = Math.round((record.available_deposit + absAmount) * 100) / 100;
    } else if (type === "deposit_spend") {
      record.available_deposit = Math.max(0, Math.round((record.available_deposit - absAmount) * 100) / 100);
    } else if (type === "udhar_charge" || type === "charge") {
      // customer took goods on credit -> increases outstanding debt
      record.outstanding_udhar = Math.round((record.outstanding_udhar + absAmount) * 100) / 100;
    } else if (type === "udhar_repayment" || type === "payment") {
      // customer paid back udhar -> decreases outstanding debt
      record.outstanding_udhar = Math.max(0, Math.round((record.outstanding_udhar - absAmount) * 100) / 100);
    } else if (type === "adjustment") {
      // Default adjustment applies to udhar
      record.outstanding_udhar = Math.max(0, Math.round((record.outstanding_udhar + amount) * 100) / 100);
    }

    record.balance = record.outstanding_udhar; // legacy sync
    record.updated_at = now;

    record.transactions.unshift({
      id: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      date: now,
      type,
      amount: absAmount,
      note:
        note ||
        (type === "deposit_add"
          ? "Advance deposit received"
          : type === "deposit_spend"
          ? "Deposit used for purchase"
          : type === "udhar_charge" || type === "charge"
          ? "Store credit purchase (+ Udhar)"
          : "Udhar repayment received"),
      invoice_no: invoiceNo,
      payment_method: paymentMethod || "Cash",
      processed_by: processedBy || "Register",
      deposit_balance_after: record.available_deposit,
      udhar_balance_after: record.outstanding_udhar,
      balance_after: record.outstanding_udhar,
    });

    this.persist();
    return record;
  }

  public delete(businessId: string, creditId: string): boolean {
    if (!this.cache[businessId]) return false;
    const initialLen = this.cache[businessId].length;
    this.cache[businessId] = this.cache[businessId].filter((c) => c.id !== creditId && c.buyer_id !== creditId);
    if (this.cache[businessId].length !== initialLen) {
      this.persist();
      return true;
    }
    return false;
  }
}

export const storeCreditsStorage = new StoreCreditsStorage();
