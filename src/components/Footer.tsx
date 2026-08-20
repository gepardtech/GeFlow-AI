import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Facebook, Instagram, Mail } from "lucide-react";
import { usePlatformSettings } from "@/components/PlatformSettingsProvider";

const PinterestIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345-.09.376-.293 1.193-.333 1.36-.052.218-.173.265-.4.16-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
  </svg>
);

const SOCIALS = [
  { Icon: Facebook, href: "https://web.facebook.com/gepardweb/", label: "Facebook" },
  { Icon: Instagram, href: "https://www.instagram.com/gepardweb/", label: "Instagram" },
  { Icon: PinterestIcon, href: "https://www.pinterest.com/gepardwebs", label: "Pinterest" },
  { Icon: Mail, href: "mailto:gepardwebs@gmail.com", label: "Email" },
];

const Footer = () => {
  const { settings } = usePlatformSettings();
  return (
  <footer className="border-t border-border bg-background py-16">
    <div className="container mx-auto px-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
        {/* Brand */}
        <div className="col-span-2 md:col-span-1">
          <Link to="/" className="flex items-center gap-2 mb-4">
            {settings?.logo_url ? (
              <img src={settings.logo_url} alt={settings?.app_name ?? "GeFlow"} className="h-8 max-w-[150px] object-contain" />
            ) : (
              <>
                <svg width="24" height="24" viewBox="0 0 28 28" fill="none" className="text-primary">
                  <path d="M14 2L4 8v12l10 6 10-6V8L14 2z" stroke="currentColor" strokeWidth="2" fill="none"/>
                  <path d="M14 8l-5 3v6l5 3 5-3v-6l-5-3z" fill="currentColor" opacity="0.3"/>
                </svg>
                <span className="font-bold text-lg text-primary">{settings?.app_name ?? "GeFlow"}</span>
              </>
            )}
          </Link>
          <p className="text-muted-foreground text-sm leading-relaxed mb-4">
            GeFlow is a modern business operating system designed to manage inventory, sales, and profit tracking in real time.
          </p>
          <div className="flex gap-2">
            {SOCIALS.map(({ Icon, href, label }) => (
              <a
                key={label}
                href={href}
                target={href.startsWith("http") ? "_blank" : undefined}
                rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                aria-label={label}
                className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-primary-foreground hover:scale-110 hover:shadow-lg hover:shadow-primary/30 transition-all duration-300"
              >
                <Icon size={16} />
              </a>
            ))}
          </div>
        </div>

        {/* Quick Links */}
        <div>
          <h4 className="font-bold text-sm mb-4">Quick Links</h4>
          <div className="flex flex-col gap-2.5">
            <Link to="/" className="text-muted-foreground text-sm hover:text-primary transition-colors">Home</Link>
            <Link to="/how-it-works" className="text-muted-foreground text-sm hover:text-primary transition-colors">How It Works</Link>
            <Link to="/features" className="text-muted-foreground text-sm hover:text-primary transition-colors">Features</Link>
            <Link to="/pricing" className="text-muted-foreground text-sm hover:text-primary transition-colors">Pricing</Link>
            <Link to="/contact" className="text-muted-foreground text-sm hover:text-primary transition-colors">Contact</Link>
          </div>
        </div>

        {/* Legal */}
        <div>
          <h4 className="font-bold text-sm mb-4">Legal</h4>
          <div className="flex flex-col gap-2.5">
            <Link to="/about" className="text-muted-foreground text-sm hover:text-primary transition-colors">About</Link>
            <Link to="/privacy" className="text-muted-foreground text-sm hover:text-primary transition-colors">Privacy Policy</Link>
            <Link to="/refund" className="text-muted-foreground text-sm hover:text-primary transition-colors">Refund Policy</Link>
            <Link to="/terms" className="text-muted-foreground text-sm hover:text-primary transition-colors">Terms of Service</Link>
            <Link to="/disclaimer" className="text-muted-foreground text-sm hover:text-primary transition-colors">Disclaimer</Link>
          </div>
        </div>

        {/* Newsletter */}
        <div>
          <h4 className="font-bold text-sm mb-4">Newsletter</h4>
          <p className="text-muted-foreground text-sm mb-3">Get our latest news and updates right in your inbox.</p>
          <div className="flex gap-2">
            <Input placeholder="Enter your email" className="text-sm h-9" />
            <Button size="sm" className="h-9 px-3">
              <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-6 text-center text-muted-foreground text-sm">
        © {new Date().getFullYear()}{" "}
        <Link to="/" className="font-semibold text-foreground hover:text-primary transition-colors">GeFlow AI</Link>
        . All rights reserved. Powered by{" "}
        <a
          href="https://gepardtechs.com"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-foreground hover:text-primary transition-colors"
        >
          Gepard Techs
        </a>
        .
      </div>
    </div>
  </footer>
  );
};

export default Footer;
