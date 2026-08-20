import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { getAuthRedirectUrl } from "@/lib/appUrl";
import { useToast } from "@/hooks/use-toast";
import { Camera, CheckCircle2, Eye, EyeOff, Heart, Loader2, Lock, Mail, ShieldCheck, Sparkles, User } from "lucide-react";

const Signup = () => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(true);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptTerms) {
      toast({ title: "Terms Agreement Required", description: "Please accept the terms to proceed.", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Passwords don't match", description: "Ensure both password fields match exactly.", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Password Too Short", description: "Password must contain at least 6 characters.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, plan: "free" },
        emailRedirectTo: getAuthRedirectUrl("/auth/callback"),
      },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Signup failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Account created!", description: "Welcome to GeFlow 🚀" });
      // With auto-confirm on, the user is signed in. Route by role.
      if (data.session) {
        if (email.toLowerCase() === "gepardwebs@gmail.com") navigate("/admin");
        else navigate("/setup/business");
      } else {
        navigate("/login");
      }
    }
  };

  return (
    <Layout>
      <section className="min-h-[calc(100vh-140px)] flex items-center justify-center px-3 sm:px-6 py-6 sm:py-12 bg-background">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl shadow-primary/5 border border-border bg-card min-w-0">
          {/* LEFT — Welcome Panel */}
          <div className="relative bg-hero-gradient p-6 sm:p-8 md:p-10 lg:p-12 flex flex-col justify-center text-primary-foreground overflow-hidden order-2 lg:order-1">
            <div className="absolute -top-20 -left-20 h-60 w-60 rounded-full bg-white/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -right-20 h-60 w-60 rounded-full bg-secondary/30 blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-6">
              <div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mb-2 flex items-center gap-2.5">
                  Join GeFlow Today <span className="text-2xl sm:text-3xl">✨</span>
                </h2>
                <p className="text-primary-foreground/90 text-xs sm:text-sm leading-relaxed max-w-md">
                  Unlock the full power of real-time intelligence, high-speed POS checkouts, and seamless multi-store operations.
                </p>
              </div>

              <ul className="space-y-3 sm:space-y-4">
                {[
                  { icon: Camera, title: "AI Image & Receipt Scanning", desc: "Automated batch barcode generation and intelligent OCR parsing" },
                  { icon: Heart, title: "Executive Margin Reports", desc: "Deep financial breakdowns, FIFO cost accounting, and tax filing digests" },
                  { icon: ShieldCheck, title: "Enterprise Cloud Security", desc: "Realtime data encryption, automatic backups, and multi-user RBAC" },
                ].map(({ icon: Icon, title, desc }) => (
                  <li key={title} className="flex items-start gap-3 p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15">
                    <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-white leading-tight">{title}</p>
                      <p className="text-[11px] text-white/80 leading-tight mt-0.5">{desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* RIGHT — Form */}
          <div className="p-5 sm:p-8 md:p-10 lg:p-12 flex flex-col justify-center order-1 lg:order-2 min-w-0">
            <div className="mb-6 sm:mb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Get Started in Seconds</span>
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-foreground">
                Create Account
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1.5">
                Set up your free business workspace and start selling today.
              </p>
            </div>

            <form onSubmit={handleSignup} className="space-y-3.5 sm:space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="signup-name" className="text-xs font-bold text-foreground">
                  Full Name
                </Label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    id="signup-name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    placeholder="John Doe"
                    className="h-11 sm:h-12 pl-10 rounded-xl sm:rounded-2xl text-xs sm:text-sm bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="signup-email" className="text-xs font-bold text-foreground">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="name@company.com"
                    className="h-11 sm:h-12 pl-10 rounded-xl sm:rounded-2xl text-xs sm:text-sm bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="signup-password" className="text-xs font-bold text-foreground">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    id="signup-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    placeholder="•••••••• (Min 6 chars)"
                    className="h-11 sm:h-12 pl-10 pr-11 rounded-xl sm:rounded-2xl text-xs sm:text-sm bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="signup-confirm" className="text-xs font-bold text-foreground">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    id="signup-confirm"
                    type={showPassword ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="h-11 sm:h-12 pl-10 rounded-xl sm:rounded-2xl text-xs sm:text-sm bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </div>
              </div>

              <div className="pt-1">
                <label className="inline-flex items-start gap-2.5 text-xs text-muted-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border text-primary accent-primary focus:ring-primary"
                  />
                  <span>
                    I agree to the{" "}
                    <Link to="/terms" className="text-primary font-bold hover:underline">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link to="/privacy" className="text-primary font-bold hover:underline">
                      Privacy Policy
                    </Link>
                    .
                  </span>
                </label>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 sm:h-12 rounded-xl sm:rounded-2xl bg-hero-gradient text-primary-foreground font-bold text-xs sm:text-sm hover:opacity-95 transition-all shadow-md shadow-primary/20 border-0 flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creating Workspace...</span>
                  </>
                ) : (
                  <span>Create Free Account</span>
                )}
              </Button>
            </form>

            <p className="text-center text-xs sm:text-sm text-muted-foreground mt-6">
              Already have an account?{" "}
              <Link to="/login" className="text-primary font-bold hover:underline">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Signup;
