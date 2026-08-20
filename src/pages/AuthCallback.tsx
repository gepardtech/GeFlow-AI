import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { validateRedirectPath } from "@/lib/appUrl";
import { useToast } from "@/hooks/use-toast";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Layout from "@/components/Layout";
import { motion } from "motion/react";

type CallbackStatus = "processing" | "success" | "error";

export const AuthCallback = () => {
  const [status, setStatus] = useState<CallbackStatus>("processing");
  const [statusTitle, setStatusTitle] = useState("Verifying Authentication");
  const [statusMessage, setStatusMessage] = useState(
    "Establishing secure session with GeFlow Cloud..."
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [authType, setAuthType] = useState<string | null>(null);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    let isMounted = true;

    const processAuth = async () => {
      try {
        // 1. Check for error parameters in query string or URL hash
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(
          window.location.hash.replace(/^#/, "")
        );

        const errorDesc =
          urlParams.get("error_description") ||
          hashParams.get("error_description") ||
          urlParams.get("error") ||
          hashParams.get("error");

        if (errorDesc) {
          throw new Error(
            decodeURIComponent(errorDesc.replace(/\+/g, " "))
          );
        }

        // 2. Extract auth metadata
        const type =
          urlParams.get("type") ||
          hashParams.get("type") ||
          searchParams.get("type");
        setAuthType(type);

        const code = urlParams.get("code") || searchParams.get("code");
        const tokenHash =
          urlParams.get("token_hash") ||
          hashParams.get("token_hash") ||
          searchParams.get("token_hash");
        const nextParam =
          urlParams.get("next") ||
          urlParams.get("redirectTo") ||
          searchParams.get("next");

        // 3. Handle PKCE Code Exchange
        if (code) {
          setStatusTitle("Exchanging Security Token");
          setStatusMessage("Validating one-time cryptographic code...");
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } 
        // 4. Handle Direct OTP / Token Hash Verification
        else if (tokenHash && type) {
          setStatusTitle("Verifying Token Hash");
          setStatusMessage("Confirming token signature...");
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as any,
          });
          if (error) throw error;
        }

        // 5. Check active session
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!isMounted) return;

        setStatus("success");

        // Special routing for password recovery
        if (type === "recovery") {
          setStatusTitle("Password Recovery Verified");
          setStatusMessage("Redirecting to create your new password...");
          toast({
            title: "Recovery Verified",
            description: "Please enter your new password to secure your account.",
          });
          setTimeout(() => {
            navigate("/reset-password", { replace: true });
          }, 1200);
          return;
        }

        // Standard auth success routing
        setStatusTitle("Authentication Confirmed! 🎉");
        setStatusMessage("Setting up your workspace dashboard...");

        const userEmail = session?.user?.email?.toLowerCase() || "";
        const isAdmin = userEmail === "gepardwebs@gmail.com";

        // Determine destination
        let targetRoute = "/dashboard";
        if (nextParam) {
          targetRoute = validateRedirectPath(nextParam, "/dashboard");
        } else if (isAdmin) {
          targetRoute = "/admin";
        } else if (type === "signup" || type === "invite") {
          targetRoute = "/setup/business";
        }

        toast({
          title: "Welcome to GeFlow",
          description: "Your account is verified and ready to use.",
        });

        setTimeout(() => {
          navigate(targetRoute, { replace: true });
        }, 1200);

      } catch (err: any) {
        if (!isMounted) return;

        const rawMessage = err?.message || "Invalid or expired authentication link.";
        let cleanError = rawMessage;

        if (
          rawMessage.toLowerCase().includes("expired") ||
          rawMessage.toLowerCase().includes("otp") ||
          rawMessage.toLowerCase().includes("token")
        ) {
          cleanError =
            "This authentication link has expired or has already been used. Please request a fresh link below.";
        }

        setStatus("error");
        setErrorMessage(cleanError);
        toast({
          title: "Authentication Failed",
          description: cleanError,
          variant: "destructive",
        });
      }
    };

    processAuth();

    return () => {
      isMounted = false;
    };
  }, [navigate, searchParams, toast]);

  return (
    <Layout>
      <section className="min-h-[calc(100vh-140px)] flex items-center justify-center px-4 py-8 sm:py-16 bg-background">
        <div className="w-full max-w-lg rounded-3xl border border-border bg-card shadow-2xl shadow-primary/5 p-6 sm:p-10 text-center relative overflow-hidden">
          
          {/* Subtle background glow */}
          <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />

          {status === "processing" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              <div className="h-16 w-16 mx-auto rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shadow-inner">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>

              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Secure Handshake</span>
                </div>
                <h1 className="text-2xl font-black tracking-tight text-foreground">
                  {statusTitle}
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                  {statusMessage}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-muted/40 border border-border/80 text-xs text-muted-foreground flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                <span>Synchronizing session with live cloud server...</span>
              </div>
            </motion.div>
          )}

          {status === "success" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              <div className="h-16 w-16 mx-auto rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-bold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Verification Complete</span>
                </div>
                <h1 className="text-2xl font-black tracking-tight text-foreground">
                  {statusTitle}
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                  {statusMessage}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                Redirecting automatically in 1 second...
              </div>
            </motion.div>
          )}

          {status === "error" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6 text-left sm:text-center"
            >
              <div className="h-16 w-16 mx-auto rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center shadow-inner">
                <AlertCircle className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 text-rose-500 text-xs font-bold">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Verification Link Notice</span>
                </div>
                <h1 className="text-2xl font-black tracking-tight text-foreground">
                  Authentication Issue
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {errorMessage || "Unable to complete authentication with the provided link."}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-muted/40 border border-border text-xs text-muted-foreground text-left space-y-1.5">
                <p className="font-bold text-foreground">Possible reasons:</p>
                <ul className="list-disc list-inside space-y-1 leading-relaxed">
                  <li>The link has expired (links are time-sensitive for security).</li>
                  <li>The link has already been used once.</li>
                  <li>A newer recovery or verification email was requested.</li>
                </ul>
              </div>

              <div className="space-y-2.5 pt-2">
                {authType === "recovery" ? (
                  <Button
                    onClick={() => navigate("/forgot-password")}
                    className="w-full h-11 rounded-xl bg-hero-gradient text-primary-foreground font-bold text-xs sm:text-sm shadow-md shadow-primary/20 border-0 flex items-center justify-center gap-2"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>Request New Password Reset Link</span>
                  </Button>
                ) : (
                  <Button
                    onClick={() => navigate("/login")}
                    className="w-full h-11 rounded-xl bg-hero-gradient text-primary-foreground font-bold text-xs sm:text-sm shadow-md shadow-primary/20 border-0 flex items-center justify-center gap-2"
                  >
                    <ArrowRight className="w-4 h-4" />
                    <span>Go to Sign In</span>
                  </Button>
                )}

                <Button
                  variant="outline"
                  onClick={() => navigate("/contact")}
                  className="w-full h-10 rounded-xl text-xs font-medium border-border"
                >
                  Contact Support Desk
                </Button>
              </div>
            </motion.div>
          )}

        </div>
      </section>
    </Layout>
  );
};

export default AuthCallback;
