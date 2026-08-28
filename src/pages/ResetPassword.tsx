import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  HelpCircle,
} from "lucide-react";
import { motion } from "motion/react";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [isRecoverySessionActive, setIsRecoverySessionActive] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Manual OTP entry mode (for users who received a 6-digit code in their email)
  const [manualOtpMode, setManualOtpMode] = useState(false);
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    let isMounted = true;

    // Listen to Supabase Auth state change specifically for PASSWORD_RECOVERY events
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        if (isMounted) {
          setIsRecoverySessionActive(true);
          sessionStorage.setItem("geflow_auth_is_recovery_session", "true");
        }
      }
      if (isMounted) setCheckingSession(false);
    });

    const initAuth = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const hash = window.location.hash || "";
        const hashParams = new URLSearchParams(hash.replace(/^#/, ""));

        const isRecoveryHash =
          hash.includes("type=recovery") ||
          hashParams.get("type") === "recovery" ||
          (hash.includes("access_token") && hash.includes("type=recovery"));

        const code = urlParams.get("code") || searchParams.get("code");
        const tokenHash = urlParams.get("token_hash") || searchParams.get("token_hash");
        const type = urlParams.get("type") || searchParams.get("type") || hashParams.get("type");

        // Case A: PKCE code exchange from email link
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error && isMounted) {
            setIsRecoverySessionActive(true);
            sessionStorage.setItem("geflow_auth_is_recovery_session", "true");
          }
        }
        // Case B: Direct Token Hash verification from email link
        else if (tokenHash && type === "recovery") {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: "recovery",
          });
          if (!error && isMounted) {
            setIsRecoverySessionActive(true);
            sessionStorage.setItem("geflow_auth_is_recovery_session", "true");
          }
        }
        // Case C: Supabase recovery hash in URL (access_token#type=recovery)
        else if (isRecoveryHash) {
          setIsRecoverySessionActive(true);
          sessionStorage.setItem("geflow_auth_is_recovery_session", "true");
        }
        // Case D: Active session flagged specifically as recovery session
        else {
          const isRecoveryFlagged = sessionStorage.getItem("geflow_auth_is_recovery_session") === "true";
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session && isRecoveryFlagged && isMounted) {
            setIsRecoverySessionActive(true);
          } else {
            // User typed URL manually without valid recovery email token / session
            setIsRecoverySessionActive(false);
          }
        }
      } catch (err) {
        console.error("Auth initialization error in ResetPassword:", err);
      } finally {
        if (isMounted) setCheckingSession(false);
      }
    };

    initAuth();

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [searchParams]);

  // Real-time password strength calculation
  const hasMinLength = password.length >= 8;
  const hasUpperLower = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const isMatch = password && confirmPassword && password === confirmPassword;

  const strengthScore = [
    password.length >= 6,
    hasMinLength,
    hasUpperLower,
    hasNumber,
    hasSpecial,
  ].filter(Boolean).length;

  const getStrengthLabel = () => {
    if (!password) return { text: "None", color: "bg-muted text-muted-foreground", width: "w-0" };
    if (strengthScore <= 2) return { text: "Weak", color: "bg-rose-500", width: "w-1/4" };
    if (strengthScore === 3) return { text: "Fair", color: "bg-amber-500", width: "w-2/4" };
    if (strengthScore === 4) return { text: "Good", color: "bg-sky-500", width: "w-3/4" };
    return { text: "Strong", color: "bg-emerald-500", width: "w-full" };
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setErrorMessage("Password must contain at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match. Please ensure both fields are identical.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        setErrorMessage(error.message);
        toast({
          title: "Password Update Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        // Clear recovery session state on success
        sessionStorage.removeItem("geflow_auth_is_recovery_session");
        setResetSuccess(true);
        toast({
          title: "Password Reset Successful! 🎉",
          description: "Your new password has been saved. You can now log in securely.",
        });
      }
    } catch (err: any) {
      const msg = err?.message || "An unexpected error occurred while resetting your password.";
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpEmail || !otpCode) {
      toast({
        title: "Missing Information",
        description: "Please enter both your email address and the 6-digit code.",
        variant: "destructive",
      });
      return;
    }

    setVerifyingOtp(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: otpEmail.trim(),
        token: otpCode.trim(),
        type: "recovery",
      });

      if (error) {
        setErrorMessage(error.message);
        toast({
          title: "Verification Failed",
          description: error.message,
          variant: "destructive",
        });
      } else if (data.session) {
        setIsRecoverySessionActive(true);
        sessionStorage.setItem("geflow_auth_is_recovery_session", "true");
        setManualOtpMode(false);
        toast({
          title: "Code Verified! 🔒",
          description: "Please enter your new password below.",
        });
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to verify security code.");
    } finally {
      setVerifyingOtp(false);
    }
  };

  const strength = getStrengthLabel();

  return (
    <Layout>
      <section className="min-h-[calc(100vh-140px)] flex items-center justify-center px-3 sm:px-6 py-6 sm:py-12 bg-background">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl shadow-primary/5 border border-border bg-card min-w-0">
          
          {/* LEFT PANEL: Password Reset Form / Restricted Access States */}
          <div className="p-5 sm:p-8 md:p-10 lg:p-12 flex flex-col justify-center min-w-0">
            {checkingSession ? (
              <div className="py-16 flex flex-col items-center justify-center text-center space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm font-semibold text-muted-foreground">
                  Verifying security credentials & email token...
                </p>
              </div>
            ) : resetSuccess ? (
              /* SUCCESS STATE */
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6 text-center sm:text-left"
              >
                <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center shadow-sm">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                    Password Reset Complete
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 leading-relaxed">
                    Your password has been successfully updated and secured across all GeFlow services.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 space-y-1.5 font-medium">
                  <p className="font-bold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" /> Account Protected
                  </p>
                  <p>
                    All prior recovery tokens and old passwords have been permanently invalidated. You can now use your new password to access your dashboard.
                  </p>
                </div>

                <div className="pt-2">
                  <Button
                    onClick={() => navigate("/login")}
                    className="w-full h-11 sm:h-12 rounded-xl sm:rounded-2xl bg-hero-gradient text-primary-foreground font-bold text-xs sm:text-sm hover:opacity-95 transition-all shadow-md shadow-primary/20 border-0 flex items-center justify-center gap-2"
                  >
                    <span>Sign In with New Password</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            ) : isRecoverySessionActive ? (
              /* ACTIVE RESET FORM (ACCESSED VIA EMAIL TOKEN ONLY) */
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold mb-3">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Email Link Verified</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                    Set New Password
                  </h1>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1.5">
                    Please choose a strong, unique password to secure your workspace and billing records.
                  </p>
                </div>

                {errorMessage && (
                  <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-xs leading-relaxed">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Password Reset Error</p>
                      <p className="opacity-90">{errorMessage}</p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  {/* New Password Input */}
                  <div className="space-y-1.5">
                    <Label htmlFor="new-password" className="text-xs font-bold text-foreground">
                      New Password
                    </Label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                      <Input
                        id="new-password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (errorMessage) setErrorMessage(null);
                        }}
                        required
                        minLength={6}
                        autoFocus
                        placeholder="•••••••• (Min 6 characters)"
                        className="h-11 sm:h-12 pl-10 pr-11 rounded-xl sm:rounded-2xl text-xs sm:text-sm bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-muted-foreground hover:text-foreground focus:outline-none"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>

                    {/* Live Strength Bar */}
                    {password && (
                      <div className="space-y-1 pt-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">Strength:</span>
                          <span className="font-bold capitalize">{strength.text}</span>
                        </div>
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                          <div className={`h-full ${strength.color} ${strength.width} transition-all duration-300 rounded-full`} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Confirm Password Input */}
                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-new-password" className="text-xs font-bold text-foreground">
                      Confirm New Password
                    </Label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                      <Input
                        id="confirm-new-password"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          if (errorMessage) setErrorMessage(null);
                        }}
                        required
                        minLength={6}
                        placeholder="••••••••"
                        className="h-11 sm:h-12 pl-10 pr-11 rounded-xl sm:rounded-2xl text-xs sm:text-sm bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((s) => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-muted-foreground hover:text-foreground focus:outline-none"
                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>

                    {confirmPassword && (
                      <div className="flex items-center gap-1.5 text-[11px] pt-0.5">
                        {isMatch ? (
                          <span className="text-emerald-500 flex items-center gap-1 font-semibold">
                            <Check className="w-3.5 h-3.5" /> Passwords match
                          </span>
                        ) : (
                          <span className="text-destructive flex items-center gap-1 font-medium">
                            <AlertCircle className="w-3.5 h-3.5" /> Passwords do not match
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Security requirements checklist */}
                  <div className="p-3 rounded-2xl bg-muted/30 border border-border/80 text-[11px] text-muted-foreground space-y-1">
                    <p className="font-bold text-foreground mb-1">Password Recommendations:</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <span className={`flex items-center gap-1 ${password.length >= 6 ? "text-emerald-500 font-semibold" : ""}`}>
                        <Check className="w-3 h-3" /> Min 6 characters
                      </span>
                      <span className={`flex items-center gap-1 ${hasUpperLower ? "text-emerald-500 font-semibold" : ""}`}>
                        <Check className="w-3 h-3" /> Upper & lowercase
                      </span>
                      <span className={`flex items-center gap-1 ${hasNumber ? "text-emerald-500 font-semibold" : ""}`}>
                        <Check className="w-3 h-3" /> At least 1 number
                      </span>
                      <span className={`flex items-center gap-1 ${hasSpecial ? "text-emerald-500 font-semibold" : ""}`}>
                        <Check className="w-3 h-3" /> Special character
                      </span>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading || !password || !confirmPassword || password !== confirmPassword}
                    className="w-full h-11 sm:h-12 rounded-xl sm:rounded-2xl bg-hero-gradient text-primary-foreground font-bold text-xs sm:text-sm hover:opacity-95 transition-all shadow-md shadow-primary/20 border-0 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Updating Password...</span>
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-4 h-4" />
                        <span>Save New Password & Continue</span>
                      </>
                    )}
                  </Button>
                </form>
              </motion.div>
            ) : manualOtpMode ? (
              /* MANUAL OTP CODE MODE (FOR USERS WITH 6-DIGIT EMAIL CODE) */
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold mb-3">
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Enter 6-Digit Email Code</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                    Verify Security Token
                  </h1>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1.5">
                    Please enter the email address you requested recovery for, along with the 6-digit one-time code sent to your inbox.
                  </p>
                </div>

                {errorMessage && (
                  <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-xs leading-relaxed">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <p>{errorMessage}</p>
                  </div>
                )}

                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="otp-email" className="text-xs font-bold text-foreground">
                      Account Email Address
                    </Label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                      <Input
                        id="otp-email"
                        type="email"
                        value={otpEmail}
                        onChange={(e) => setOtpEmail(e.target.value)}
                        required
                        placeholder="name@company.com"
                        className="h-11 sm:h-12 pl-10 rounded-xl sm:rounded-2xl text-xs sm:text-sm bg-background border-border text-foreground"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="otp-code" className="text-xs font-bold text-foreground">
                      6-Digit Security Token
                    </Label>
                    <Input
                      id="otp-code"
                      type="text"
                      maxLength={8}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.trim())}
                      required
                      placeholder="123456"
                      className="h-11 sm:h-12 text-center tracking-[6px] font-mono font-bold text-lg rounded-xl sm:rounded-2xl bg-background border-border text-foreground"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={verifyingOtp || !otpEmail || !otpCode}
                    className="w-full h-11 sm:h-12 rounded-xl sm:rounded-2xl bg-hero-gradient text-primary-foreground font-bold text-xs sm:text-sm shadow-md shadow-primary/20 border-0"
                  >
                    {verifyingOtp ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Verifying Security Token...</span>
                      </>
                    ) : (
                      <span>Verify Token & Unlock Password Reset</span>
                    )}
                  </Button>
                </form>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setManualOtpMode(false)}
                    className="text-xs text-muted-foreground hover:text-foreground font-semibold inline-flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to options
                  </button>
                </div>
              </motion.div>
            ) : (
              /* PROFESSIONAL RESTRICTED ACCESS SCREEN (DIRECT URL ACCESS BLOCKED) */
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6"
              >
                <div className="h-14 w-14 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center shadow-sm">
                  <ShieldAlert className="w-7 h-7" />
                </div>

                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px] font-bold mb-2">
                    <span>Protected Security Route</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                    Access Restricted
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 leading-relaxed">
                    For your protection, the password reset form can only be accessed through the secure verification link sent to your email when you request a password reset.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-muted/40 border border-border text-xs text-muted-foreground space-y-2.5 leading-relaxed">
                  <p className="font-bold text-foreground flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4 text-primary" /> How to reset your password:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground pl-1">
                    <li>Click <strong>Request Password Reset Link</strong> below.</li>
                    <li>Enter your account email address on the forgot password page.</li>
                    <li>Open the recovery email received from GeFlow and click the button.</li>
                  </ol>
                </div>

                <div className="space-y-3 pt-2">
                  <Button
                    onClick={() => navigate("/forgot-password")}
                    className="w-full h-11 sm:h-12 rounded-xl sm:rounded-2xl bg-hero-gradient text-primary-foreground font-bold text-xs sm:text-sm hover:opacity-95 shadow-md shadow-primary/20 border-0 flex items-center justify-center gap-2"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>Request Password Reset Link</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setManualOtpMode(true)}
                    className="w-full h-11 rounded-xl text-xs sm:text-sm font-semibold border-border bg-card hover:bg-muted text-foreground flex items-center justify-center gap-1.5"
                  >
                    <Mail className="w-4 h-4 text-primary" />
                    <span>Enter 6-Digit Email Code Instead</span>
                  </Button>

                  <div className="text-center pt-2">
                    <Link
                      to="/login"
                      className="text-xs text-muted-foreground hover:text-foreground font-semibold inline-flex items-center gap-1"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Return to Sign In
                    </Link>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* RIGHT PANEL: Enterprise Security Architecture & Best Practices */}
          <div className="relative bg-hero-gradient p-6 sm:p-8 md:p-10 lg:p-12 flex flex-col justify-center text-primary-foreground overflow-hidden">
            <div className="absolute -top-20 -right-20 h-60 w-60 rounded-full bg-white/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-secondary/30 blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs font-bold mb-3">
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-300" />
                  <span>Enterprise Zero-Trust Security</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2 flex items-center gap-2.5">
                  Account Protection 🛡️
                </h2>
                <p className="text-primary-foreground/90 text-xs sm:text-sm leading-relaxed max-w-md">
                  GeFlow enforces strict cryptographic token verification to safeguard point-of-sale registers, billing data, and team credentials.
                </p>
              </div>

              <ul className="space-y-3 sm:space-y-4">
                {[
                  {
                    icon: Mail,
                    title: "Email-Bound Verification",
                    desc: "Password reset sessions are strictly bound to single-use cryptographically signed recovery tokens dispatched directly to the account owner's inbox.",
                  },
                  {
                    icon: Lock,
                    title: "Direct Access Protection",
                    desc: "Direct browser URL entries are blocked to prevent unauthorized credential tampering or unauthenticated session states.",
                  },
                  {
                    icon: ShieldCheck,
                    title: "Instant Session Invalidation",
                    desc: "When a new password is saved, previous session hashes and old passwords are automatically destroyed in Supabase Auth.",
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

export default ResetPassword;
