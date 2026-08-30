import React, { useEffect, useRef, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useActiveBusiness } from "@/hooks/useActiveBusiness";
import { usePlan } from "@/hooks/usePlan";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  Send,
  Loader2,
  BarChart3,
  Settings2,
  BookOpen,
  Lightbulb,
  Bot,
  User as UserIcon,
  Building2,
  Trash2,
  Coins,
  Percent,
  Lock,
  Crown,
} from "lucide-react";
import {
  AIMode,
  AIChatMessage,
  fetchLiveBusinessAnalytics,
  generateLocalBusinessAnalysis,
  loadStoredAIConversation,
  saveAIConversation,
  detectQueryLanguage,
  BusinessAnalyticsContext,
  isModeAllowedForPlan,
  getRequiredPlanForMode,
} from "@/lib/aiAssistantService";

const MODES: { id: AIMode; label: string; icon: typeof BarChart3; desc: string; color: string }[] = [
  { id: "analyst", label: "Analyst", icon: BarChart3, desc: "Sales, profit & inventory analysis", color: "text-sky-500 bg-sky-500/10" },
  { id: "operator", label: "Operator", icon: Settings2, desc: "Reports, orders & drafts", color: "text-violet-500 bg-violet-500/10" },
  { id: "knowledge", label: "Knowledge", icon: BookOpen, desc: "How to use GeFlow", color: "text-emerald-500 bg-emerald-500/10" },
  { id: "advisor", label: "Advisor", icon: Lightbulb, desc: "Strategy & recommendations", color: "text-amber-500 bg-amber-500/10" },
];

const STARTERS: Record<AIMode, string[]> = {
  analyst: [
    "What is my net profit and sales performance this month?",
    "Which products are low in stock or out of stock?",
    "Mera profit aur sales kaisa chal raha hai?",
    "What is my inventory total cost and retail valuation?",
  ],
  operator: [
    "Draft a purchase order for my low-stock items",
    "Summarize this week's sales transactions",
    "Stock check karke reorder list banao",
  ],
  knowledge: [
    "How does the POS terminal calculate tax and discounts?",
    "How do I update business currency and tax rates in Settings?",
    "How do low stock threshold alerts work?",
  ],
  advisor: [
    "Give me 3 strategic ways to improve profit margins",
    "Which high-demand items should I purchase in bulk?",
    "What inventory risks or expiry dates should I watch?",
  ],
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const AIAssistant: React.FC<Props> = ({ open, onOpenChange }) => {
  const { activeId, businesses } = useActiveBusiness();
  const { plan, planId } = usePlan();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [mode, setMode] = useState<AIMode>("analyst");
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [liveAnalytics, setLiveAnalytics] = useState<BusinessAnalyticsContext | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeBiz = businesses.find((b) => b.id === activeId);

  // Auto-reset mode if currently selected mode is not allowed for the plan
  useEffect(() => {
    if (!isModeAllowedForPlan(mode, planId)) {
      setMode("analyst");
    }
  }, [planId, mode]);

  // Fetch current user and load conversation history
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUserId(user.id);
        const stored = loadStoredAIConversation(activeId, user.id);
        if (stored && stored.length > 0) {
          setMessages(stored);
        }
      }
    });
  }, [activeId]);

  // Refresh live analytics data when dialog opens or active business changes
  useEffect(() => {
    if (open && activeId) {
      fetchLiveBusinessAnalytics(activeId).then((ctx) => {
        setLiveAnalytics(ctx);
      });
    }
  }, [open, activeId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(timer);
    }
  }, [open, mode]);

  const handleClearHistory = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMessages([]);
    saveAIConversation([], activeId, currentUserId);
  };

  const handleSelectMode = (selectedMode: AIMode) => {
    const isAllowed = isModeAllowedForPlan(selectedMode, planId);
    if (!isAllowed) {
      const { label } = getRequiredPlanForMode(selectedMode);
      toast({
        title: `${selectedMode.toUpperCase()} Model Locked`,
        description: `This AI model is available on the ${label} plan. Upgrade your subscription to unlock it.`,
      });
      return;
    }
    setMode(selectedMode);
  };

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || loading) return;

      const userMsg: AIChatMessage = {
        role: "user",
        content,
        timestamp: new Date().toISOString(),
      };

      const nextMessages = [...messages, userMsg];
      setMessages(nextMessages);
      setInput("");
      setLoading(true);

      try {
        // Step 1: Ensure fresh live analytics context
        let currentCtx = liveAnalytics;
        if (!currentCtx && activeId) {
          currentCtx = await fetchLiveBusinessAnalytics(activeId);
          setLiveAnalytics(currentCtx);
        }

        // Step 2: Try Remote Edge Function (GeCore AI Intelligence Pipeline)
        let replyText = "";
        let succeededRemotely = false;

        try {
          const { data, error } = await supabase.functions.invoke("geflow-ai-assistant", {
            body: {
              messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
              mode,
              businessId: activeId ?? "",
              planId,
            },
          });

          if (!error && data?.reply && typeof data.reply === "string") {
            replyText = data.reply.trim();
            succeededRemotely = true;
          } else if (data?.error) {
            console.debug("Edge function returned error payload:", data.error);
          }
        } catch (edgeErr) {
          console.debug("Edge function invocation bypassed/failed, engaging smart local analyzer:", edgeErr);
        }

        // Step 3: If Edge Function did not return a response, execute high-precision plan-aware local analysis
        if (!succeededRemotely || !replyText) {
          replyText = generateLocalBusinessAnalysis(content, mode, currentCtx, planId);
        }

        const assistantMsg: AIChatMessage = {
          role: "assistant",
          content: replyText,
          timestamp: new Date().toISOString(),
          meta: {
            language: detectQueryLanguage(content),
            model: `GeCore AI (${planId.toUpperCase()})`,
          },
        };

        const finalMessages = [...nextMessages, assistantMsg];
        setMessages(finalMessages);
        await saveAIConversation(finalMessages, activeId, currentUserId);
      } catch (err: any) {
        console.error("AI Assistant critical failure:", err);
        const fallbackMsg: AIChatMessage = {
          role: "assistant",
          content: "⚠️ I encountered a temporary connection issue. Please check that an active business is selected and try again.",
          timestamp: new Date().toISOString(),
        };
        const finalMessages = [...nextMessages, fallbackMsg];
        setMessages(finalMessages);
        await saveAIConversation(finalMessages, activeId, currentUserId);
      } finally {
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    },
    [loading, messages, liveAnalytics, activeId, mode, currentUserId, planId]
  );

  const activeMode = MODES.find((m) => m.id === mode) || MODES[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl p-0 overflow-hidden h-[85vh] flex flex-col gap-0 border-border bg-card shadow-2xl"
        onPointerDownOutside={(e) => {
          e.preventDefault();
        }}
        onInteractOutside={(e) => {
          e.preventDefault();
        }}
      >
        <DialogTitle className="sr-only">GeFlow AI Assistant</DialogTitle>
        <DialogDescription className="sr-only">
          Real-time business intelligence, profit calculations, inventory analysis, and operations assistant.
        </DialogDescription>

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-sky-400 flex items-center justify-center text-white flex-shrink-0 shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-extrabold text-sm sm:text-base leading-tight text-foreground">AI Store Assistant</p>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Basic AI • v1.0
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                  <Crown className="w-3 h-3 text-primary" />
                  {plan?.label || "Free"} Plan
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground flex items-center gap-2 truncate mt-0.5">
                <span className="flex items-center gap-1 font-medium truncate">
                  <Building2 className="h-3 w-3 text-sky-500 flex-shrink-0" />
                  {activeBiz?.business_name ?? "Workspace Business"}
                </span>
                {liveAnalytics?.business && (
                  <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] text-muted-foreground/80">
                    <Coins className="h-2.5 w-2.5" /> {liveAnalytics.business.currency}
                    <Percent className="h-2.5 w-2.5 ml-1" /> {liveAnalytics.business.taxRate}% Tax
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleClearHistory}
                className="h-8 px-2.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1.5"
                title="Clear conversation history"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Clear Chat</span>
              </button>
            )}
          </div>
        </div>

        {/* Mode selector */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 border-b border-border bg-muted/20">
          {MODES.map((m) => {
            const Icon = m.icon;
            const on = m.id === mode;
            const isAllowed = isModeAllowedForPlan(m.id, planId);
            const { label: reqLabel } = getRequiredPlanForMode(m.id);

            return (
              <button
                key={m.id}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSelectMode(m.id);
                }}
                className={`relative flex flex-col items-start gap-1 rounded-xl p-2.5 border text-left transition-all ${
                  on
                    ? "border-primary bg-primary/10 shadow-sm"
                    : isAllowed
                    ? "border-border/60 bg-card hover:bg-muted/50"
                    : "border-border/40 bg-muted/40 opacity-70 hover:opacity-90"
                }`}
              >
                {!isAllowed && (
                  <span className="absolute top-2 right-2 flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-muted-foreground/10 text-muted-foreground border border-border">
                    <Lock className="w-2.5 h-2.5" />
                    {reqLabel}
                  </span>
                )}
                <span className={`h-7 w-7 rounded-lg flex items-center justify-center ${m.color}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-xs font-bold text-foreground flex items-center gap-1">
                  {m.label}
                </span>
                <span className="text-[10px] text-muted-foreground leading-tight hidden sm:block truncate w-full">
                  {m.desc}
                </span>
              </button>
            );
          })}
        </div>

        {/* Messages list */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-background">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4 py-8">
              <div className={`h-14 w-14 rounded-2xl flex items-center justify-center mb-4 ${activeMode.color}`}>
                <activeMode.icon className="h-7 w-7" />
              </div>
              <p className="font-bold text-lg text-foreground">{activeMode.label} Mode Active</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                {activeMode.desc}. Ask anything in English, Roman Urdu, Urdu, or Arabic. I read live profit, sales, and stock records.
              </p>
              <div className="mt-6 flex flex-col gap-2 w-full max-w-lg">
                {STARTERS[mode].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      send(s);
                    }}
                    className="text-left text-xs sm:text-sm px-4 py-3 rounded-xl border border-border bg-card hover:border-primary hover:bg-primary/5 transition-all text-foreground font-medium shadow-xs"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div
                key={m.id || i}
                className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <div
                  className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-gradient-to-br from-violet-500 to-sky-400 text-white"
                  }`}
                >
                  {m.role === "user" ? <UserIcon className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>
                <div
                  className={`rounded-2xl px-4 py-3 max-w-[85%] text-sm shadow-xs ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground font-medium rounded-tr-none"
                      : "bg-card border border-border text-foreground rounded-tl-none"
                  }`}
                >
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-headings:mt-3 prose-headings:mb-1 prose-headings:font-bold prose-ul:my-1.5 prose-li:my-0.5 text-foreground">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                  )}
                </div>
              </div>
            ))
          )}

          {loading && (
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-violet-500 to-sky-400 text-white flex-shrink-0">
                <Bot className="h-4 w-4" />
              </div>
              <div className="rounded-2xl px-4 py-3 bg-card border border-border flex items-center gap-2.5 text-sm text-muted-foreground shadow-xs">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span>Analyzing real-time business metrics & formulating response…</span>
              </div>
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-border p-3 bg-card">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              send(input);
            }}
            className="flex items-end gap-2 bg-muted/40 rounded-2xl border border-border p-2 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.stopPropagation();
                  send(input);
                }
              }}
              rows={1}
              placeholder="Ask about sales, profit, margins, low stock, Urdu queries…"
              className="flex-1 bg-transparent resize-none max-h-32 px-2 py-2 text-sm text-foreground focus:outline-none placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:opacity-90 active:scale-95 transition-all flex-shrink-0 cursor-pointer"
              title="Send message"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
          <div className="flex items-center justify-between mt-2 px-1 text-[10px] text-muted-foreground">
            <span>Powered by GeCore AI System Engine</span>
            <span>Supports English, Roman Urdu, Urdu & Arabic</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AIAssistant;
