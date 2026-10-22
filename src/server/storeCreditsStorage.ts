import fs from "fs";
import path from "path";

export interface StoreCreditTransaction {
  id: string;
  date: string;
  type: "charge" | "payment";
  amount: number;
  note?: string;
  invoice_no?: string;
  processed_by?: string;
}

export interface StoreCreditRecord {
  id: string;
  business_id: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  balance: number; // positive = customer owes store (Udhar)
  credit_limit?: number;
  notes?: string;
  transactions: StoreCreditTransaction[];
  created_at: string;
  updated_at: string;
}

const DATA_FILE = path.join(process.cwd(), "data", "business_store_credits.json");

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
    return list.find((c) => c.id === creditId);
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
      const updated: StoreCreditRecord = {
        ...current,
        ...payload,
        balance: payload.balance !== undefined ? Number(payload.balance) : current.balance,
        updated_at: now,
      };
      list[existingIndex] = updated;
      this.persist();
      return updated;
    }

    const newRecord: StoreCreditRecord = {
      id: payload.id || `credit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      business_id: businessId,
      customer_name: (payload.customer_name || "Customer").trim(),
      customer_phone: payload.customer_phone?.trim(),
      customer_email: payload.customer_email?.trim(),
      balance: Number(payload.balance) || 0,
      credit_limit: Number(payload.credit_limit) || 1000,
      notes: payload.notes || "",
      transactions: Array.isArray(payload.transactions) ? payload.transactions : [],
      created_at: now,
      updated_at: now,
    };
    list.unshift(newRecord);
    this.persist();
    return newRecord;
  }

  public adjustBalance(
    businessId: string,
    creditId: string,
    amount: number,
    type: "charge" | "payment",
    note?: string,
    invoiceNo?: string,
    processedBy?: string
  ): StoreCreditRecord | null {
    const record = this.getById(businessId, creditId);
    if (!record) return null;

    const absAmount = Math.abs(Number(amount) || 0);
    const now = new Date().toISOString();

    // charge = increases Udhar (customer owes more); payment = reduces Udhar (debt paid)
    const delta = type === "charge" ? absAmount : -absAmount;
    record.balance = Math.max(0, record.balance + delta);
    record.updated_at = now;

    if (!Array.isArray(record.transactions)) {
      record.transactions = [];
    }
    record.transactions.unshift({
      id: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      date: now,
      type,
      amount: absAmount,
      note: note || (type === "charge" ? "Store credit purchase" : "Udhar payment settled"),
      invoice_no: invoiceNo,
      processed_by: processedBy,
    });

    this.persist();
    return record;
  }

  public delete(businessId: string, creditId: string): boolean {
    if (!this.cache[businessId]) return false;
    const initialLen = this.cache[businessId].length;
    this.cache[businessId] = this.cache[businessId].filter((c) => c.id !== creditId);
    if (this.cache[businessId].length !== initialLen) {
      this.persist();
      return true;
    }
    return false;
  }
}

export const storeCreditsStorage = new StoreCreditsStorage();
