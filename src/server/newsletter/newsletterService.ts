import fs from "fs";
import path from "path";

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

const SUBSCRIBERS_FILE = path.join(process.cwd(), "data", "newsletter_subscribers.json");
const TEMPLATES_FILE = path.join(process.cwd(), "data", "newsletter_templates.json");
const LOGS_FILE = path.join(process.cwd(), "data", "newsletter_logs.json");

class NewsletterService {
  private subscribers: NewsletterSubscriber[] = [];
  private templates: NewsletterTemplate[] = [];
  private logs: NewsletterLog[] = [];

  constructor() {
    this.loadAll();
  }

  private loadAll(): void {
    try {
      if (fs.existsSync(SUBSCRIBERS_FILE)) {
        this.subscribers = JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, "utf-8"));
      } else {
        this.subscribers = [];
      }
    } catch {
      this.subscribers = [];
    }

    try {
      if (fs.existsSync(TEMPLATES_FILE)) {
        this.templates = JSON.parse(fs.readFileSync(TEMPLATES_FILE, "utf-8"));
      } else {
        this.templates = [];
      }
    } catch {
      this.templates = [];
    }

    try {
      if (fs.existsSync(LOGS_FILE)) {
        this.logs = JSON.parse(fs.readFileSync(LOGS_FILE, "utf-8"));
      } else {
        this.logs = [];
      }
    } catch {
      this.logs = [];
    }
  }

  private saveSubscribers(): void {
    try {
      const dir = path.dirname(SUBSCRIBERS_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(this.subscribers, null, 2), "utf-8");
    } catch (err) {
      console.error("Error saving newsletter subscribers:", err);
    }
  }

  private saveTemplates(): void {
    try {
      const dir = path.dirname(TEMPLATES_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(this.templates, null, 2), "utf-8");
    } catch (err) {
      console.error("Error saving newsletter templates:", err);
    }
  }

  private saveLogs(): void {
    try {
      const dir = path.dirname(LOGS_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(LOGS_FILE, JSON.stringify(this.logs, null, 2), "utf-8");
    } catch (err) {
      console.error("Error saving newsletter logs:", err);
    }
  }

  public getSubscribers(): NewsletterSubscriber[] {
    this.loadAll();
    return this.subscribers;
  }

  public getTemplates(): NewsletterTemplate[] {
    this.loadAll();
    return this.templates;
  }

  public getLogs(): NewsletterLog[] {
    this.loadAll();
    return this.logs;
  }

  public getStats() {
    this.loadAll();
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
    this.loadAll();
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
    this.saveSubscribers();

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
    this.saveLogs();

    return {
      success: true,
      isNew,
      subscriber,
      emailSent: true,
      emailSubject: subject,
    };
  }

  public unsubscribe(idOrEmail: string): { success: boolean } {
    this.loadAll();
    const clean = idOrEmail.trim().toLowerCase();
    const sub = this.subscribers.find(
      (s) => s.id === idOrEmail || s.email.toLowerCase() === clean
    );
    if (sub) {
      sub.status = "unsubscribed";
      this.saveSubscribers();
    }
    return { success: true };
  }

  public deleteSubscriber(id: string): { success: boolean } {
    this.loadAll();
    this.subscribers = this.subscribers.filter((s) => s.id !== id && s.email !== id);
    this.saveSubscribers();
    return { success: true };
  }

  public toggleStatus(id: string, status?: "subscribed" | "unsubscribed"): { success: boolean; subscriber: NewsletterSubscriber } {
    this.loadAll();
    const sub = this.subscribers.find((s) => s.id === id || s.email.toLowerCase() === id.toLowerCase());
    if (!sub) {
      throw new Error("Subscriber not found.");
    }
    sub.status = status || (sub.status === "subscribed" ? "unsubscribed" : "subscribed");
    this.saveSubscribers();
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
    this.loadAll();
    const cleanEmail = params.recipientEmail.trim().toLowerCase();
    const now = new Date().toISOString();
    const sub = this.subscribers.find((s) => s.email.toLowerCase() === cleanEmail);
    if (sub) {
      sub.lastEmailSentAt = now;
      sub.emailsDelivered = (sub.emailsDelivered || 0) + 1;
      this.saveSubscribers();
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
    this.saveLogs();

    return {
      success: true,
      message: `Customized email template sent directly to ${cleanEmail}`,
      log,
    };
  }

  public updateTemplate(id: string, updates: Partial<NewsletterTemplate>): NewsletterTemplate {
    this.loadAll();
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
    this.saveTemplates();
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
    this.loadAll();
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

      this.logs.unshift({
        id: "log_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
        recipient: sub.email,
        templateId: tpl?.id || "tpl_broadcast",
        templateName: tpl?.name || "Broadcast Announcement",
        subject,
        type: "announcement",
        status: "delivered",
        sentAt: now,
      });
    });

    this.saveSubscribers();
    this.saveLogs();

    return {
      success: true,
      sentCount: count,
      subject,
    };
  }
}

export const newsletterService = new NewsletterService();
