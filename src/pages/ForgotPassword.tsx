import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { getPasswordResetRedirectUrl } from "@/lib/appUrl";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  KeyRound,
  Loader2,
  Mail,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  Lock,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();

  // Handle countdown timer for resending email
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleResetRequest = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const targetEmail = email.trim();
    if (!targetEmail) {
      toast({
        title: "Email Required",
        description: "Please enter your registered email address.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const redirectUrl = getPasswordResetRedirectUrl();
      const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: redirectUrl,
      });

      if (error) {
        // Check for common rate limit or configuration errors
        if (error.message.toLowerCase().includes("rate limit") || error.status === 429) {
          setErrorMessage("Too many requests sent recently. Please wait a minute before requesting another reset email.");
        } else {
          setErrorMessage(error.message);
        }
        toast({
          title: "Reset Request Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        setSubmitted(true);
        setSubmittedEmail(targetEmail);
        setResendCooldown(60); // 60 seconds cooldown to prevent rate limiting
        toast({
          title: "Recovery Link Dispatched 🚀",
          description: `Password recovery instructions have been sent to ${targetEmail}`,
        });
      }
    } catch (err: any) {
      const msg = err?.message || "An unexpected error occurred while sending the reset link.";
      setErrorMessage(msg);
      toast({
        title: "Error",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || loading) return;
    await handleResetRequest();
  };

  return (
    <Layout>
      <section className="min-h-[calc(100vh-140px)] flex items-center justify-center px-3 sm:px-6 py-6 sm:py-12 bg-background">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl shadow-primary/5 border border-border bg-card min-w-0">
          
          {/* LEFT PANEL: Form & Status */}
          <div className="p-5 sm:p-8 md:p-10 lg:p-12 flex flex-col justify-center min-w-0">
            <AnimatePresence mode="wait">
              {!submitted ? (
                /* STEP 1: Enter Email Form */
                <motion.div
                  key="request-form"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-6"
                >
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold mb-3">
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Security & Recovery</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-foreground">
                      Forgot Password?
                    </h1>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 leading-relaxed">
                      Don't worry, it happens! Enter your registered account email and we'll immediately send you a secure password recovery link.
                    </p>
                  </div>

                  {errorMessage && (
                    <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-xs leading-relaxed">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Recovery Notice</p>
                        <p className="opacity-90">{errorMessage}</p>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleResetRequest} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="forgot-email" className="text-xs font-bold text-foreground">
                        Account Email Address
                      </Label>
                      <div className="relative">
                        <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        <Input
                          id="forgot-email"
                          type="email"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if (errorMessage) setErrorMessage(null);
                          }}
                          required
                          autoFocus
                          autoComplete="email"
                          placeholder="name@company.com"
                          className="h-11 sm:h-12 pl-10 rounded-xl sm:rounded-2xl text-xs sm:text-sm bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary"
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        A one-time verification link synced with Supabase authentication will be delivered to this address.
                      </p>
                    </div>

                    <Button
                      type="submit"
                      disabled={loading || !email.trim()}
                      className="w-full h-11 sm:h-12 rounded-xl sm:rounded-2xl bg-hero-gradient text-primary-foreground font-bold text-xs sm:text-sm hover:opacity-95 transition-all shadow-md shadow-primary/20 border-0 flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Generating Secure Link...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>Send Recovery Link</span>
                        </>
                      )}
                    </Button>
                  </form>

                  <div className="pt-2 border-t border-border flex items-center justify-between">
                    <Link
                      to="/login"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back to Sign In</span>
                    </Link>

                    <Link
                      to="/signup"
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Create New Account
                    </Link>
                  </div>
                </motion.div>
              ) : (
                /* STEP 2: Email Dispatched Confirmation */
                <motion.div
                  key="success-confirmation"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-6"
                >
                  <div className="flex flex-col items-start gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center shadow-sm">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                        Check Your Inbox
                      </h2>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                        We have dispatched password recovery instructions to:
                      </p>
                      <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted/60 border border-border text-xs font-mono font-bold text-foreground">
                        <Mail className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="truncate max-w-[280px] sm:max-w-xs">{submittedEmail}</span>
                      </div>
                    </div>
                  </div>

                  {/* Step list guide */}
                  <div className="p-4 rounded-2xl bg-muted/30 border border-border/80 space-y-3">
                    <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                      <span>Next Steps to Recover Your Account:</span>
                    </p>
                    <ol className="space-y-2 text-xs text-muted-foreground list-decimal list-inside leading-relaxed">
                      <li>Open the email sent from <strong className="text-foreground">GeFlow Cloud</strong>.</li>
                      <li>Click the <strong className="text-foreground">"Reset Password"</strong> link (valid for 60 minutes).</li>
                      <li>Choose your new secure password on the reset page.</li>
                    </ol>
                    <p className="text-[11px] text-muted-foreground/80 italic pt-1 border-t border-border/50">
                      💡 Note: If you don't see the email within a minute, check your Spam or Junk folder.
                    </p>
                  </div>

                  {/* Resend Action */}
                  <div className="space-y-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleResend}
                      disabled={resendCooldown > 0 || loading}
                      className="w-full h-11 rounded-xl text-xs sm:text-sm font-semibold border-border bg-card hover:bg-muted flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : resendCooldown > 0 ? (
                        <>
                          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>Resend available in {resendCooldown}s</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 text-primary" />
                          <span>Resend Recovery Email</span>
                        </>
                      )}
                    </Button>

                    <div className="flex items-center justify-between text-xs font-medium pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSubmitted(false);
                          setErrorMessage(null);
                        }}
                        className="text-primary hover:underline font-semibold"
                      >
                        Try different email address
                      </button>

                      <Link
                        to="/login"
                        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground font-bold"
                      >
                        <ArrowLeft className="w-3 h-3" />
                        <span>Return to Sign In</span>
                      </Link>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* RIGHT PANEL: Enterprise Security & Brand Highlights */}
          <div className="relative bg-hero-gradient p-6 sm:p-8 md:p-10 lg:p-12 flex flex-col justify-center text-primary-foreground overflow-hidden">
            <div className="absolute -top-20 -right-20 h-60 w-60 rounded-full bg-white/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-secondary/30 blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs font-bold mb-3">
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-300" />
                  <span>Bank-Grade Auth Guard</span>
                </div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mb-2 flex items-center gap-2.5">
                  Safe Account Recovery <span className="text-2xl sm:text-3xl">🔐</span>
                </h2>
                <p className="text-primary-foreground/90 text-xs sm:text-sm leading-relaxed max-w-md">
                  Your store credentials and point-of-sale data are safeguarded with end-to-end encrypted recovery tokens and automated security monitoring.
                </p>
              </div>

              <ul className="space-y-3 sm:space-y-4">
                {[
                  {
                    icon: ShieldCheck,
                    title: "One-Time Cryptographic Tokens",
                    desc: "Recovery links expire automatically after single use to prevent unauthorized session hijacking.",
                  },
                  {
                    icon: Lock,
                    title: "Zero-Knowledge Encryption",
                    desc: "Passwords are salted with industry-standard bcrypt hashing — never stored in plain text.",
                  },
                  {
                    icon: RefreshCw,
                    title: "Instant Session Invalidation",
                    desc: "Updating your password automatically secures your active sessions across all devices.",
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

              <div className="pt-2">
                <p className="text-[11px] text-primary-foreground/70">
                  Need direct assistance? Contact our 24/7 security desk at{" "}
                  <a href="mailto:gepardwebs@gmail.com" className="text-white underline font-semibold">
                    gepardwebs@gmail.com
                  </a>
                </p>
              </div>
            </div>
          </div>

        </div>
      </section>
    </Layout>
  );
};

export default ForgotPassword;
