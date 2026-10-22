import fs from "fs";
import path from "path";
import { serverSupabase } from "../supabase";

export type UserPaymentMethodType = "card" | "paypal";

export interface UserSavedPaymentMethod {
  id: string;
  userId: string;
  type: UserPaymentMethodType;
  card?: {
    brand: "VISA" | "Mastercard" | "American Express" | "Discover" | "Card";
    last4: string;
    expMonth: string;
    expYear: string;
    holderName: string;
    zip?: string;
  };
  paypal?: {
    email: string;
  };
  createdAt: string;
  updatedAt: string;
  source: "user_manual" | "checkout";
}

const DATA_DIR = path.join(process.cwd(), "data");
const FILE_PATH = path.join(DATA_DIR, "user_payment_methods.json");

function ensureFileExists() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(FILE_PATH)) {
    fs.writeFileSync(FILE_PATH, JSON.stringify({}, null, 2), "utf8");
  }
}

function readAll(): Record<string, UserSavedPaymentMethod> {
  try {
    ensureFileExists();
    const raw = fs.readFileSync(FILE_PATH, "utf8");
    return JSON.parse(raw || "{}");
  } catch (err) {
    console.warn("Failed reading user_payment_methods.json:", err);
    return {};
  }
}

function writeAll(data: Record<string, UserSavedPaymentMethod>) {
  try {
    ensureFileExists();
    fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("Failed writing user_payment_methods.json:", err);
  }
}

export function detectCardBrand(digits: string): "VISA" | "Mastercard" | "American Express" | "Discover" | "Card" {
  const clean = digits.replace(/\D/g, "");
  if (/^4/.test(clean)) return "VISA";
  if (/^(5[1-5]|2[2-7])/.test(clean)) return "Mastercard";
  if (/^3[47]/.test(clean)) return "American Express";
  if (/^(6011|65|64[4-9]|622)/.test(clean)) return "Discover";
  return "Card";
}

export async function getUserPaymentMethod(userId: string): Promise<UserSavedPaymentMethod | null> {
  if (!userId) return null;
  const all = readAll();
  return all[userId] || null;
}

export async function saveUserPaymentMethod(
  userId: string,
  payload: {
    type: UserPaymentMethodType;
    card?: {
      cardNumber?: string;
      brand?: string;
      last4?: string;
      expMonth: string;
      expYear: string;
      holderName: string;
      zip?: string;
    };
    paypal?: {
      email: string;
    };
    source?: "user_manual" | "checkout";
  }
): Promise<UserSavedPaymentMethod> {
  if (!userId) throw new Error("userId is required");
  const all = readAll();

  const now = new Date().toISOString();
  let brand: "VISA" | "Mastercard" | "American Express" | "Discover" | "Card" = "Card";
  let last4 = "4242";

  if (payload.type === "card") {
    if (!payload.card?.holderName?.trim()) {
      throw new Error("Cardholder name is required");
    }
    const rawDigits = (payload.card.cardNumber || "").replace(/\D/g, "");
    if (rawDigits.length >= 4) {
      last4 = rawDigits.slice(-4);
      brand = detectCardBrand(rawDigits);
    } else if (payload.card.last4) {
      last4 = payload.card.last4;
      brand = (payload.card.brand as any) || "Card";
    } else {
      throw new Error("Valid card number is required");
    }
  } else if (payload.type === "paypal") {
    if (!payload.paypal?.email || !payload.paypal.email.includes("@")) {
      throw new Error("Valid PayPal account email is required");
    }
  }

  const record: UserSavedPaymentMethod = {
    id: `pm_${userId}_${Date.now()}`,
    userId,
    type: payload.type,
    ...(payload.type === "card"
      ? {
          card: {
            brand,
            last4,
            expMonth: payload.card?.expMonth?.padStart(2, "0") || "12",
            expYear: payload.card?.expYear || "2028",
            holderName: payload.card?.holderName?.trim() || "Account Holder",
            zip: payload.card?.zip?.trim() || "",
          },
        }
      : {}),
    ...(payload.type === "paypal"
      ? {
          paypal: {
            email: payload.paypal?.email.trim().toLowerCase() || "",
          },
        }
      : {}),
    createdAt: all[userId]?.createdAt || now,
    updatedAt: now,
    source: payload.source || "user_manual",
  };

  all[userId] = record;
  writeAll(all);

  // Sync to latest active subscription in Supabase
  try {
    const paymentLabel =
      record.type === "paypal"
        ? `PayPal (${record.paypal?.email})`
        : `${record.card?.brand} •••• ${record.card?.last4}`;

    await serverSupabase
      .from("subscriptions")
      .update({
        payment_method: paymentLabel,
        updated_at: now,
      })
      .eq("owner_user_id", userId)
      .eq("status", "active");
  } catch (syncErr) {
    console.warn("Notice syncing payment method to subscription:", syncErr);
  }

  return record;
}

export async function removeUserPaymentMethod(userId: string): Promise<boolean> {
  if (!userId) return false;
  const all = readAll();
  if (all[userId]) {
    delete all[userId];
    writeAll(all);
  }

  // Clear payment method from active subscription
  try {
    await serverSupabase
      .from("subscriptions")
      .update({
        payment_method: null,
        updated_at: new Date().toISOString(),
      })
      .eq("owner_user_id", userId)
      .eq("status", "active");
  } catch (err) {
    console.warn("Notice clearing payment method from subscription:", err);
  }

  return true;
}

/**
 * When Admin manually assigns or updates a user plan:
 * Clear any existing user payment method so the user subscription page starts
 * with NO payment method attached until the user manually adds their own personal payment information!
 */
export async function clearUserPaymentMethodOnAdminManualUpdate(userId: string): Promise<void> {
  if (!userId) return;
  const all = readAll();
  if (all[userId]) {
    delete all[userId];
    writeAll(all);
  }

  // Explicitly clear payment_method from subscriptions in database
  try {
    await serverSupabase
      .from("subscriptions")
      .update({
        payment_method: null,
      })
      .eq("owner_user_id", userId)
      .eq("status", "active");
  } catch (err) {
    console.warn("Notice clearing payment method on admin manual assignment:", err);
  }
}
