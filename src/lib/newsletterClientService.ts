export interface NewsletterSubscriber {
  id: string;
  email: string;
  status: "subscribed" | "unsubscribed";
  source: string;
  subscribedAt: string;
  lastEmailSentAt?: string;
  emailsDelivered: number;
}

export interface NewsletterTemplate {
  id: string;
  name: string;
  type: "welcome" | "announcement" | "update" | "custom";
  subject: string;
  previewText?: string;
  headline?: string;
  body: string;
  ctaText?: string;
  ctaUrl?: string;
  isActive: boolean;
  updatedAt: string;
}

export interface NewsletterLog {
  id: string;
  recipient: string;
  templateId: string;
  templateName: string;
  subject: string;
  type: string;
  status: "delivered" | "bounced" | "failed";
  sentAt: string;
}

export interface NewsletterStats {
  totalSubscribers: number;
  activeSubscribers: number;
  unsubscribed: number;
  totalDelivered: number;
  broadcastsSent: number;
  deliveryRate: string;
}

export async function subscribeToNewsletter(email: string, source = "Landing Page Footer", appName = "GeFlow AI") {
  const res = await fetch("/api/newsletter/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, source, appName }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to subscribe to newsletter.");
  }
  return data;
}

export async function getNewsletterSubscribers(): Promise<NewsletterSubscriber[]> {
  const res = await fetch("/api/newsletter/subscribers");
  if (!res.ok) throw new Error("Failed to load subscribers.");
  const data = await res.json();
  return data.subscribers || [];
}

export async function deleteNewsletterSubscriber(id: string): Promise<boolean> {
  const res = await fetch(`/api/newsletter/subscribers/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to remove subscriber.");
  const data = await res.json();
  return !!data.success;
}

export async function getNewsletterTemplates(): Promise<NewsletterTemplate[]> {
  const res = await fetch("/api/newsletter/templates");
  if (!res.ok) throw new Error("Failed to load templates.");
  const data = await res.json();
  return data.templates || [];
}

export async function updateNewsletterTemplate(id: string, updates: Partial<NewsletterTemplate>): Promise<NewsletterTemplate> {
  const res = await fetch(`/api/newsletter/templates/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error("Failed to update template.");
  const data = await res.json();
  return data.template;
}

export async function broadcastNewsletter(params: {
  templateId?: string;
  title: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  appName?: string;
}): Promise<{ success: boolean; sentCount: number; subject: string }> {
  const res = await fetch("/api/newsletter/broadcast", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error("Failed to broadcast newsletter.");
  const data = await res.json();
  return data;
}

export async function getNewsletterLogs(): Promise<NewsletterLog[]> {
  const res = await fetch("/api/newsletter/logs");
  if (!res.ok) throw new Error("Failed to load logs.");
  const data = await res.json();
  return data.logs || [];
}

export async function getNewsletterStats(): Promise<NewsletterStats> {
  const res = await fetch("/api/newsletter/stats");
  if (!res.ok) throw new Error("Failed to load stats.");
  const data = await res.json();
  return data.stats;
}
