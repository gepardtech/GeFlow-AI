import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, Moon, Sun, User } from "lucide-react";
import { usePlatformSettings } from "@/components/PlatformSettingsProvider";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "How It Works", href: "/how-it-works" },
  { label: "Features", href: "/features" },
  { label: "Pricing", href: "/pricing" },
  { label: "Contact", href: "/contact" },
];

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark");
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const { settings } = usePlatformSettings();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-background/80 backdrop-blur-xl shadow-sm border-b border-border/50" : "bg-background"}`}>
      <div className="container mx-auto flex items-center justify-between h-16 px-4">
        {/* Left: Logo */}
        <Link to="/" className="flex items-center gap-2 flex-shrink-0">
          {settings?.logo_url ? (
            <img src={settings.logo_url} alt={settings?.app_name ?? "GeFlow"} className="h-8 max-w-[150px] object-contain" />
          ) : (
            <>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className="text-primary">
                <path d="M14 2L4 8v12l10 6 10-6V8L14 2z" stroke="currentColor" strokeWidth="2" fill="none"/>
                <path d="M14 8l-5 3v6l5 3 5-3v-6l-5-3z" fill="currentColor" opacity="0.3"/>
              </svg>
              <span className="font-bold text-lg text-foreground">{settings?.app_name ?? "GeFlow"}</span>
            </>
          )}
        </Link>

        {/* Center: Nav links */}
        <div className="hidden lg:flex items-center gap-7">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              to={l.href}
              className={`text-sm font-medium transition-colors hover:text-primary whitespace-nowrap ${
                location.pathname === l.href ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Right: Toggle + Auth */}
        <div className="hidden lg:flex items-center gap-3 flex-shrink-0">
          {/* Day/Night Toggle Switch */}
          <button
            onClick={() => setDark(!dark)}
            className={`theme-toggle ${dark ? "dark-active" : ""}`}
            aria-label="Toggle dark mode"
          >
            <span className="absolute left-1.5 top-1/2 -translate-y-1/2 z-10">
              <Sun size={13} className={`transition-opacity duration-300 ${dark ? "opacity-40" : "opacity-100 text-amber-500"}`} />
            </span>
            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 z-10">
              <Moon size={13} className={`transition-opacity duration-300 ${dark ? "opacity-100 text-primary-foreground" : "opacity-40"}`} />
            </span>
          </button>

          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <Link to="/login"><User size={15} /> Login</Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/signup">Get Started</Link>
          </Button>
        </div>

        {/* Mobile */}
        <div className="lg:hidden flex items-center gap-2">
          <button
            onClick={() => setDark(!dark)}
            className={`theme-toggle scale-90 ${dark ? "dark-active" : ""}`}
            aria-label="Toggle dark mode"
          >
            <span className="absolute left-1.5 top-1/2 -translate-y-1/2 z-10">
              <Sun size={12} className={`transition-opacity duration-300 ${dark ? "opacity-40" : "opacity-100 text-amber-500"}`} />
            </span>
            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 z-10">
              <Moon size={12} className={`transition-opacity duration-300 ${dark ? "opacity-100 text-primary-foreground" : "opacity-40"}`} />
            </span>
          </button>
          <button className="text-foreground p-1" onClick={() => setOpen(!open)}>
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="lg:hidden bg-background border-b border-border px-4 pb-4">
          {navLinks.map((l) => (
            <Link key={l.href} to={l.href} onClick={() => setOpen(false)}
              className="block py-2.5 text-sm font-medium text-muted-foreground hover:text-primary">{l.label}</Link>
          ))}
          <div className="flex flex-col gap-2 mt-3">
            <Button variant="outline" size="sm" asChild>
              <Link to="/login" onClick={() => setOpen(false)}>Login</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/signup" onClick={() => setOpen(false)}>Get Started</Link>
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
