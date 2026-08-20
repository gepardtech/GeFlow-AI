import { useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Mail, Clock, Building2 } from "lucide-react";

const Contact = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data: submission, error } = await supabase.from("contact_submissions").insert({ name, email, message }).select().single();
    // Also create a support ticket if user is signed in so it lands in admin Support inbox
    const { data: { user } } = await supabase.auth.getUser();
    if (user && !error) {
      await supabase.from("support_tickets").insert({
        owner_user_id: user.id, subject: `Contact: ${name}`, category: "general",
        priority: "medium", source: "contact_form", contact_submission_id: submission?.id ?? null,
      });
    }
    setLoading(false);
    if (error) {
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    } else {
      toast({ title: "Message sent!", description: "We'll get back to you soon." });
      setName(""); setEmail(""); setMessage("");
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
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Your name" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Email</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="your@email.com" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Message</label>
                <Textarea value={message} onChange={(e) => setMessage(e.target.value)} required placeholder="How can we help?" rows={5} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending..." : "Send Message"}
              </Button>
            </form>

            <div className="space-y-8">
              <div className="flex gap-4">
                <Mail className="h-6 w-6 text-primary flex-shrink-0" />
                <div>
                  <h3 className="font-semibold mb-1">Email Support</h3>
                  <p className="text-sm text-muted-foreground">support@geflow.app</p>
                </div>
              </div>
              <div className="flex gap-4">
                <Clock className="h-6 w-6 text-primary flex-shrink-0" />
                <div>
                  <h3 className="font-semibold mb-1">Response Time</h3>
                  <p className="text-sm text-muted-foreground">We typically respond within 24 hours.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <Building2 className="h-6 w-6 text-primary flex-shrink-0" />
                <div>
                  <h3 className="font-semibold mb-1">Business Inquiries</h3>
                  <p className="text-sm text-muted-foreground">For partnerships or enterprise clients, email partners@geflow.app</p>
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
