import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useActiveBusiness } from "@/hooks/useActiveBusiness";
import { useToast } from "@/hooks/use-toast";
import {
  LifeBuoy,
  Send,
  Loader2,
  Printer,
  Camera,
  RotateCcw,
  BookOpen,
  Users,
  Bot,
  User as UserIcon,
  Trash2,
  Sparkles,
  CheckCircle2,
  HelpCircle,
  Wrench,
  ChevronRight,
  PlusCircle,
} from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateTicket?: (subject: string, category: string, message: string) => void;
}

interface SupportChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const SUPPORT_TOPICS = [
  {
    id: "printing",
    title: "Thermal Printer & Receipts",
    icon: Printer,
    prompt: "How do I setup 80mm ESC/POS thermal printing and automatic cash drawer kick?",
  },
  {
    id: "scanner",
    title: "Barcode & Camera Vision",
    icon: Camera,
    prompt: "My barcode scanner or camera vision is not scanning products in the POS terminal.",
  },
  {
    id: "refunds",
    title: "Refunds & Restocking",
    icon: RotateCcw,
    prompt: "How do I process a past order refund and return products back to active inventory?",
  },
  {
    id: "tax",
    title: "Tax & Regional VAT Setup",
    icon: BookOpen,
    prompt: "How do I configure store VAT/GST tax rate and default currency formatting?",
  },
  {
    id: "team",
    title: "Team & Role Permissions",
    icon: Users,
    prompt: "How do store owner invitations work and what permissions do Cashiers vs Managers have?",
  },
];

const INITIAL_SUPPORT_MESSAGES: SupportChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    content:
      "Hello! I am your **GeFlow Support AI Assistant**. I specialize in hardware setup (thermal receipt printers, barcode scanners), POS troubleshooting, returns, and multi-tenant store configuration.\n\nSelect a topic below or type your technical inquiry directly!",
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  },
];

export const SupportAIAssistant: React.FC<Props> = ({
  open,
  onOpenChange,
  onCreateTicket,
}) => {
  const { activeBusiness } = useActiveBusiness();
  const { toast } = useToast();
  const [messages, setMessages] = useState<SupportChatMessage[]>(INITIAL_SUPPORT_MESSAGES);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [open, messages]);

  const handleSend = (textToSend?: string) => {
    const text = (textToSend ?? input).trim();
    if (!text || thinking) return;

    const userMsg: SupportChatMessage = {
      id: "u_" + Date.now(),
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setThinking(true);

    setTimeout(() => {
      const q = text.toLowerCase();
      let reply = "";

      if (q.includes("print") || q.includes("receipt") || q.includes("thermal") || q.includes("drawer")) {
        reply =
          "### 🖨️ Thermal Printer & Cash Drawer Setup Guide\n\n" +
          "1. **ESC/POS Layout Selection**:\n" +
          "   - Open **Settings > POS & Receipts**.\n" +
          "   - Set Paper Width to **80mm Thermal** (standard) or **58mm Receipt**.\n\n" +
          "2. **Browser Silent Printing Configuration**:\n" +
          "   - Set your thermal printer as your default operating system printer.\n" +
          "   - In Google Chrome or Edge print dialog, expand *More settings* and turn on *Background graphics*.\n" +
          "   - Launch Chrome with `--kiosk-printing` flag for 1-click silent receipt dispensing.\n\n" +
          "3. **Automatic Cash Drawer Kick**:\n" +
          "   - Connect the RJ11/RJ12 drawer kick cable into the back of your receipt printer.\n" +
          "   - In Windows Printer Properties > Device Settings > Peripheral Unit, select **Cash Drawer 1: Open Before Printing**.";
      } else if (q.includes("barcode") || q.includes("scan") || q.includes("camera") || q.includes("sku")) {
        reply =
          "### 📷 Barcode Scanner & Vision AI Troubleshooting\n\n" +
          "1. **USB Handheld Scanners**:\n" +
          "   - Most laser/CCD scanners must be in **USB HID Keyboard Mode**.\n" +
          "   - Scan the *Add Carriage Return (Enter)* configuration barcode in your scanner's user manual so scanned codes automatically submit.\n\n" +
          "2. **Live Camera Scanner in POS**:\n" +
          "   - On the POS screen, switch input tab from *By SKU* to **By Image**.\n" +
          "   - Grant browser camera permissions when prompted.\n" +
          "   - Hold the product barcode steady inside the guide square under sufficient lighting.\n\n" +
          "3. **SKU Matching**:\n" +
          "   - Verify in **Inventory** that each item has its Barcode/SKU field populated.";
      } else if (q.includes("return") || q.includes("refund") || q.includes("restock")) {
        reply =
          "### 🔄 Order Returns & Stock Restocking Workflow\n\n" +
          "1. **Initiating a Return**:\n" +
          "   - Go to **POS Terminal** or **Reports > Sales Ledger**.\n" +
          "   - Find the receipt using the Receipt Number or customer details.\n" +
          "   - Click **Initiate Return / Refund**.\n\n" +
          "2. **Automatic Restock**:\n" +
          "   - In the refund confirmation dialog, leave **Restock Items** checked.\n" +
          "   - The returned quantities will automatically be added back to your active stock ledger.\n\n" +
          "3. **Financial Sync**:\n" +
          "   - Net revenue and daily cash register totals will immediately update in real-time.";
      } else if (q.includes("tax") || q.includes("vat") || q.includes("currency") || q.includes("gst")) {
        reply =
          "### ⚙️ Tax & Regional Currency Settings\n\n" +
          "1. **Global Tax Rate**:\n" +
          "   - Open **Settings > Regional & Currency**.\n" +
          "   - Enter default store tax (e.g., `5%` or `15%`) and choose whether prices are tax-inclusive or exclusive.\n\n" +
          "2. **Per-Item Exemption**:\n" +
          "   - When editing a product in **Inventory**, you can set a custom tax rate or zero-rate (exempt) items.\n\n" +
          "3. **Currency Symbols**:\n" +
          `   - Current active store (${activeBusiness?.business_name || "Store"}) currency: **${activeBusiness?.currency || "USD"}**.`;
      } else if (q.includes("team") || q.includes("role") || q.includes("cashier") || q.includes("manager") || q.includes("invite")) {
        reply =
          "### 👥 Team Hub & Role Permissions Overview\n\n" +
          "1. **Store Owner (Full Control)**:\n" +
          "   - Can add, edit, or delete team members.\n" +
          "   - Full access to billing, business settings, purchases, and analytics.\n\n" +
          "2. **Manager**:\n" +
          "   - Operational access to POS, Inventory master catalog, purchases, and reports.\n\n" +
          "3. **Cashier**:\n" +
          "   - Streamlined retail view: POS checkout, daily sales counter, receipt reprint, and inventory stock lookup.\n\n" +
          "4. **Inviting Employees**:\n" +
          "   - In **Team Hub**, click **Add Team Member**.\n" +
          "   - Enter their email and assign an operational role. When they log in with that email, your store will immediately appear in their Employee Workspace switcher!";
      } else {
        reply =
          `### 🛠️ Technical Diagnostic: "${text}"\n\n` +
          `1. **Active Store Context**: Operating on **${activeBusiness?.business_name || "Selected Store"}**.\n` +
          `2. **Real-Time Data Sync**: If records appear delayed, click the Refresh icon in the top navigation bar to trigger immediate Postgres channel resynchronization.\n` +
          `3. **Escalate to Support Ticket**: If you need human investigation or encounter a bug, click **Create Support Ticket** below to file an official ticket with our engineering team!`;
      }

      const botMsg: SupportChatMessage = {
        id: "b_" + Date.now(),
        role: "assistant",
        content: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, botMsg]);
      setThinking(false);
    }, 600);
  };

  const handleClearHistory = () => {
    setMessages(INITIAL_SUPPORT_MESSAGES);
    toast({ title: "Support Chat Reset", description: "Chat history cleared." });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[85vh] p-0 rounded-3xl overflow-hidden flex flex-col bg-card border-border/80 shadow-2xl">
        <DialogTitle className="sr-only">GeFlow Support AI Assistant</DialogTitle>
        <DialogDescription className="sr-only">Technical Helpdesk & Hardware Assistant</DialogDescription>

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-border/80 bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-xs">
              <LifeBuoy className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-foreground">GeFlow Support AI</h3>
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  Helpdesk & Hardware
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Thermal printers, scanners, refunds & multi-tenant configuration
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleClearHistory}
              title="Clear conversation"
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Topic Chips */}
        <div className="px-4 py-2 border-b border-border/60 bg-muted/10 overflow-x-auto flex items-center gap-2 text-xs no-scrollbar">
          <span className="text-[10px] font-extrabold uppercase text-muted-foreground shrink-0">
            Quick Topics:
          </span>
          {SUPPORT_TOPICS.map((topic) => {
            const Icon = topic.icon;
            return (
              <button
                key={topic.id}
                type="button"
                onClick={() => handleSend(topic.prompt)}
                className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border/80 bg-background/80 hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-600 dark:hover:text-emerald-400 text-[11px] font-medium transition-all cursor-pointer"
              >
                <Icon className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>{topic.title}</span>
              </button>
            );
          })}
        </div>

        {/* Chat Messages Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {messages.map((m) => {
            const isBot = m.role === "assistant";
            return (
              <div
                key={m.id}
                className={`flex gap-3 text-xs ${isBot ? "justify-start" : "justify-end"}`}
              >
                {isBot && (
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] sm:max-w-[80%] rounded-2xl p-4 space-y-2 leading-relaxed ${
                    isBot
                      ? "bg-muted/40 text-foreground border border-border/70"
                      : "bg-emerald-600 text-white shadow-xs"
                  }`}
                >
                  <div className="prose prose-xs dark:prose-invert max-w-none text-xs">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                  <p
                    className={`text-[9px] text-right font-medium ${
                      isBot ? "text-muted-foreground" : "text-emerald-100"
                    }`}
                  >
                    {m.timestamp}
                  </p>
                </div>
                {!isBot && (
                  <div className="w-8 h-8 rounded-xl bg-muted text-foreground flex items-center justify-center shrink-0 border border-border/80">
                    <UserIcon className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {thinking && (
            <div className="flex gap-3 text-xs justify-start items-center text-muted-foreground">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 animate-bounce" />
              </div>
              <div className="bg-muted/40 border border-border/70 rounded-2xl p-3 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                <span className="text-[11px]">Analyzing hardware and system docs...</span>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 sm:p-4 border-t border-border/80 bg-card flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask about thermal printers, scanners, refunds, or system setup..."
            className="flex-1 h-11 px-4 text-xs bg-muted/30 border border-border/80 rounded-2xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={!input.trim() || thinking}
            className="h-11 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold transition-colors flex items-center justify-center cursor-pointer shadow-xs"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SupportAIAssistant;
