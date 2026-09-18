import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Shield,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    let session = null;
    let authError: string | null = null;

    try {
      const apiRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (apiRes.ok) {
        const apiJson = await apiRes.json();
        if (apiJson?.success && apiJson?.session) {
          session = apiJson.session;
          await supabase.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          });
        }
      }

      if (!session) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          authError = error.message;
        } else if (data?.session) {
          session = data.session;
        }
      }

      if (!session) {
        toast({
          title: "Login failed",
          description:
            authError ||
            "Invalid email or password. Please verify your credentials or register.",
          variant: "destructive",
        });
        return;
      }

      toast({ title: "Welcome back!" });

      try {
        localStorage.removeItem("geflow_cached_plan_state");
        localStorage.removeItem("geflow_cached_owned_businesses");
        localStorage.removeItem("geflow_cached_staff_businesses");
        localStorage.removeItem("geflow.activeBusinessId");
      } catch {}

      const isAdmin = email.trim().toLowerCase() === "gepardwebs@gmail.com";
      window.location.replace(isAdmin ? "/admin" : "/dashboard");
    } catch (err: any) {
      toast({
        title: "Login error",
        description: err?.message || "Failed to log in. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <section className="min-h-[calc(100vh-140px)] flex items-center justify-center px-3 sm:px-6 py-6 sm:py-12 bg-background">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl shadow-primary/5 border border-border bg-card min-w-0">
          <div className="p-5 sm:p-8 md:p-10 lg:p-12 flex flex-col justify-center min-w-0">
            <div className="mb-6 sm:mb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                <span>GeFlow Authentication</span>
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-foreground">
                Sign In
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1.5">
                Enter your registered credentials to access your store workspace.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="login-email" className="text-xs font-bold text-foreground">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    id="login-email"
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
                <div className="flex items-center justify-between">
                  <Label htmlFor="login-password" className="text-xs font-bold text-foreground">
                    Password
                  </Label>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Forgot Password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
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

              <div className="flex items-center justify-between pt-1">
                <label className="inline-flex items-center gap-2 text-xs sm:text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary accent-primary focus:ring-primary"
                  />
                  <span className="text-muted-foreground font-medium">Keep me signed in</span>
                </label>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 sm:h-12 rounded-xl sm:rounded-2xl bg-hero-gradient text-primary-foreground font-bold text-xs sm:text-sm hover:opacity-95 transition-all shadow-md shadow-primary/20 border-0 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <span>Sign In to Dashboard</span>
                )}
              </Button>
            </form>

            <p className="text-center text-xs sm:text-sm text-muted-foreground mt-6">
              Don't have an account yet?{" "}
              <Link to="/signup" className="text-primary font-bold hover:underline">
                Create Free Account
              </Link>
            </p>
          </div>

          <div className="relative bg-hero-gradient p-6 sm:p-8 md:p-10 lg:p-12 flex flex-col justify-center text-primary-foreground overflow-hidden">
            <div className="absolute -top-20 -right-20 h-60 w-60 rounded-full bg-white/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-secondary/30 blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-6">
              <div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mb-2 flex items-center gap-2.5">
                  Welcome Back <span className="text-2xl sm:text-3xl">🚀</span>
                </h2>
                <p className="text-primary-foreground/90 text-xs sm:text-sm leading-relaxed max-w-md">
                  Log in to manage your inventory, process high-speed POS orders, and track your multi-store margins in real time.
                </p>
              </div>

              <ul className="space-y-3 sm:space-y-4">
                {[
                  {
                    icon: Zap,
                    title: "High-Speed POS & Billing",
                    desc: "Thermal receipt printing and cash drawer kick integration",
                  },
                  {
                    icon: TrendingUp,
                    title: "Realtime Profit Analytics",
                    desc: "Automated FIFO margin accounting and multi-currency metrics",
                  },
                  {
                    icon: Shield,
                    title: "Multi-Location Security",
                    desc: "Role-gated employee permissions and audit logging",
                  },
                ].map(({ icon: Icon, title, desc }) => (
                  <li
                    key={title}
                    className="flex items-start gap-3 p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15"
                  >
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
        </div>
      </section>
    </Layout>
  );
};

export default Login;