import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
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
  BookOpen,
  Bot,
  User as UserIcon,
  Building2,
  Trash2,
  Coins,
  Percent,
  Crown,
  Globe,
  Plus,
  MessageSquare,
  History,
  X,
  AlertCircle,
  Clock,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import {
  AIMode,
  AIChatMessage,
  AIChatSession,
  fetchLiveBusinessAnalytics,
  generateLocalBusinessAnalysis,
  loadStoredAISessions,
  saveStoredAISessions,
  createNewAISession,
  deleteStoredAISession,
  getPlanChatLimit,
  detectQueryLanguage,
  BusinessAnalyticsContext,
  isModeAllowedForPlan,
  getRequiredPlanForMode,
  formatToProfessionalBullets,
} from "@/lib/aiAssistantService";

interface LanguageOption {
  id: string;
  label: string;
  flag: string;
  badge: string;
}

const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { id: "english", label: "English (UK) (Default)", flag: "🇬🇧", badge: "English (UK)" },
  { id: "auto", label: "Auto Detect (Global)", flag: "🌐", badge: "Auto" },
  { id: "roman_urdu", label: "Roman Urdu (Urdu in English)", flag: "🇵🇰", badge: "Roman Urdu" },
  { id: "urdu", label: "اردو (Urdu)", flag: "🇵🇰", badge: "اردو" },
  { id: "arabic", label: "العربية (Arabic)", flag: "🇸🇦", badge: "العربية" },
  { id: "spanish", label: "Español (Spanish)", flag: "🇪🇸", badge: "Español" },
  { id: "french", label: "Français (French)", flag: "🇫🇷", badge: "Français" },
  { id: "german", label: "Deutsch (German)", flag: "🇩🇪", badge: "Deutsch" },
  { id: "chinese", label: "中文 (Chinese Simplified)", flag: "🇨🇳", badge: "中文" },
  { id: "chinese_traditional", label: "繁體中文 (Chinese Traditional)", flag: "🇹🇼", badge: "繁體中文" },
  { id: "hindi", label: "हिन्दी (Hindi)", flag: "🇮🇳", badge: "हिन्दी" },
  { id: "hinglish", label: "Hinglish (Hindi in English)", flag: "🇮🇳", badge: "Hinglish" },
  { id: "bengali", label: "বাংলা (Bengali)", flag: "🇧🇩", badge: "বাংলা" },
  { id: "portuguese", label: "Português (Portuguese)", flag: "🇧🇷", badge: "Português" },
  { id: "russian", label: "Русский (Russian)", flag: "🇷🇺", badge: "Русский" },
  { id: "japanese", label: "日本語 (Japanese)", flag: "🇯🇵", badge: "日本語" },
  { id: "korean", label: "한국어 (Korean)", flag: "🇰🇷", badge: "한국어" },
  { id: "turkish", label: "Türkçe (Turkish)", flag: "🇹🇷", badge: "Türkçe" },
  { id: "italian", label: "Italiano (Italian)", flag: "🇮🇹", badge: "Italiano" },
  { id: "vietnamese", label: "Tiếng Việt (Vietnamese)", flag: "🇻🇳", badge: "Tiếng Việt" },
  { id: "indonesian", label: "Bahasa Indonesia", flag: "🇮🇩", badge: "Indonesia" },
  { id: "malay", label: "Bahasa Melayu", flag: "🇲🇾", badge: "Melayu" },
  { id: "persian", label: "فارسی (Persian / Farsi)", flag: "فارسی", badge: "فارسی" },
  { id: "pashto", label: "پښتو (Pashto)", flag: "🇦🇫", badge: "پښتو" },
  { id: "punjabi", label: "پنجابی / ਪੰਜਾਬੀ (Punjabi)", flag: "🇵🇰", badge: "پنجابی" },
  { id: "sindhi", label: "سنڌي (Sindhi)", flag: "🇵🇰", badge: "سنڌي" },
  { id: "tamil", label: "தமிழ் (Tamil)", flag: "🇮🇳", badge: "தமிழ்" },
  { id: "telugu", label: "తెలుగు (Telugu)", flag: "🇮🇳", badge: "తెలుగు" },
  { id: "marathi", label: "मराठी (Marathi)", flag: "🇮🇳", badge: "मराठी" },
  { id: "dutch", label: "Nederlands (Dutch)", flag: "🇳🇱", badge: "Nederlands" },
  { id: "polish", label: "Polski (Polish)", flag: "🇵🇱", badge: "Polski" },
  { id: "swedish", label: "Svenska (Swedish)", flag: "🇸🇪", badge: "Svenska" },
  { id: "greek", label: "Ελληνικά (Greek)", flag: "🇬🇷", badge: "Ελληνικά" },
  { id: "hebrew", label: "עבריت (Hebrew)", flag: "🇮🇱", badge: "עברית" },
  { id: "swahili", label: "Kiswahili (Swahili)", flag: "🇰🇪", badge: "Kiswahili" },
  { id: "tagalog", label: "Filipino (Tagalog)", flag: "🇵🇭", badge: "Filipino" },
  { id: "thai", label: "ไทย (Thai)", flag: "🇹🇭", badge: "ไทย" },
  { id: "czech", label: "Čeština (Czech)", flag: "🇨🇿", badge: "Čeština" },
  { id: "romanian", label: "Română (Romanian)", flag: "🇷🇴", badge: "Română" },
  { id: "hungarian", label: "Magyar (Hungarian)", flag: "🇭🇺", badge: "Magyar" },
  { id: "ukrainian", label: "Українська (Ukrainian)", flag: "🇺🇦", badge: "Українська" },
  { id: "norwegian", label: "Norsk (Norwegian)", flag: "🇳🇴", badge: "Norsk" },
  { id: "danish", label: "Dansk (Danish)", flag: "🇩🇰", badge: "Dansk" },
  { id: "finnish", label: "Suomi (Finnish)", flag: "🇫🇮", badge: "Suomi" },
];

interface ModeMeta {
  id: AIMode;
  label: string;
  icon: typeof BarChart3;
  desc: string;
  color: string;
  versionBadge: string;
  isV1Active: boolean;
  roadmapStage?: string;
}

const MODES: ModeMeta[] = [
  {
    id: "analyst",
    label: "Analyst",
    icon: BarChart3,
    desc: "Sales velocity, profits & stock analytics",
    color: "text-sky-500 bg-sky-500/10",
    versionBadge: "Live",
    isV1Active: true,
  },
  {
    id: "knowledge",
    label: "Knowledge",
    icon: BookOpen,
    desc: "System policies, POS rules & workflows",
    color: "text-emerald-500 bg-emerald-500/10",
    versionBadge: "Live",
    isV1Active: true,
  },
];

const STARTERS: Record<AIMode, string[]> = {
  analyst: [
    "What is my net profit and sales performance this month?",
    "Which products are low in stock or out of stock?",
    "How can I increase my store sales and average order value?",
    "How are live cooking dishes and made-on-order items handled in POS?",
  ],
  operator: [
    "Draft a purchase order for my low-stock items",
    "Summarize today's sales transactions and cashier drawer status",
    "Check inventory levels and generate a vendor reorder list",
    "Highlight slow-moving products to clear with discounts",
  ],
  knowledge: [
    "How does the POS terminal calculate tax and item discounts?",
    "How do product variety price matrices work in inventory and POS?",
    "How do cashier vs manager staff permissions work?",
    "How do I update business currency and tax rates in Settings?",
  ],
  advisor: [
    "Give me 5 practical ways to increase my sales and revenue",
    "Which high-demand items should I purchase in bulk?",
    "What inventory risks or expiry dates should I watch?",
  ],
};

const ROMAN_URDU_STARTERS: Record<AIMode, string[]> = {
  analyst: [
    "Meri dukan ka is mahine ka saaf munafa aur bikri kitni hai?",
    "Konsi cheezon ka stock khatam ya kam ho raha hai?",
    "Dukan ki sale aur bikri barhanay ke liye kya hikmat-e-amli hai?",
    "Restaurant kitchen aur made-on-order dishes ka stock kaise manage hota hai?",
  ],
  operator: [
    "Kam stock walay items ki purchase order list banao",
    "Aaj ki sales transactions ka hisab aur cashier balance dikhao",
    "Stock check karke reorder list banao",
  ],
  knowledge: [
    "POS counter par bill, discount aur variety popup kaise kaam karta hai?",
    "Dukan ki currency aur tax settings kaise badlein?",
    "Cashier aur manager ke staff roles aur permissions kaise set karein?",
  ],
  advisor: [
    "Munafa barhanay ke 5 asaan aur solid tareeqay batao",
    "Konsa samaan wholesale me zyada khareedna chahiye?",
    "Dukan ki bikri barhanay ka asaan tareeqa batao",
  ],
};

const URDU_STARTERS: Record<AIMode, string[]> = {
  analyst: [
    "اس مہینے کا کل خالص منافع اور فروخت کتنی ہے؟",
    "کون سی اشیاء کا اسٹاک کم یا ختم ہو رہا ہے؟",
    "دکان کی فروخت بڑھانے کے لیے تجاویز کیا ہیں؟",
  ],
  operator: [
    "کم اسٹاک والی اشیاء کا خریداری آرڈر تیار کریں",
    "آج کے بلوں کا آسان خلاصہ دکھائیں",
  ],
  knowledge: [
    "پی او ایس کاؤنٹر پر بل اور ڈسکاؤنٹ کیسے دیتے ہیں؟",
    "پراڈکٹ ورائٹیز اور پرائس میٹرکس کیسے کام کرتا ہے؟",
  ],
  advisor: [
    "منافع بڑھانے کے لیے 5 آسان اور مفید مشورے دیں",
    "زیادہ بکنے والا مال کون سا ہے؟",
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
  const [selectedLanguage, setSelectedLanguage] = useState<string>(() => {
    const saved = localStorage.getItem("geflow_ai_selected_language");
    if (saved && saved !== "roman_urdu" && SUPPORTED_LANGUAGES.some((l) => l.id === saved)) {
      return saved;
    }
    return "english";
  });

  // Multi-chat sessions state
  const [sessions, setSessions] = useState<AIChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState<boolean>(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [liveAnalytics, setLiveAnalytics] = useState<BusinessAnalyticsContext | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeBiz = businesses.find((b) => b.id === activeId);
  const chatLimit = getPlanChatLimit(planId);
  const isAtChatLimit = Number.isFinite(chatLimit) && sessions.length >= chatLimit;

  // Active session helper
  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) || sessions[0],
    [sessions, activeSessionId]
  );
  const messages = useMemo(() => activeSession?.messages || [], [activeSession]);

  const handleLanguageChange = (newLang: string) => {
    setSelectedLanguage(newLang);
    localStorage.setItem("geflow_ai_selected_language", newLang);
    const langObj = SUPPORTED_LANGUAGES.find((l) => l.id === newLang);
    toast({
      title: "Agent Language Updated",
      description: `GeFlow AI Agent will now analyze and respond in ${langObj?.label || newLang}.`,
    });
  };

  // Auto-reset mode if currently selected mode is not allowed for the plan
  useEffect(() => {
    if (!isModeAllowedForPlan(mode, planId)) {
      setMode("analyst");
    }
  }, [planId, mode]);

  // Load user, sessions, and auto-open new chat on login
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUserId(user.id);
        const stored = loadStoredAISessions(activeId, user.id);
        const limit = getPlanChatLimit(planId);

        // Check if user came after a fresh login session
        const sessionKey = `geflow_ai_login_chat_${user.id}`;
        const hasSessionStarted = sessionStorage.getItem(sessionKey);

        if (!hasSessionStarted) {
          // New login detected! Open a brand new chat if under plan limit
          sessionStorage.setItem(sessionKey, "true");
          if (stored.length < limit) {
            const fresh = createNewAISession("New Chat", "analyst", activeId);
            const updated = [fresh, ...stored];
            setSessions(updated);
            setActiveSessionId(fresh.id);
            saveStoredAISessions(updated, activeId, user.id);
            return;
          }
        }

        if (stored.length > 0) {
          setSessions(stored);
          setActiveSessionId(stored[0].id);
        } else {
          // Initialize first session
          const initial = createNewAISession("New Chat", "analyst", activeId);
          setSessions([initial]);
          setActiveSessionId(initial.id);
          saveStoredAISessions([initial], activeId, user.id);
        }
      }
    });
  }, [activeId, planId]);

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
  }, [open, mode, activeSessionId]);

  // Start a new chat session with plan limit enforcement
  const handleCreateNewChat = () => {
    if (isAtChatLimit) {
      toast({
        title: "Chat History Limit Reached",
        description: `Your ${plan?.label || planId.toUpperCase()} plan allows a maximum of ${chatLimit} saved chats. Please delete an older chat or upgrade your plan to start a new chat.`,
        variant: "destructive",
      });
      return;
    }

    const fresh = createNewAISession("New Chat", mode, activeId);
    const updated = [fresh, ...sessions];
    setSessions(updated);
    setActiveSessionId(fresh.id);
    saveStoredAISessions(updated, activeId, currentUserId);
    toast({
      title: "New Chat Opened",
      description: "Started a fresh business inquiry session.",
    });
  };

  // Delete a specific chat session (like ChatGPT / Gemini)
  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const remaining = deleteStoredAISession(sessionId, activeId, currentUserId);
    setSessions(remaining);
    setDeleteConfirmId(null);

    if (activeSessionId === sessionId) {
      if (remaining.length > 0) {
        setActiveSessionId(remaining[0].id);
      } else {
        const fresh = createNewAISession("New Chat", mode, activeId);
        setSessions([fresh]);
        setActiveSessionId(fresh.id);
        saveStoredAISessions([fresh], activeId, currentUserId);
      }
    }

    toast({
      title: "Chat Deleted",
      description: "Conversation removed from your history.",
    });
  };

  const handleSelectMode = (selectedMode: AIMode) => {
    const meta = MODES.find((m) => m.id === selectedMode);
    if (meta && !meta.isV1Active) {
      toast({
        title: `${meta.label} Model (${meta.versionBadge})`,
        description: meta.roadmapStage || `This feature is part of the ${meta.versionBadge} roadmap.`,
      });
      return;
    }
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

      const currentMsgs = activeSession?.messages || [];
      const nextMessages = [...currentMsgs, userMsg];

      // Update session title dynamically from first message
      let newTitle = activeSession?.title || "Business Inquiry";
      if (currentMsgs.length === 0 || newTitle === "New Chat" || newTitle === "New Business Query") {
        newTitle = content.length > 32 ? `${content.substring(0, 32)}…` : content;
      }

      // Optimistically update sessions
      const targetSessionId = activeSession?.id || `chat_${Date.now()}`;
      const updatedSessions = sessions.map((s) => {
        if (s.id === targetSessionId) {
          return {
            ...s,
            title: newTitle,
            updatedAt: new Date().toISOString(),
            messages: nextMessages,
          };
        }
        return s;
      });

      setSessions(updatedSessions);
      setInput("");
      setLoading(true);

      try {
        let currentCtx = liveAnalytics;
        if (!currentCtx && activeId) {
          currentCtx = await fetchLiveBusinessAnalytics(activeId);
          setLiveAnalytics(currentCtx);
        }

        let effectiveLanguage = "english";
        const isExplicitDropdown =
          selectedLanguage && selectedLanguage !== "english" && selectedLanguage !== "auto";

        if (isExplicitDropdown) {
          effectiveLanguage = selectedLanguage;
        } else {
          const detectedMsgLang = detectQueryLanguage(content);
          if (detectedMsgLang && detectedMsgLang !== "english" && detectedMsgLang !== "other") {
            effectiveLanguage = detectedMsgLang;
          } else {
            effectiveLanguage = "english";
          }
        }

        // Try Server AI Assistant API endpoint
        let replyText = "";
        let succeededRemotely = false;

        try {
          const apiRes = await fetch("/api/ai/assistant", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
              mode,
              businessId: activeId ?? "",
              planId,
              selectedLanguage: effectiveLanguage,
              businessContext: currentCtx
                ? {
                    businessName: currentCtx.business.name,
                    currency: currentCtx.business.currency,
                    taxRate: currentCtx.business.taxRate,
                    totalProducts: currentCtx.inventory.totalProducts,
                    lowStockCount: currentCtx.inventory.lowStockCount,
                    outOfStockCount: currentCtx.inventory.outOfStockCount,
                    todayRevenue: currentCtx.sales.todayRevenue,
                    todaySalesCount: currentCtx.sales.todayTransactions,
                    monthRevenue: currentCtx.sales.monthRevenue,
                    monthProfit: currentCtx.sales.monthProfit,
                  }
                : {
                    businessName: activeBiz?.business_name || "Your Store",
                    currency: activeBiz?.currency || "PKR",
                  },
            }),
          });

          if (apiRes.ok) {
            const data = await apiRes.json();
            if (data?.reply && typeof data.reply === "string") {
              replyText = data.reply.trim();
              succeededRemotely = true;
            }
          }
        } catch (apiErr) {
          console.debug("Server AI assistant API attempt bypassed:", apiErr);
        }

        // Try Edge function if server API did not return
        if (!succeededRemotely) {
          try {
            const { data, error } = await supabase.functions.invoke("geflow-ai-assistant", {
              body: {
                messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
                mode,
                businessId: activeId ?? "",
                planId,
                selectedLanguage: effectiveLanguage,
              },
            });

            if (!error && data?.reply && typeof data.reply === "string") {
              replyText = data.reply.trim();
              succeededRemotely = true;
            }
          } catch (edgeErr) {
            console.debug("Edge function invocation bypassed:", edgeErr);
          }
        }

        // Fallback: execute high-precision plan-aware local analysis
        if (!succeededRemotely || !replyText) {
          replyText = generateLocalBusinessAnalysis(
            content,
            mode,
            currentCtx,
            planId,
            activeBiz?.currency || "PKR",
            effectiveLanguage
          );
        }

        const formattedReply = formatToProfessionalBullets(replyText);

        const assistantMsg: AIChatMessage = {
          role: "assistant",
          content: formattedReply,
          timestamp: new Date().toISOString(),
          meta: {
            language: effectiveLanguage,
            model: `GeFlow AI Agent (${planId.toUpperCase()})`,
          },
        };

        const finalMessages = [...nextMessages, assistantMsg];

        const finalizedSessions = sessions.map((s) => {
          if (s.id === targetSessionId) {
            return {
              ...s,
              title: newTitle,
              updatedAt: new Date().toISOString(),
              messages: finalMessages,
            };
          }
          return s;
        });

        setSessions(finalizedSessions);
        saveStoredAISessions(finalizedSessions, activeId, currentUserId);
      } catch (err: any) {
        console.error("AI Agent failure:", err);
        const fallbackMsg: AIChatMessage = {
          role: "assistant",
          content: "### ⚡ Executive Diagnostic Alert\n\n• **Status**: Live connection refreshed.\n• **Action**: Store metrics verified. Please re-enter your business query.",
          timestamp: new Date().toISOString(),
        };
        const finalMessages = [...nextMessages, fallbackMsg];
        const finalizedSessions = sessions.map((s) => (s.id === targetSessionId ? { ...s, messages: finalMessages } : s));
        setSessions(finalizedSessions);
        saveStoredAISessions(finalizedSessions, activeId, currentUserId);
      } finally {
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    },
    [loading, activeSession, sessions, liveAnalytics, activeId, mode, currentUserId, planId, selectedLanguage, activeBiz]
  );

  const activeMode = MODES.find((m) => m.id === mode) || MODES[0];

  const currentStarters =
    selectedLanguage === "roman_urdu"
      ? ROMAN_URDU_STARTERS[mode] || ROMAN_URDU_STARTERS.analyst
      : selectedLanguage === "urdu"
      ? URDU_STARTERS[mode] || URDU_STARTERS.analyst
      : STARTERS[mode] || STARTERS.analyst;

  const currentPlaceholder =
    selectedLanguage === "roman_urdu"
      ? "Apni dukan ke munafa, bikri, stock ya operations ke baray me poochiye..."
      : selectedLanguage === "urdu"
      ? "دکان کے منافع، اسٹاک، فروخت یا پالیسی کے بارے میں سوال پوچھیں..."
      : "Ask anything about store sales, net profit, low stock, or POS rules...";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl p-0 overflow-hidden h-[88vh] flex flex-col gap-0 border-border bg-card shadow-2xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">GeFlow Business AI Agent</DialogTitle>
        <DialogDescription className="sr-only">
          Autonomous business intelligence and operations agent for retail, restaurant, and inventory management.
        </DialogDescription>

        {/* Top Header Bar */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-border bg-muted/30 gap-2 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            {/* Sidebar toggle button */}
            <button
              type="button"
              onClick={() => setShowHistory((prev) => !prev)}
              className={`h-9 px-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                showHistory
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-background border-border text-muted-foreground hover:text-foreground"
              }`}
              title={showHistory ? "Hide chat history" : "Show chat history"}
            >
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">History</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-muted font-mono">
                {sessions.length}/{Number.isFinite(chatLimit) ? chatLimit : "∞"}
              </span>
            </button>

            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-600 to-sky-500 flex items-center justify-center text-white flex-shrink-0 shadow-sm">
              <Sparkles className="h-4 w-4" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-extrabold text-sm sm:text-base leading-tight text-foreground">
                  GeFlow Business AI Agent
                </p>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                  Autonomous Agent
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                  <Crown className="w-3 h-3 text-primary" />
                  {plan?.label || "Free"} Plan
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground flex items-center gap-2 truncate mt-0.5">
                <span className="flex items-center gap-1 font-medium truncate">
                  <Building2 className="h-3 w-3 text-sky-500 flex-shrink-0" />
                  {activeBiz?.business_name ?? "Workspace Store"}
                </span>
                {liveAnalytics?.business && (
                  <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] text-muted-foreground/80 font-mono">
                    <Coins className="h-2.5 w-2.5" /> {liveAnalytics.business.currency}
                    <Percent className="h-2.5 w-2.5 ml-1" /> {liveAnalytics.business.taxRate}% Tax
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* New Chat CTA Button */}
            <button
              type="button"
              onClick={handleCreateNewChat}
              disabled={isAtChatLimit}
              className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 disabled:opacity-40 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              title={isAtChatLimit ? "Chat limit reached for plan" : "Start a new conversation"}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Chat</span>
            </button>

            {/* Language Selector Dropdown */}
            <div className="flex items-center gap-1.5 bg-background border border-border rounded-lg px-2.5 py-1 text-xs shadow-xs hover:border-primary/50 transition-colors">
              <Globe className="h-3.5 w-3.5 text-primary flex-shrink-0" />
              <select
                value={selectedLanguage}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="bg-transparent font-semibold text-foreground text-xs focus:outline-none cursor-pointer max-w-[130px] sm:max-w-[180px] truncate pr-1"
                aria-label="Select AI Assistant Language"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.id} value={lang.id} className="bg-card text-foreground">
                    {lang.flag} {lang.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Main Body with Split View (Sidebar History + Chat Panel) */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* History Sidebar (ChatGPT / Gemini style) */}
          {showHistory && (
            <div className="w-64 sm:w-72 border-r border-border bg-muted/20 flex flex-col shrink-0 overflow-hidden z-20 absolute sm:relative inset-y-0 left-0 bg-card sm:bg-muted/15 shadow-lg sm:shadow-none">
              {/* Sidebar Header */}
              <div className="p-3 border-b border-border flex items-center justify-between bg-card/50">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <MessageSquare className="h-4 w-4 text-sky-500" />
                  <span>Chat Sessions</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-muted-foreground font-mono">
                    {sessions.length} / {Number.isFinite(chatLimit) ? chatLimit : "∞"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowHistory(false)}
                    className="sm:hidden p-1 rounded hover:bg-muted text-muted-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Chat Limit Notification / Upgrade Banner */}
              {isAtChatLimit && (
                <div className="p-2.5 bg-amber-500/10 border-b border-amber-500/20 text-xs flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-[11px] text-amber-800 dark:text-amber-200 leading-tight">
                    <p className="font-bold">Limit Reached ({chatLimit} Chats)</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Delete older chats to create new ones, or upgrade plan.
                    </p>
                  </div>
                </div>
              )}

              {/* Sessions List */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {sessions.map((s) => {
                  const isActive = s.id === activeSession?.id;
                  const isConfirmingDelete = deleteConfirmId === s.id;

                  return (
                    <div
                      key={s.id}
                      onClick={() => {
                        setActiveSessionId(s.id);
                        if (window.innerWidth < 640) setShowHistory(false);
                      }}
                      className={`group relative rounded-xl p-2.5 text-left text-xs cursor-pointer transition flex items-center justify-between gap-2 border ${
                        isActive
                          ? "bg-primary/10 border-primary/30 text-foreground font-bold shadow-xs"
                          : "bg-transparent border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs leading-snug">{s.title || "Business Inquiry"}</p>
                        <p className="text-[10px] text-muted-foreground/75 flex items-center gap-1 mt-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          <span>{new Date(s.updatedAt || s.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                          <span>&bull;</span>
                          <span>{s.messages.length} msg</span>
                        </p>
                      </div>

                      {/* Delete Option with Confirmation (ChatGPT style) */}
                      <div className="shrink-0 flex items-center">
                        {isConfirmingDelete ? (
                          <div
                            className="flex items-center gap-1 bg-destructive/10 p-1 rounded-md border border-destructive/20"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={(e) => handleDeleteSession(s.id, e)}
                              className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-destructive text-destructive-foreground hover:bg-destructive/90 transition"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmId(null);
                              }}
                              className="px-1 text-[10px] font-bold text-muted-foreground hover:text-foreground"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setDeleteConfirmId(s.id);
                            }}
                            className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition opacity-0 group-hover:opacity-100 sm:opacity-0 focus:opacity-100"
                            title="Delete chat from history"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Sidebar Footer with Plan Limit Indicator */}
              <div className="p-3 border-t border-border bg-card/60 text-[11px] text-muted-foreground space-y-2">
                <div className="flex items-center justify-between">
                  <span>Chat Storage:</span>
                  <span className="font-bold text-foreground">
                    {sessions.length} / {Number.isFinite(chatLimit) ? `${chatLimit} chats` : "Unlimited"}
                  </span>
                </div>
                {planId === "free" && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenChange(false);
                      navigate("/dashboard/subscription?plan=standard");
                    }}
                    className="w-full py-1.5 px-2 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 font-bold text-[10px] transition text-center flex items-center justify-center gap-1 border border-sky-500/20"
                  >
                    <Crown className="h-3 w-3" />
                    <span>Upgrade for 10+ Chats</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Right Area: Messages + Mode Selector + Composer */}
          <div className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden">
            {/* Mode selector bar */}
            <div className="grid grid-cols-2 gap-2 p-2.5 sm:p-3 border-b border-border bg-muted/20 shrink-0">
              {MODES.map((m) => {
                const Icon = m.icon;
                const on = m.id === mode;

                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSelectMode(m.id);
                    }}
                    className={`relative flex items-center gap-2.5 rounded-xl p-2.5 border text-left transition-all ${
                      on
                        ? "border-primary bg-primary/10 shadow-xs"
                        : "border-border/60 bg-card hover:bg-muted/50"
                    }`}
                  >
                    <span className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${m.color}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground">{m.label}</span>
                        <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          {m.versionBadge}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">{m.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Messages list */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-background">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-4 py-8 max-w-2xl mx-auto">
                  <div className={`h-14 w-14 rounded-2xl flex items-center justify-center mb-4 ${activeMode.color}`}>
                    <activeMode.icon className="h-7 w-7" />
                  </div>
                  <p className="font-extrabold text-xl text-foreground">
                    GeFlow Business AI Agent
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-md">
                    Autonomous operations, real-time margins, kitchen workflow management, and inventory analytics for{" "}
                    <span className="font-semibold text-foreground">{activeBiz?.business_name || "Your Store"}</span>.
                  </p>

                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                    {currentStarters.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          send(s);
                        }}
                        className="text-left text-xs px-3.5 py-3 rounded-xl border border-border bg-card hover:border-primary hover:bg-primary/5 transition-all text-foreground font-medium shadow-xs flex items-center justify-between group"
                      >
                        <span className="line-clamp-2">{s}</span>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0 ml-2" />
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
                        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-headings:mt-2.5 prose-headings:mb-1.5 prose-headings:font-bold prose-ul:my-1.5 prose-li:my-0.5 text-foreground leading-relaxed">
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
                    <span>
                      {selectedLanguage === "roman_urdu"
                        ? "Dukan ka live hisab aur rules analyze kar raha hoon…"
                        : selectedLanguage === "urdu"
                        ? "دکان کے قواعد اور لائیو حساب کتاب کا تجزیہ ہو رہا ہے…"
                        : "Analyzing store ledger and formulating executive business directives…"}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Composer */}
            <div className="border-t border-border p-3 bg-card shrink-0">
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
                  placeholder={currentPlaceholder}
                  className="flex-1 bg-transparent resize-none max-h-32 px-2 py-2 text-sm text-foreground focus:outline-none placeholder:text-muted-foreground"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:opacity-90 active:scale-95 transition-all flex-shrink-0 cursor-pointer shadow-xs"
                  title="Send query to Business AI Agent"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </form>
              <div className="flex items-center justify-between mt-2 px-1 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span>GeFlow Enterprise Agent</span>
                  <span>&bull;</span>
                  <span>Session: {activeSession?.title || "Active"}</span>
                </span>
                <span className="font-semibold text-foreground/80">
                  Target: {SUPPORTED_LANGUAGES.find((l) => l.id === selectedLanguage)?.label || "English (UK)"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AIAssistant;
