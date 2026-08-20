export type LogSeverity = "info" | "low" | "medium" | "high" | "critical" | "warning";

export type LogStatus = "success" | "completed" | "failed" | "pending" | "blocked" | "resolved" | "investigating" | "retrying" | "offline" | "healthy";

export type LogCategory =
  | "overview"
  | "ai"
  | "billing"
  | "payments"
  | "auth"
  | "security"
  | "errors"
  | "system"
  | "user_activity"
  | "business_activity";

export interface LogItem {
  id: string;
  timestamp: string; // ISO string
  module: string; // e.g. "AI Assistant", "Payments", "Billing", "Auth", "Security", "Products", "Sales", "Database"
  event: string; // e.g. "Product Created", "Payment Failed", "User Login", "AI Forecast Generated", "Suspicious Login", "Rate Limit Exceeded"
  category: LogCategory;
  severity: LogSeverity;
  status: LogStatus;
  user?: {
    id?: string;
    name: string;
    email?: string;
    avatar?: string;
  };
  business?: {
    id?: string;
    name: string;
    plan?: string;
    status?: string;
  };
  ip?: string;
  country?: string;
  countryCode?: string;
  browser?: string;
  os?: string;
  device?: "desktop" | "mobile" | "tablet";
  description?: string;
  details?: Record<string, any>;
  
  // Module-specific enriched fields
  aiData?: {
    feature: string;
    model: string;
    provider?: string;
    latencyMs: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCost: number;
    promptText?: string;
    responseText?: string;
    temperature?: number;
    requestId?: string;
  };

  billingData?: {
    plan?: string;
    invoiceNumber?: string;
    amount?: number;
    currency?: string;
    billingCycle?: string;
    renewalDate?: string;
    couponCode?: string;
  };

  paymentData?: {
    invoiceNumber?: string;
    gateway: "stripe" | "paypal" | "lemonsqueezy" | "paddle" | "bank" | "wallet";
    method: string;
    amount: number;
    currency: string;
    transactionId: string;
    fee: number;
    failureReason?: string;
  };

  authData?: {
    action: "login" | "logout" | "signup" | "password_reset" | "email_verify" | "magic_link" | "otp";
    method: "password" | "magic_link" | "otp" | "google" | "apple" | "session";
    sessionId?: string;
    sessionDuration?: string;
    expiresAt?: string;
  };

  securityData?: {
    threatType: string;
    riskScore: number; // 0 - 100
    detectionMethod: string;
    isBlocked?: boolean;
    isAccountLocked?: boolean;
    recommendedAction?: string;
  };

  errorData?: {
    errorType: string;
    errorCode?: string | number;
    stackTrace?: string;
    sourceFile?: string;
    line?: number;
    isRetryable?: boolean;
    isResolved?: boolean;
    resolutionNote?: string;
  };

  systemData?: {
    serviceName: string;
    latencyMs: number;
    version: string;
    cpuPercent?: number;
    memoryPercent?: number;
    uptime?: string;
  };

  userActivityData?: {
    actionType: "create" | "update" | "view" | "export" | "delete";
    affectedRecordName?: string;
    recordType?: string;
    duration?: string;
    sessionId?: string;
  };

  businessActivityData?: {
    actionName: string;
    moduleName: string;
    performedBy: string;
    activityVolumeToday?: number;
    planStatus?: string;
  };

  timeline?: {
    time: string;
    title: string;
    desc?: string;
  }[];

  relatedRecord?: {
    type: "product" | "sale" | "purchase" | "invoice" | "user" | "business" | "report";
    id: string;
    title: string;
    meta?: string;
  };
}

export interface LogFilterState {
  search: string;
  severity: string;
  category: string;
  business: string;
  user: string;
  dateRange: string;
  status: string;
  quickFilter: string | null;
}
