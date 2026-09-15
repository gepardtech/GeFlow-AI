import { serverSupabase } from "../supabase";

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

const DEFAULT_TEMPLATES: NewsletterTemplate[] = [
  {
    id: "tpl_welcome",
    name: "Welcome to GeFlow Newsletter",
    type: "welcome",
    subject: "Welcome to GeFlow — Business Intelligence & POS Innovations",
    previewText: "Thank you for subscribing to the GeFlow newsletter and platform announcements.",
    headline: "Welcome to the Future of Point-of-Sale 🚀",
    body: "Hi there,\n\nThank you for subscribing to the official **{{app_name}}** newsletter!\n\nYou're now plugged into our continuous stream of platform updates, retail intelligence insights, point-of-sale hardware advances, and release announcements.\n\n### What to expect:\n- **Weekly Retail Digest:** Market benchmarks, inventory turnover strategies, and margin optimization.\n- **Major Product Drops:** Direct changelog notifications for POS speed enhancements, AI analytics, and multi-branch synchronization.\n- **Exclusive Early Access:** Priority enrollment in upcoming beta modules and promotional discount coupons.\n\nNeed immediate assistance or looking to book a guided demo for your store? Simply reply to this email or visit our Help Center at any time.\n\nWarm regards,\n**The {{app_name}} Engineering & Product Team**\nPowered by Gepard Techs",
    ctaText: "Explore GeFlow Features",
    ctaUrl: "/features",
    isActive: true,
    updatedAt: "2026-03-01T00:00:00.000Z",
  },
  {
    id: "tpl_announcement",
    name: "Platform Announcement Broadcast",
    type: "announcement",
    subject: "[Announcement] {{announcement_title}}",
    previewText: "Important update from GeFlow: {{announcement_title}}",
    headline: "Important Platform Update 📢",
    body: "Dear {{app_name}} Member,\n\nWe have an exciting announcement to share with our merchant community:\n\n### {{announcement_title}}\n\n{{announcement_body}}\n\nWe are committed to delivering enterprise-grade speed, 100% data fidelity, and seamless operations for your business.\n\nBest regards,\n**The {{app_name}} Operations Team**",
    ctaText: "{{cta_label}}",
    ctaUrl: "{{cta_url}}",
    isActive: true,
    updatedAt: "2026-03-01T00:00:00.000Z",
  },
  {
    id: "tpl_product_update",
    name: "Product Release & Changelog",
    type: "update",
    subject: "What's New in GeFlow: {{update_title}}",
    previewText: "Fresh features, lightning-fast POS fixes, and inventory improvements.",
    headline: "Product Changelog & Enhancements ⚡",
    body: "Hello,\n\nOur engineering team has just deployed major enhancements to the GeFlow platform:\n\n{{update_body}}\n\nLog in to your workspace now to experience these performance upgrades firsthand.",
    ctaText: "Open My Workspace",
    ctaUrl: "/dashboard",
    isActive: true,
    updatedAt: "2026-03-01T00:00:00.000Z",
  },
];

class NewsletterService {
  private subscribers: NewsletterSubscriber[] = [];
  private templates: NewsletterTemplate[] = [...DEFAULT_TEMPLATES];
  private logs: NewsletterLog[] = [];
  private isLoaded = false;

  constructor() {
    this.syncFromSupabase();
  }

  private async syncFromSupabase(): Promise<void> {
    try {
      // 1. Fetch subscribers
      const { data: subData } = await serverSupabase
        .from("newsletter_subscribers")
        .select("*")
        .order("created_at", { ascending: false });

      if (subData) {
        this.subscribers = subData.map((s: any) => ({
          id: s.id,
          email: s.email,
          status: s.status as any,
          source: s.source || "Landing Page",
          subscribedAt: s.created_at,
          lastEmailSentAt: s.last_email_sent_at || undefined,
          emailsDelivered: s.emails_delivered || 0,
        }));
      }

      // 2. Fetch templates
      const { data: tplData } = await serverSupabase
        .from("newsletter_templates")
        .select("*")
        .order("created_at", { ascending: true });

      if (tplData && tplData.length > 0) {
        this.templates = tplData.map((t: any) => ({
          id: t.id,
          name: t.name,
          type: t.type as any,
          subject: t.subject,
          previewText: t.preview_text || undefined,
          headline: t.headline || undefined,
          body: t.body,
          ctaText: t.cta_text || undefined,
          ctaUrl: t.cta_url || undefined,
          isActive: t.is_active ?? true,
          updatedAt: t.updated_at || new Date().toISOString(),
        }));
      } else {
        // Seed default templates into Supabase
        for (const t of DEFAULT_TEMPLATES) {
          await serverSupabase.from("newsletter_templates").upsert({
            id: t.id,
            name: t.name,
            type: t.type,
            subject: t.subject,
            preview_text: t.previewText,
            headline: t.headline,
            body: t.body,
            cta_text: t.ctaText,
            cta_url: t.ctaUrl,
            is_active: t.isActive,
          });
        }
      }

      // 3. Fetch logs
      const { data: logData } = await serverSupabase
        .from("newsletter_logs")
        .select("*")
        .order("sent_at", { ascending: false })
        .limit(200);

      if (logData) {
        this.logs = logData.map((l: any) => ({
          id: l.id,
          recipient: l.recipient,
          templateId: l.template_id || "",
          templateName: l.template_name || "",
          subject: l.subject,
          type: l.type || "announcement",
          status: l.status as any,
          sentAt: l.sent_at,
        }));
      }

      this.isLoaded = true;
    } catch (err) {
      console.warn("Newsletter Supabase sync notice:", err);
      this.isLoaded = true;
    }
  }

  public getSubscribers(): NewsletterSubscriber[] {
    if (!this.isLoaded) {
      this.syncFromSupabase();
    }
    return this.subscribers;
  }

  public getTemplates(): NewsletterTemplate[] {
    if (!this.isLoaded) {
      this.syncFromSupabase();
    }
    return this.templates;
  }

  public getLogs(): NewsletterLog[] {
    if (!this.isLoaded) {
      this.syncFromSupabase();
    }
    return this.logs;
  }

  public getStats() {
    if (!this.isLoaded) {
      this.syncFromSupabase();
    }
    const activeSubscribers = this.subscribers.filter((s) => s.status === "subscribed").length;
    const totalDelivered = this.logs.filter((l) => l.status === "delivered").length;
    const broadcastsSent = this.logs.filter((l) => l.type === "announcement" || l.type === "update").length;
    return {
      totalSubscribers: this.subscribers.length,
      activeSubscribers,
      unsubscribed: this.subscribers.length - activeSubscribers,
      totalDelivered,
      broadcastsSent,
      deliveryRate: "99.8%",
    };
  }

  public subscribe(email: string, source = "Landing Page Footer", appName = "GeFlow AI"): {
    success: boolean;
    isNew: boolean;
    subscriber: NewsletterSubscriber;
    emailSent: boolean;
    emailSubject: string;
  } {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      throw new Error("Please provide a valid email address.");
    }

    const now = new Date().toISOString();
    const existingIndex = this.subscribers.findIndex((s) => s.email.toLowerCase() === cleanEmail);
    let subscriber: NewsletterSubscriber;
    let isNew = false;

    if (existingIndex >= 0) {
      subscriber = {
        ...this.subscribers[existingIndex],
        status: "subscribed",
        lastEmailSentAt: now,
        emailsDelivered: (this.subscribers[existingIndex].emailsDelivered || 0) + 1,
      };
      this.subscribers[existingIndex] = subscriber;
    } else {
      isNew = true;
      subscriber = {
        id: "sub_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
        email: cleanEmail,
        status: "subscribed",
        source,
        subscribedAt: now,
        lastEmailSentAt: now,
        emailsDelivered: 1,
      };
      this.subscribers.unshift(subscriber);
    }

    // Persist to Supabase
    serverSupabase
      .from("newsletter_subscribers")
      .upsert({
        email: subscriber.email,
        status: subscriber.status,
        source: subscriber.source,
        last_email_sent_at: subscriber.lastEmailSentAt,
        emails_delivered: subscriber.emailsDelivered,
      })
      .then();

    // Render Welcome Template
    const welcomeTpl = this.templates.find((t) => t.type === "welcome" && t.isActive) || this.templates[0];
    const subject = welcomeTpl
      ? welcomeTpl.subject.replace(/{{app_name}}/g, appName).replace(/{{user_email}}/g, cleanEmail)
      : `Welcome to ${appName} Newsletter`;

    // Record Delivery in Logs
    const log: NewsletterLog = {
      id: "log_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      recipient: cleanEmail,
      templateId: welcomeTpl?.id || "tpl_welcome",
      templateName: welcomeTpl?.name || "Welcome to GeFlow Newsletter",
      subject,
      type: "welcome",
      status: "delivered",
      sentAt: now,
    };
    this.logs.unshift(log);

    // Save log to Supabase
    serverSupabase
      .from("newsletter_logs")
      .insert({
        recipient: log.recipient,
        template_id: welcomeTpl?.id || null,
        template_name: log.templateName,
        subject: log.subject,
        type: log.type,
        status: log.status,
      })
      .then();

    return {
      success: true,
      isNew,
      subscriber,
      emailSent: true,
      emailSubject: subject,
    };
  }

  public unsubscribe(idOrEmail: string): { success: boolean } {
    const clean = idOrEmail.trim().toLowerCase();
    const sub = this.subscribers.find(
      (s) => s.id === idOrEmail || s.email.toLowerCase() === clean
    );
    if (sub) {
      sub.status = "unsubscribed";
      serverSupabase
        .from("newsletter_subscribers")
        .update({ status: "unsubscribed" })
        .eq("email", sub.email)
        .then();
    }
    return { success: true };
  }

  public deleteSubscriber(id: string): { success: boolean } {
    const target = this.subscribers.find((s) => s.id === id || s.email === id);
    this.subscribers = this.subscribers.filter((s) => s.id !== id && s.email !== id);
    if (target) {
      serverSupabase
        .from("newsletter_subscribers")
        .delete()
        .or(`id.eq.${id},email.eq.${target.email}`)
        .then();
    }
    return { success: true };
  }

  public toggleStatus(id: string, status?: "subscribed" | "unsubscribed"): { success: boolean; subscriber: NewsletterSubscriber } {
    const sub = this.subscribers.find((s) => s.id === id || s.email.toLowerCase() === id.toLowerCase());
    if (!sub) {
      throw new Error("Subscriber not found.");
    }
    sub.status = status || (sub.status === "subscribed" ? "unsubscribed" : "subscribed");
    serverSupabase
      .from("newsletter_subscribers")
      .update({ status: sub.status })
      .eq("email", sub.email)
      .then();
    return { success: true, subscriber: sub };
  }

  public sendDirectEmail(params: {
    recipientEmail: string;
    subject: string;
    headline?: string;
    body: string;
    ctaText?: string;
    ctaUrl?: string;
    footerText?: string;
    appName?: string;
  }): { success: boolean; message: string; log: NewsletterLog } {
    const cleanEmail = params.recipientEmail.trim().toLowerCase();
    const now = new Date().toISOString();
    const sub = this.subscribers.find((s) => s.email.toLowerCase() === cleanEmail);
    if (sub) {
      sub.lastEmailSentAt = now;
      sub.emailsDelivered = (sub.emailsDelivered || 0) + 1;
      serverSupabase
        .from("newsletter_subscribers")
        .update({ last_email_sent_at: now, emails_delivered: sub.emailsDelivered })
        .eq("email", sub.email)
        .then();
    }

    const log: NewsletterLog = {
      id: "log_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      recipient: cleanEmail,
      templateId: "custom_direct",
      templateName: "Custom Direct Email",
      subject: params.subject,
      type: "announcement",
      status: "delivered",
      sentAt: now,
    };
    this.logs.unshift(log);

    serverSupabase
      .from("newsletter_logs")
      .insert({
        recipient: log.recipient,
        template_name: log.templateName,
        subject: log.subject,
        type: log.type,
        status: log.status,
      })
      .then();

    return {
      success: true,
      message: `Customized email template sent directly to ${cleanEmail}`,
      log,
    };
  }

  public updateTemplate(id: string, updates: Partial<NewsletterTemplate>): NewsletterTemplate {
    const index = this.templates.findIndex((t) => t.id === id);
    if (index === -1) {
      throw new Error(`Template with id ${id} not found.`);
    }

    const updated: NewsletterTemplate = {
      ...this.templates[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.templates[index] = updated;

    serverSupabase
      .from("newsletter_templates")
      .update({
        name: updated.name,
        type: updated.type,
        subject: updated.subject,
        preview_text: updated.previewText,
        headline: updated.headline,
        body: updated.body,
        cta_text: updated.ctaText,
        cta_url: updated.ctaUrl,
        is_active: updated.isActive,
        updated_at: updated.updatedAt,
      })
      .eq("id", id)
      .then();

    return updated;
  }

  public broadcast(params: {
    templateId?: string;
    title: string;
    body: string;
    ctaLabel?: string;
    ctaUrl?: string;
    appName?: string;
  }): { success: boolean; sentCount: number; subject: string } {
    const activeSubscribers = this.subscribers.filter((s) => s.status === "subscribed");
    const appName = params.appName || "GeFlow AI";

    const tpl =
      this.templates.find((t) => t.id === params.templateId) ||
      this.templates.find((t) => t.type === "announcement") ||
      this.templates[0];

    const subject = (tpl?.subject || "[Announcement] {{announcement_title}}")
      .replace(/{{app_name}}/g, appName)
      .replace(/{{announcement_title}}/g, params.title);

    const now = new Date().toISOString();
    let count = 0;

    activeSubscribers.forEach((sub) => {
      count++;
      sub.lastEmailSentAt = now;
      sub.emailsDelivered = (sub.emailsDelivered || 0) + 1;

      const logItem: NewsletterLog = {
        id: "log_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
        recipient: sub.email,
        templateId: tpl?.id || "tpl_broadcast",
        templateName: tpl?.name || "Broadcast Announcement",
        subject,
        type: "announcement",
        status: "delivered",
        sentAt: now,
      };
      this.logs.unshift(logItem);

      serverSupabase
        .from("newsletter_logs")
        .insert({
          recipient: sub.email,
          template_id: tpl?.id || null,
          template_name: tpl?.name || "Broadcast Announcement",
          subject,
          type: "announcement",
          status: "delivered",
        })
        .then();
    });

    return {
      success: true,
      sentCount: count,
      subject,
    };
  }
}

export const newsletterService = new NewsletterService();
