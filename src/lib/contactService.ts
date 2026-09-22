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

/**
 * Submit contact form → Supabase only (no localStorage).
 * Table: public.contact_submissions
 */
export async function submitContactMessage(params: {
  name: string;
  email: string;
  message: string;
}) {
  const { name, email, message } = params;

  try {
    const { data: submission, error } = await supabase
      .from("contact_submissions")
      .insert({ name, email, message })
      .select()
      .maybeSingle();

    if (error || !submission) {
      console.error("contact_submissions insert failed:", error);
      return {
        success: false,
        syncedToCloud: false,
        record: null as ContactSubmissionRecord | null,
        error,
      };
    }

    // Optional: linked support ticket if user is signed in
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
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

    const record: ContactSubmissionRecord = {
      id: submission.id,
      name: submission.name,
      email: submission.email,
      message: submission.message,
      is_read: Boolean(submission.is_read),
      created_at: submission.created_at,
      status: "pending",
    };

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("geflow:contact-submission-added", { detail: record })
      );
    }

    return {
      success: true,
      syncedToCloud: true,
      record,
      error: null,
    };
  } catch (err) {
    console.error("submitContactMessage exception:", err);
    return {
      success: false,
      syncedToCloud: false,
      record: null as ContactSubmissionRecord | null,
      error: err,
    };
  }
}

/**
 * Admin: fetch all contact submissions from Supabase only.
 */
export async function fetchAllContactSubmissions(): Promise<ContactSubmissionRecord[]> {
  try {
    const { data, error } = await supabase
      .from("contact_submissions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("fetch contact_submissions failed:", error.message);
      return [];
    }

    return ((data as ContactSubmissionRecord[]) || []).map((row) => ({
      ...row,
      is_read: Boolean(row.is_read),
      status: row.is_read ? "reviewed" : "pending",
    }));
  } catch (err) {
    console.error("fetchAllContactSubmissions exception:", err);
    return [];
  }
}

/**
 * Admin: mark as read/unread in Supabase.
 * Name kept for existing callers (AdminSupport / AdminNotifications).
 */
export async function markLocalContactSubmissionRead(
  id: string,
  is_read: boolean = true
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("contact_submissions")
      .update({ is_read })
      .eq("id", id);

    if (error) {
      console.error("mark contact read failed:", error.message);
      return false;
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("geflow:contact-submission-updated", {
          detail: { id, is_read },
        })
      );
    }
    return true;
  } catch (err) {
    console.error("markLocalContactSubmissionRead exception:", err);
    return false;
  }
}

/**
 * Admin: delete submission in Supabase.
 * Name kept for existing callers.
 */
export async function deleteLocalContactSubmission(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("contact_submissions")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("delete contact_submissions failed:", error.message);
      return false;
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("geflow:contact-submission-deleted", { detail: { id } })
      );
    }
    return true;
  } catch (err) {
    console.error("deleteLocalContactSubmission exception:", err);
    return false;
  }
}

/** @deprecated No local store — always empty. Use fetchAllContactSubmissions. */
export const getLocalContactSubmissions = (): ContactSubmissionRecord[] => [];

/** @deprecated No local store. Use submitContactMessage. */
export const saveLocalContactSubmission = (_submission: {
  name: string;
  email: string;
  message: string;
  id?: string;
}): ContactSubmissionRecord | null => null;