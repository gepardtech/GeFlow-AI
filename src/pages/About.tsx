import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ShieldCheck, Zap, Globe, Facebook, Instagram, Mail } from "lucide-react";
import aboutStory from "@/assets/about-story.jpg";
import sgBilal from "@/assets/sg-bilal.jpg";

const PinterestIcon = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345-.09.376-.293 1.193-.333 1.36-.052.218-.173.265-.4.16-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
  </svg>
);

const LEADER_SOCIALS = [
  { Icon: Facebook, href: "https://web.facebook.com/gepardweb/", label: "Facebook" },
  { Icon: Instagram, href: "https://www.instagram.com/gepardweb/", label: "Instagram" },
  { Icon: PinterestIcon, href: "https://www.pinterest.com/gepardwebs", label: "Pinterest" },
  { Icon: Mail, href: "mailto:gepardwebs@gmail.com", label: "Email" },
];

const pillars = [
  { Icon: ShieldCheck, title: "Pharmacy Precision", text: "We double-thought the inventory logic specifically for medical stores, where batch tracking and expiry dates are not just features — they are safety requirements." },
  { Icon: Zap, title: "Retail Velocity", text: "Retailers needed a system that wouldn't lag during peak hours. We built our POS terminal on a high-speed data-node architecture to ensure instant billing." },
  { Icon: Globe, title: "Warehouse Scale", text: "For large-scale warehouses, we implemented multi-branch synchronization, allowing global stock visibility from a single administrative hub." },
];

const faqs = [
  { q: "Who founded GeFlow?", a: "GeFlow was founded by SG Bilal under the Gepard Webs ecosystem, with a vision to redefine business operations through intelligent, lightweight cloud architecture." },
  { q: "What industries does GeFlow serve?", a: "We primarily serve pharmacies, retail outlets, supermarkets, warehouses, and small-to-medium enterprises that require precise inventory and sales control." },
  { q: "How secure is the platform?", a: "GeFlow uses end-to-end encryption, role-based access control, and PCI-DSS compliant payment infrastructure to keep your business data fully protected." },
  { q: "Does GeFlow work offline?", a: "Yes. Our POS terminal is designed with offline-first architecture — transactions sync automatically once connectivity is restored." },
  { q: "What is the GeFlow mission?", a: "To empower the next generation of business owners with operational clarity, automated workflows, and real-time financial intelligence." },
  { q: "Can I use my existing hardware?", a: "Absolutely. GeFlow runs on any modern browser and is compatible with standard barcode scanners, receipt printers, and cash drawers." },
  { q: "Is technical support available?", a: "Premium customers receive 24/7 priority support. All users have access to our knowledge base, video tutorials, and community forum." },
];

const About = () => (
  <Layout>
    {/* Hero */}
    <section className="pt-12 pb-16 text-center">
      <div className="container mx-auto px-4">
        <p className="text-[10px] font-bold tracking-[0.25em] text-primary mb-4">ABOUT GEFLOW • OUR MISSION</p>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-5 leading-tight">
          The Future of <span className="text-primary">Business</span><br/>Operating Systems
        </h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          GeFlow is more than software; it's a centralized intelligence node for the modern entrepreneur.
        </p>
      </div>
    </section>

    {/* Our Story */}
    <section className="py-12 bg-muted/40">
      <div className="container mx-auto px-4 max-w-5xl grid md:grid-cols-2 gap-10 items-center">
        <div>
          <h2 className="text-2xl font-bold mb-5">Our Story</h2>
          <p className="text-muted-foreground text-sm leading-relaxed mb-4">
            The journey of GeFlow began at <span className="text-foreground font-semibold">Gepard Webs</span>, where we observed a critical gap in how local businesses managed their lifecycles. Traditional methods were fragmented, error-prone, and slow.
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed mb-6">
            We spent years developing a core architecture that could handle the high-velocity demands of pharmacies and warehouses while remaining simple enough for a local retail store to use instantly.
          </p>
          <div className="flex gap-8">
            <div>
              <p className="text-2xl font-bold text-primary">10k+</p>
              <p className="text-[10px] font-bold tracking-wider text-muted-foreground">ACTIVE NODES</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-secondary">24/7</p>
              <p className="text-[10px] font-bold tracking-wider text-muted-foreground">UPTIME SLA</p>
            </div>
          </div>
        </div>
        <div className="premium-card overflow-hidden aspect-video">
          <img src={aboutStory} alt="GeFlow team building modern business operating system" loading="lazy" width={1280} height={896} className="w-full h-full object-cover" />
        </div>
      </div>
    </section>

    {/* Pillars */}
    <section className="py-16">
      <div className="container mx-auto px-4 max-w-6xl text-center">
        <h2 className="text-3xl font-bold mb-3">Why We Built GeFlow</h2>
        <p className="text-muted-foreground text-sm mb-10">Resolving the critical "e-selling" barriers for the foundation of commerce.</p>
        <div className="grid md:grid-cols-3 gap-6">
          {pillars.map(({ Icon, title, text }) => (
            <div key={title} className="premium-card p-7 text-left">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-5">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-bold mb-3">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Leadership */}
    <section className="py-16 bg-muted/40">
      <div className="container mx-auto px-4 max-w-md text-center">
        <h2 className="text-3xl font-bold mb-3">Leadership</h2>
        <p className="text-muted-foreground text-sm mb-10">The visionary expert at Gepard Tech bringing you the future of business operations.</p>
        <div className="premium-card p-8">
          <div className="h-28 w-28 rounded-2xl overflow-hidden mx-auto mb-5 ring-4 ring-primary/20">
            <img src={sgBilal} alt="SG Bilal — Chairman & CEO of Gepard Tech" loading="lazy" width={768} height={768} className="w-full h-full object-cover" />
          </div>
          <h3 className="font-bold text-lg">SG Bilal</h3>
          <p className="text-[10px] font-bold tracking-wider text-primary mb-4">CHAIRMAN &amp; CEO</p>
          <p className="text-sm text-muted-foreground leading-relaxed mb-5">
            Founder of <span className="text-foreground font-semibold">Gepard Tech</span> — the parent ecosystem behind GeFlow — SG Bilal is a full-stack developer and applied AI specialist. He architected GeFlow's real-time POS, inventory, and analytics engine to give pharmacies, retailers, and warehouses an intelligent operating system built for the AI era.
          </p>
          <div className="flex justify-center gap-2">
            {LEADER_SOCIALS.map(({ Icon, href, label }) => (
              <a
                key={label}
                href={href}
                target={href.startsWith("http") ? "_blank" : undefined}
                rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                aria-label={label}
                className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-primary-foreground hover:scale-110 transition-all"
              >
                <Icon size={15} />
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>

    {/* FAQ */}
    <section className="py-16">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold mb-3">Frequently Asked Questions</h2>
          <p className="text-muted-foreground text-sm">Detailed answers about our platform architecture and vision.</p>
        </div>
        <Accordion type="single" collapsible className="space-y-3">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`f${i}`} className="premium-card px-5 border-0">
              <AccordionTrigger className="font-bold text-sm text-left hover:no-underline">{f.q}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>

    {/* CTA */}
    <section className="pb-16">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="premium-card p-10 md:p-14 text-center bg-gradient-to-br from-primary/5 to-secondary/5">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Scale with Intelligence?</h2>
          <p className="text-muted-foreground text-sm mb-7 max-w-md mx-auto">
            Join the Gepard Webs ecosystem today and transform your operational data into a strategic asset.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button asChild className="cta-btn rounded-full px-7 h-12 text-xs font-bold tracking-wider">
              <Link to="/signup">CREATE WORKSPACE</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full px-7 h-12 text-xs font-bold tracking-wider border-2">
              <Link to="/features">VIEW FEATURE MATRIX</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  </Layout>
);

export default About;
