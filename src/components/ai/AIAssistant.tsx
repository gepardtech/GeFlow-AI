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
  Globe,
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
  formatToProfessionalBullets,
} from "@/lib/aiAssistantService";

export interface LanguageOption {
  id: string;
  label: string;
  flag: string;
  badge: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
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
  { id: "persian", label: "فارسی (Persian / Farsi)", flag: "🇮🇷", badge: "فارسی" },
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
  { id: "hebrew", label: "עברית (Hebrew)", flag: "🇮🇱", badge: "עברית" },
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
    desc: "Basic sales, profit & inventory Q&A",
    color: "text-sky-500 bg-sky-500/10",
    versionBadge: "Live",
    isV1Active: true,
  },
  {
    id: "knowledge",
    label: "Knowledge",
    icon: BookOpen,
    desc: "How to use GeFlow system FAQs",
    color: "text-emerald-500 bg-emerald-500/10",
    versionBadge: "Live",
    isV1Active: true,
  },
];

const STARTERS: Record<AIMode, string[]> = {
  analyst: [
    "What is my net profit and sales performance this month?",
    "Which products are low in stock or out of stock?",
    "Which items are expiring in the next 30 or 60 days?",
    "How can I increase my store sales and revenue?",
  ],
  operator: [
    "Draft a purchase order for my low-stock items",
    "Summarize this week's sales transactions",
    "Check inventory levels and generate a reorder list",
    "Highlight slow-moving products to discount",
  ],
  knowledge: [
    "How does the POS terminal calculate tax and discounts?",
    "How do I update business currency and tax rates in Settings?",
    "How do low stock threshold alerts work?",
    "How do I add new products and generate barcodes?",
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
    "Meri inventory ki total qeemat (worth) kitni hai?",
    "Sab se zyada bikne walay top products kon se hain?",
  ],
  operator: [
    "Kam stock walay items ki purchase order list banao",
    "Aaj ki sales transactions ka asaan hisab dikhao",
    "Stock check karke reorder list banao",
  ],
  knowledge: [
    "POS counter par bill aur discount kaise dete hain?",
    "Dukan ki currency aur tax settings kaise badlein?",
    "Naya product aur barcode kaise shamil karein?",
  ],
  advisor: [
    "Munafa barhanay ke 3 asaan aur behtareen mashwaray do",
    "Konsa samaan wholesale me zyada khareedna chahiye?",
    "Dukan ki bikri barhanay ka asaan tareeqa batao",
  ],
};

const URDU_STARTERS: Record<AIMode, string[]> = {
  analyst: [
    "اس مہینے کا کل خالص منافع اور فروخت کتنی ہے؟",
    "کون سی اشیاء کا اسٹاک کم یا ختم ہو رہا ہے؟",
    "سب سے زیادہ فروخت ہونے والے پراڈکٹس کون سے ہیں؟",
  ],
  operator: [
    "کم اسٹاک والی اشیاء کا خریداری آرڈر تیار کریں",
    "آج کے بلوں کا آسان خلاصہ دکھائیں",
  ],
  knowledge: [
    "پی او ایس کاؤنٹر پر بل اور ڈسکاؤنٹ کیسے دیتے ہیں؟",
    "دکان میں نیا آئٹم اور بارکوڈ کیسے شامل کریں؟",
  ],
  advisor: [
    "منافع بڑھانے کے لیے 3 آسان اور مفید مشورے دیں",
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
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [liveAnalytics, setLiveAnalytics] = useState<BusinessAnalyticsContext | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeBiz = businesses.find((b) => b.id === activeId);

  const handleLanguageChange = (newLang: string) => {
    setSelectedLanguage(newLang);
    localStorage.setItem("geflow_ai_selected_language", newLang);
    const langObj = SUPPORTED_LANGUAGES.find((l) => l.id === newLang);
    toast({
      title: "Assistant Language Updated",
      description: `Maryam AI will now converse in ${langObj?.label || newLang} with simple, friendly explanations.`,
    });
  };

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
    setSelectedLanguage("english");
    try {
      localStorage.removeItem("geflow_ai_selected_language");
    } catch (e) {
      console.debug("Could not clear stored AI language", e);
    }
    saveAIConversation([], activeId, currentUserId);
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

        // Determine target language:
        // 1. If user explicitly chose a language in dropdown (e.g. Spanish, French, Urdu, Arabic), respect that choice!
        // 2. Otherwise (default is English), detect if user typed in Roman Urdu, Urdu script, Arabic, Spanish, etc.
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

        // Step 2: Try Server AI Assistant API endpoint
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

        // Step 2b: Try Edge function if server API did not return
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

        // Step 3: If remote did not return a response, execute high-precision friendly plan-aware local analysis
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
            model: `Maryam AI (${planId.toUpperCase()})`,
          },
        };

        const finalMessages = [...nextMessages, assistantMsg];
        setMessages(finalMessages);
        await saveAIConversation(finalMessages, activeId, currentUserId);
      } catch (err: any) {
        console.error("AI Assistant critical failure:", err);
        const fallbackMsg: AIChatMessage = {
          role: "assistant",
          content: "👋 I ran into a quick connection hiccup. Please make sure your store is selected and tap send again—I am ready to help!",
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
    [loading, messages, liveAnalytics, activeId, mode, currentUserId, planId, selectedLanguage, activeBiz]
  );

  const activeMode = MODES.find((m) => m.id === mode) || MODES[0];

  // Pick appropriate starters based on selected language
  const currentStarters =
    selectedLanguage === "roman_urdu"
      ? ROMAN_URDU_STARTERS[mode] || ROMAN_URDU_STARTERS.analyst
      : selectedLanguage === "urdu"
      ? URDU_STARTERS[mode] || URDU_STARTERS.analyst
      : STARTERS[mode] || STARTERS.analyst;

  const currentPlaceholder =
    selectedLanguage === "roman_urdu"
      ? "Apni dukan ke munafa, bikri, ya stock ke baray me poochiye..."
      : selectedLanguage === "urdu"
      ? "دکان کے منافع، اسٹاک یا فروخت کے بارے میں آسان الفاظ میں پوچھیں..."
      : "Ask anything about your store sales, profit, or stock in simple words...";

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
        <DialogTitle className="sr-only">Maryam AI Assistant</DialogTitle>
        <DialogDescription className="sr-only">
          Maryam AI — Friendly store copilot, live profit calculations, stock alerts, and simple step-by-step guidance.
        </DialogDescription>

        {/* Header */}
        <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-border bg-muted/30 gap-2 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-600 to-sky-500 flex items-center justify-center text-white flex-shrink-0 shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-extrabold text-sm sm:text-base leading-tight text-foreground">Maryam AI</p>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Friendly Copilot
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
                  <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] text-muted-foreground/80">
                    <Coins className="h-2.5 w-2.5" /> {liveAnalytics.business.currency}
                    <Percent className="h-2.5 w-2.5 ml-1" /> {liveAnalytics.business.taxRate}% Tax
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* Language Selector Dropdown */}
            <div className="flex items-center gap-1.5 bg-background border border-border rounded-lg px-2.5 py-1 text-xs shadow-xs hover:border-primary/50 transition-colors">
              <Globe className="h-3.5 w-3.5 text-primary flex-shrink-0" />
              <span className="text-[10px] uppercase font-bold text-muted-foreground hidden sm:inline">Lang:</span>
              <select
                value={selectedLanguage}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="bg-transparent font-semibold text-foreground text-xs focus:outline-none cursor-pointer max-w-[140px] sm:max-w-[220px] truncate pr-1"
                aria-label="Select AI Assistant Language"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.id} value={lang.id} className="bg-card text-foreground">
                    {lang.flag} {lang.label}
                  </option>
                ))}
              </select>
            </div>

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
                    : m.isV1Active
                    ? "border-border/60 bg-card hover:bg-muted/50"
                    : "border-border/40 bg-muted/40 opacity-75 hover:opacity-100"
                }`}
              >
                <div className="w-full flex items-center justify-between">
                  <span className={`h-7 w-7 rounded-lg flex items-center justify-center ${m.color}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span
                    className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md border ${
                      m.isV1Active
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        : "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
                    }`}
                  >
                    {m.versionBadge}
                  </span>
                </div>
                <span className="text-xs font-bold text-foreground flex items-center gap-1 mt-0.5">
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
              <p className="font-bold text-lg text-foreground">
                {selectedLanguage === "roman_urdu"
                  ? "Salam! Main Maryam hoon, aapki madadgar"
                  : selectedLanguage === "urdu"
                  ? "السلام علیکم! میں مریم ہوں، آپ کی معاون"
                  : selectedLanguage === "spanish"
                  ? "¡Hola! Soy Maryam, tu asistente de tienda"
                  : selectedLanguage === "arabic"
                  ? "أهلاً بك! أنا مريم، مساعدة متجرك"
                  : selectedLanguage === "french"
                  ? "Bonjour ! Je suis Maryam, votre assistante"
                  : `Hello! I'm Maryam, your store assistant`}
              </p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                {selectedLanguage === "roman_urdu"
                  ? "Aap mujh se apni dukan ki bikri, munafa, ya stock ke baray me asaan lafzon me pooch sakte hain. Main bilkul asaan steps me jawab doongi!"
                  : selectedLanguage === "urdu"
                  ? "آپ مجھ سے اپنی دکان کی فروخت، خالص منافع، یا اسٹاک کے بارے میں آسان اور سادہ الفاظ میں پوچھ سکتے ہیں۔"
                  : selectedLanguage === "spanish"
                  ? "Te ayudo con actualizaciones de ventas, cálculos de ganancias y consejos de inventario en palabras sencillas."
                  : selectedLanguage === "arabic"
                  ? "أساعدك في متابعة المبيعات اليومية، وحساب الأرباح، وإدارة المخزون بكلمات بسيطة وسهلة."
                  : "I help you with simple sales updates, profit calculations, and easy inventory tips in plain, friendly everyday words."}
              </p>
              <div className="mt-6 flex flex-col gap-2 w-full max-w-lg">
                {currentStarters.map((s) => (
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
                <span>
                  {selectedLanguage === "roman_urdu"
                    ? "Aapki dukan ka hisab check kar rahi hoon…"
                    : selectedLanguage === "urdu"
                    ? "دکان کا تازہ ترین حساب کتاب دیکھا جا رہا ہے…"
                    : "Checking your live store numbers and preparing a friendly reply…"}
                </span>
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
              placeholder={currentPlaceholder}
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
            <span>Friendly Store Copilot • Simple everyday words</span>
            <span className="font-medium text-foreground/80">
              Active: {SUPPORTED_LANGUAGES.find((l) => l.id === selectedLanguage)?.label || "Auto Detect"}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AIAssistant;
