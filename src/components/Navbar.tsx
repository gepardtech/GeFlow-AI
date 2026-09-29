import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, Moon, Sun, User } from "lucide-react";
import { usePlatformSettings } from "@/components/PlatformSettingsProvider";
import AnnouncementBar from "@/components/AnnouncementBar";

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
      <AnnouncementBar audience="public" />
      <div className="container mx-auto flex items-center justify-between h-16 px-4">
        {/* Left: Logo */}
        <Link to="/" className="flex items-center gap-2.5 flex-shrink-0 group">
          {settings?.logo_url ? (
            <img src={settings.logo_url} alt={settings?.app_name ?? "GeFlow"} className="h-8 max-w-[150px] object-contain" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-sky-400 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-xs">
              {(settings?.app_name || "G").charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-base text-foreground leading-none group-hover:text-primary transition-colors">
              {settings?.app_name ?? "GeFlow"}
            </span>
            {settings?.tagline && (
              <span className="text-[10px] text-muted-foreground font-medium truncate leading-tight mt-0.5 max-w-[200px] sm:max-w-xs">
                {settings.tagline}
              </span>
            )}
          </div>
        </Link>

        {/* Center: Nav links */}
        <div className="hidden lg:flex items-center gap-7">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              to={l.href}
              onClick={() => window.scrollTo({ top: 0, left: 0, behavior: "instant" })}
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
