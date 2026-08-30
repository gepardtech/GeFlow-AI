import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import UserPanelGate from "@/components/UserPanelGate";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LifeBuoy, Plus, Loader2, Send, MessageSquare, ArrowLeft } from "lucide-react";

interface Ticket {
  id: string; ticket_number: string; subject: string; category: string;
  priority: string; status: string; created_at: string;
}
interface Message {
  id: string; ticket_id: string; author_user_id: string; is_admin: boolean; body: string; created_at: string;
}

const statusCls = (s: string) => ({
  open: "bg-sky-500/15 text-sky-500",
  pending: "bg-amber-500/15 text-amber-600",
  resolved: "bg-emerald-500/15 text-emerald-500",
  closed: "bg-slate-500/15 text-slate-500",
}[s] ?? "bg-slate-500/15 text-slate-500");

const priorityCls = (p: string) => ({
  low: "bg-slate-500/15 text-slate-500",
  medium: "bg-sky-500/15 text-sky-500",
  high: "bg-rose-500/15 text-rose-500",
}[p] ?? "bg-slate-500/15 text-slate-500");

const UserSupport = () => {
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ subject: "", category: "general", priority: "medium", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [active, setActive] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const loadTickets = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("support_tickets")
      .select("id, ticket_number, subject, category, priority, status, created_at")
      .eq("owner_user_id", uid)
      .order("created_at", { ascending: false });
    setTickets((data as Ticket[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    let ch: any = null;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);
      loadTickets(user.id);
      ch = supabase.channel(`user_tickets_rt_${user.id}_${Math.random().toString(36).slice(2)}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets", filter: `owner_user_id=eq.${user.id}` }, () => loadTickets(user.id))
        .subscribe();
    })();
    return () => { if (ch) supabase.removeChannel(ch); };
  }, [loadTickets]);

  // thread messages + realtime
  useEffect(() => {
    if (!active) return;
    const load = async () => {
      const { data } = await supabase
        .from("ticket_messages")
        .select("id, ticket_id, author_user_id, is_admin, body, created_at")
        .eq("ticket_id", active.id)
        .order("created_at", { ascending: true });
      setMessages((data as Message[]) ?? []);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    };
    load();
    const ch = supabase.channel(`ticket_msgs_${active.id}_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_messages", filter: `ticket_id=eq.${active.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [active]);

  const createTicket = async () => {
    if (!userId) return;
    if (!form.subject.trim() || !form.message.trim()) {
      toast({ title: "Subject and message are required", variant: "destructive" }); return;
    }
    setSubmitting(true);
    const { data: ticket, error } = await supabase
      .from("support_tickets")
      .insert({ owner_user_id: userId, subject: form.subject.trim(), category: form.category, priority: form.priority, source: "user_panel" })
      .select("id, ticket_number, subject, category, priority, status, created_at")
      .single();
    if (error || !ticket) {
      setSubmitting(false);
      toast({ title: "Could not create ticket", description: error?.message, variant: "destructive" }); return;
    }
    await supabase.from("ticket_messages").insert({ ticket_id: ticket.id, author_user_id: userId, is_admin: false, body: form.message.trim() });
    setSubmitting(false);
    setOpen(false);
    setForm({ subject: "", category: "general", priority: "medium", message: "" });
    toast({ title: "Ticket submitted", description: `Reference ${ticket.ticket_number}` });
    loadTickets(userId);
  };

  const sendReply = async () => {
    if (!userId || !active || !reply.trim()) return;
    const body = reply.trim();
    setReply("");
    const { error } = await supabase.from("ticket_messages").insert({ ticket_id: active.id, author_user_id: userId, is_admin: false, body });
    if (error) { toast({ title: "Failed to send", description: error.message, variant: "destructive" }); setReply(body); }
  };

  return (
    <UserPanelGate pageTitle="Support">
      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-1">Support Center</h1>
          <p className="text-sm text-muted-foreground">Submit tickets and chat with our team in real time.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="h-11 px-5 rounded-xl bg-sky-400 hover:bg-sky-500 text-white font-bold">
          <Plus className="h-4 w-4 mr-2" /> New Ticket
        </Button>
      </div>

      {loading ? (
        <div className="p-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
      ) : tickets.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <LifeBuoy className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <p className="font-bold">No tickets yet</p>
          <p className="text-sm text-muted-foreground mt-1">Open a ticket and we'll get back to you quickly.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <button key={t.id} onClick={() => setActive(t)} className="w-full text-left bg-card border border-border rounded-2xl p-5 hover:bg-muted/30 transition flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-sky-400/15 text-sky-500 flex items-center justify-center flex-shrink-0"><MessageSquare className="h-4 w-4" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold truncate">{t.subject}</p>
                  <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">{t.ticket_number}</span>
                </div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mt-0.5">{t.category} • {new Date(t.created_at).toLocaleDateString()}</p>
              </div>
              <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${priorityCls(t.priority)}`}>{t.priority}</span>
              <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${statusCls(t.status)}`}>{t.status}</span>
            </button>
          ))}
        </div>
      )}

      {/* New ticket dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Support Ticket</DialogTitle>
            <DialogDescription>Describe your issue and we'll respond as soon as possible.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Subject</Label>
              <Input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} placeholder="Brief summary of your issue" className="mt-1.5" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="billing">Billing</SelectItem>
                    <SelectItem value="technical">Technical</SelectItem>
                    <SelectItem value="feature">Feature Request</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Message</Label>
              <Textarea rows={5} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} placeholder="Tell us what's happening..." className="mt-1.5" />
            </div>
            <Button onClick={createTicket} disabled={submitting} className="w-full h-11 rounded-xl bg-sky-400 hover:bg-sky-500 text-white font-bold">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Ticket"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Thread dialog */}
      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-xl p-0 overflow-hidden">
          {active && (
            <>
              <DialogHeader className="p-4 border-b border-border">
                <DialogTitle className="flex items-center gap-2 text-base">
                  <button onClick={() => setActive(null)} className="h-7 w-7 rounded-lg hover:bg-muted inline-flex items-center justify-center md:hidden"><ArrowLeft className="h-4 w-4" /></button>
                  {active.subject}
                </DialogTitle>
                <DialogDescription className="flex items-center gap-2">
                  <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">{active.ticket_number}</span>
                  <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${statusCls(active.status)}`}>{active.status}</span>
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[50vh] overflow-y-auto p-4 space-y-3 bg-muted/20">
                {messages.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-8">No messages yet.</p>
                ) : messages.map((m) => (
                  <div key={m.id} className={`flex ${m.is_admin ? "justify-start" : "justify-end"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${m.is_admin ? "bg-card border border-border" : "bg-sky-400 text-white"}`}>
                      <p className="text-[9px] font-bold uppercase tracking-widest opacity-70 mb-0.5">{m.is_admin ? "Support Team" : "You"}</p>
                      <p className="whitespace-pre-wrap">{m.body}</p>
                      <p className={`text-[9px] mt-1 ${m.is_admin ? "text-muted-foreground" : "text-white/70"}`}>{new Date(m.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
              <div className="p-3 border-t border-border flex items-center gap-2">
                <Input value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") sendReply(); }} placeholder="Type your reply..." />
                <Button onClick={sendReply} disabled={!reply.trim()} className="h-10 px-4 rounded-xl bg-sky-400 hover:bg-sky-500 text-white"><Send className="h-4 w-4" /></Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </UserPanelGate>
  );
};

export default UserSupport;
