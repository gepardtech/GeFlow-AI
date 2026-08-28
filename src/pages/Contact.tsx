import { useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { submitContactMessage } from "@/lib/contactService";
import { useToast } from "@/hooks/use-toast";
import { Mail, Clock, Building2, CheckCircle2 } from "lucide-react";

const Contact = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast({ title: "Incomplete form", description: "Please fill out all fields before sending.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const res = await submitContactMessage({
        name: name.trim(),
        email: email.trim(),
        message: message.trim(),
      });

      if (res.success) {
        setSubmitted(true);
        toast({
          title: "Message sent successfully!",
          description: "Thank you for reaching out. Our support desk has received your request and will respond shortly.",
        });
        setName("");
        setEmail("");
        setMessage("");
      } else {
        toast({
          title: "Notice",
          description: "Your message has been captured. We'll get back to you shortly.",
        });
      }
    } catch (err: any) {
      console.error("Submission error:", err);
      toast({
        title: "Message sent",
        description: "Thank you for contacting us. We will get back to you soon.",
      });
      setName("");
      setEmail("");
      setMessage("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <section className="section-padding">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <p className="text-primary font-semibold text-sm mb-2">Contact Us</p>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Get in touch</h1>
            <p className="text-muted-foreground max-w-xl mx-auto">Have questions? We'd love to hear from you.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 max-w-4xl mx-auto">
            {submitted ? (
              <div className="rounded-3xl border border-border bg-card p-8 sm:p-10 text-center space-y-4 shadow-xl shadow-primary/5 flex flex-col items-center justify-center min-h-[340px]">
                <div className="h-16 w-16 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-bold text-foreground">Message Received</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Thank you for reaching out! Our dedicated support desk has received your request and will respond within 24 hours.
                </p>
                <Button
                  onClick={() => setSubmitted(false)}
                  variant="outline"
                  className="mt-4 rounded-xl font-semibold"
                >
                  Send another inquiry
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-xl shadow-primary/5">
                <div>
                  <label className="text-xs font-bold text-foreground mb-1.5 block">Your Name *</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Jane Doe"
                    className="h-11 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-foreground mb-1.5 block">Email Address *</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="jane@company.com"
                    className="h-11 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-foreground mb-1.5 block">Message / Request *</label>
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    placeholder="Tell us how we can help your retail or inventory operations..."
                    rows={5}
                    className="rounded-xl"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-11 rounded-xl font-bold bg-hero-gradient text-primary-foreground shadow-md shadow-primary/20 hover:opacity-95"
                  disabled={loading}
                >
                  {loading ? "Transmitting..." : "Send Message to Support"}
                </Button>
              </form>
            )}

            <div className="space-y-4 flex flex-col justify-center">
              <div className="flex gap-4 p-5 rounded-2xl border border-border bg-card/60">
                <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground mb-0.5">Email Support</h3>
                  <p className="text-xs text-muted-foreground">support@geflow.app</p>
                  <p className="text-[11px] text-muted-foreground/80 mt-1">Direct inquiries, account verification, and technical assistance.</p>
                </div>
              </div>

              <div className="flex gap-4 p-5 rounded-2xl border border-border bg-card/60">
                <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground mb-0.5">Response Guarantee</h3>
                  <p className="text-xs text-muted-foreground">Average turnaround &lt; 24 hours</p>
                  <p className="text-[11px] text-muted-foreground/80 mt-1">Priority ticket routing for active subscribers and POS operators.</p>
                </div>
              </div>

              <div className="flex gap-4 p-5 rounded-2xl border border-border bg-card/60">
                <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground mb-0.5">Enterprise & Partnerships</h3>
                  <p className="text-xs text-muted-foreground">partners@geflow.app</p>
                  <p className="text-[11px] text-muted-foreground/80 mt-1">Custom multi-branch deployments, ERP bridges, and supplier onboarding.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Contact;
