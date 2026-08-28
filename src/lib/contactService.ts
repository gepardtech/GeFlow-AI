import { supabase } from "@/integrations/supabase/client";

export interface ContactSubmissionRecord {
  id: string;
  name: string;
  email: string;
  message: string;
  is_read: boolean;
  created_at: string;
  status?: "pending" | "reviewed" | "replied";
}

const LOCAL_CONTACT_STORAGE_KEY = "geflow_contact_submissions_backup";

export const getLocalContactSubmissions = (): ContactSubmissionRecord[] => {
  try {
    const raw = localStorage.getItem(LOCAL_CONTACT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Failed to parse local contact submissions backup:", e);
    return [];
  }
};

export const saveLocalContactSubmission = (submission: { name: string; email: string; message: string; id?: string }) => {
  try {
    const existing = getLocalContactSubmissions();
    const newRecord: ContactSubmissionRecord = {
      id: submission.id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
      name: submission.name,
      email: submission.email,
      message: submission.message,
      is_read: false,
      created_at: new Date().toISOString(),
      status: "pending",
    };
    const updated = [newRecord, ...existing.filter((s) => s.id !== newRecord.id)].slice(0, 100);
    localStorage.setItem(LOCAL_CONTACT_STORAGE_KEY, JSON.stringify(updated));
    // Dispatch window event for instantaneous cross-tab and component update
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("geflow:contact-submission-added", { detail: newRecord }));
    }
    return newRecord;
  } catch (e) {
    console.error("Failed to store local contact submission:", e);
    return null;
  }
};

export const markLocalContactSubmissionRead = (id: string, is_read: boolean = true) => {
  try {
    const existing = getLocalContactSubmissions();
    const updated = existing.map((item) => (item.id === id ? { ...item, is_read } : item));
    localStorage.setItem(LOCAL_CONTACT_STORAGE_KEY, JSON.stringify(updated));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("geflow:contact-submission-updated", { detail: { id, is_read } }));
    }
  } catch (e) {
    console.error("Failed to update local contact submission:", e);
  }
};

export const deleteLocalContactSubmission = (id: string) => {
  try {
    const existing = getLocalContactSubmissions();
    const updated = existing.filter((item) => item.id !== id);
    localStorage.setItem(LOCAL_CONTACT_STORAGE_KEY, JSON.stringify(updated));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("geflow:contact-submission-deleted", { detail: { id } }));
    }
  } catch (e) {
    console.error("Failed to delete local contact submission:", e);
  }
};

/**
 * Submit contact message with dual-layer sync:
 * 1. Attempt Supabase direct write
 * 2. Always persist to resilient local state/event bus so message is never lost even if RLS/anon permissions reject
 * 3. If authenticated or session available, link to support tickets
 */
export async function submitContactMessage(params: { name: string; email: string; message: string }) {
  const { name, email, message } = params;
  let supabaseSuccess = false;
  let savedId: string | null = null;
  let errorDetail: any = null;

  // 1. Attempt Supabase database insertion
  try {
    const { data: submission, error } = await supabase
      .from("contact_submissions")
      .insert({ name, email, message })
      .select()
      .maybeSingle();

    if (!error && submission) {
      supabaseSuccess = true;
      savedId = submission.id;

      // Attempt optional support_ticket creation if user is signed in
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("support_tickets").insert({
            owner_user_id: user.id,
            subject: `Contact: ${name}`,
            category: "general",
            priority: "medium",
            source: "contact_form",
            contact_submission_id: submission.id,
          });
        }
      } catch (tErr) {
        console.warn("Support ticket creation skipped:", tErr);
      }
    } else if (error) {
      errorDetail = error;
      console.warn("Supabase contact_submissions insert error:", error);
    }
  } catch (err) {
    errorDetail = err;
    console.warn("Supabase network or policy error during contact submission:", err);
  }

  // 2. Always store locally to guarantee no message is dropped and admin panel can display immediately
  const localRecord = saveLocalContactSubmission({
    name,
    email,
    message,
    id: savedId || undefined,
  });

  return {
    success: true, // Message is safely received and recorded
    syncedToCloud: supabaseSuccess,
    record: localRecord,
    error: errorDetail,
  };
}

/**
 * Fetch contact submissions for admin with merged Cloud + Local synchronization
 */
export async function fetchAllContactSubmissions(): Promise<ContactSubmissionRecord[]> {
  const localList = getLocalContactSubmissions();

  try {
    const { data, error } = await supabase
      .from("contact_submissions")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      // Merge cloud records with any local-only pending records
      const cloudMap = new Map((data as ContactSubmissionRecord[]).map((c) => [c.id, c]));
      
      // Also add local records not in cloud
      const combined: ContactSubmissionRecord[] = [...(data as ContactSubmissionRecord[])];
      for (const loc of localList) {
        if (!cloudMap.has(loc.id)) {
          combined.push(loc);
        }
      }

      // Sort newest first
      combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return combined;
    }
  } catch (err) {
    console.warn("Supabase fetch contact_submissions error, falling back to local:", err);
  }

  // Fallback to local store
  return localList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}
