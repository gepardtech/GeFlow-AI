import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import PlatformSettingsProvider from "./components/PlatformSettingsProvider";
import AdminGuard from "./components/AdminGuard";
import I18nProvider from "./components/I18nProvider";
import AuthGuard from "./components/AuthGuard";
import ErrorBoundary from "./components/ErrorBoundary";
import ScrollToTop from "./components/ScrollToTop";
import { useBusinessRealtimeSync } from "./hooks/useBusinessRealtimeSync";

// Eagerly load primary public landing
import Index from "./pages/Index";

// Lazy-loaded pages for optimized FCP/LCP and 90%+ performance score
const Features = lazy(() => import("./pages/Features"));
const Pricing = lazy(() => import("./pages/Pricing"));
const HowItWorks = lazy(() => import("./pages/HowItWorks"));
const Contact = lazy(() => import("./pages/Contact"));
const Login = lazy(() => import("./pages/login"));

// Preload critical public navigation routes during idle time to boost perceived performance
if (typeof window !== "undefined") {
  const preloadCriticalRoutes = () => {
    import("./pages/Features");
    import("./pages/Pricing");
    import("./pages/login");
  };
  if ("requestIdleCallback" in window) {
    (window as any).requestIdleCallback(preloadCriticalRoutes);
  } else {
    setTimeout(preloadCriticalRoutes, 1800);
  }
}
const Signup = lazy(() => import("./pages/Signup"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const Checkout = lazy(() => import("./pages/Checkout"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const About = lazy(() => import("./pages/About"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Refund = lazy(() => import("./pages/Refund"));
const Terms = lazy(() => import("./pages/Terms"));
const Disclaimer = lazy(() => import("./pages/Disclaimer"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SetupBusiness = lazy(() => import("./pages/SetupBusiness"));

// Admin pages lazy-loaded
const Admin = lazy(() => import("./pages/Admin"));
const AdminBillingCoupons = lazy(() => import("./pages/admin/AdminBillingCoupons"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminBusinesses = lazy(() => import("./pages/admin/AdminBusinesses"));
const AdminBusinessCategories = lazy(() => import("./pages/admin/AdminBusinessCategories"));
const AdminUoM = lazy(() => import("./pages/admin/AdminUoM"));
const AdminProductCategories = lazy(() => import("./pages/admin/AdminProductCategories"));
const AdminBilling = lazy(() => import("./pages/admin/AdminBilling"));
const AdminPayments = lazy(() => import("./pages/admin/AdminPayments"));
const AdminBillingSubscriptions = lazy(() => import("./pages/admin/AdminBillingSubscriptions"));
const AdminBillingPricing = lazy(() => import("./pages/admin/AdminBillingPricing"));
const AdminBillingInvoices = lazy(() => import("./pages/admin/AdminBillingInvoices"));
const AdminBillingRefunds = lazy(() => import("./pages/admin/AdminBillingRefunds"));
const AdminFeatures = lazy(() => import("./pages/admin/AdminFeatures"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminSupport = lazy(() => import("./pages/admin/AdminSupport"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminPlanLimits = lazy(() => import("./pages/admin/AdminPlanLimits"));
const AdminNotifications = lazy(() => import("./pages/admin/AdminNotifications"));
const AdminLogs = lazy(() => import("./pages/admin/AdminLogs"));
const AdminNewsletter = lazy(() => import("./pages/admin/AdminNewsletter"));
const AdminProfile = lazy(() => import("./pages/admin/AdminProfile"));

// User dashboard pages lazy-loaded
const UserInventory = lazy(() => import("./pages/user/UserInventory"));
const UserLowStock = lazy(() => import("./pages/user/UserLowStock"));
const UserBusinesses = lazy(() => import("./pages/user/UserBusinesses"));
const UserOutOfStock = lazy(() => import("./pages/user/UserOutOfStock"));
const UserPOS = lazy(() => import("./pages/user/UserPOS"));
const UserReturns = lazy(() => import("./pages/user/UserReturns"));
const UserPurchases = lazy(() => import("./pages/user/UserPurchases"));
const UserReports = lazy(() => import("./pages/user/UserReports"));
const UserAnalytics = lazy(() => import("./pages/user/UserAnalytics"));
const UserTeam = lazy(() => import("./pages/user/UserTeam"));
const UserSubscription = lazy(() => import("./pages/user/UserSubscription"));
const UserWorkspace = lazy(() => import("./pages/user/UserWorkspace"));
const UserSettings = lazy(() => import("./pages/user/UserSettings"));
const UserAnnouncements = lazy(() => import("./pages/user/UserAnnouncements"));
const UserNotifications = lazy(() => import("./pages/user/UserNotifications"));
const UserSupport = lazy(() => import("./pages/user/UserSupport"));
const UserProfile = lazy(() => import("./pages/user/UserProfile"));
const UserCustomerCredits = lazy(() => import("./pages/user/UserCustomerCredits"));

function BusinessSyncObserver() {
  useBusinessRealtimeSync();
  return null;
}

const PageLoaderFallback = () => (
  <div className="min-h-[50vh] flex items-center justify-center p-8" aria-label="Loading page content">
    <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
  </div>
);

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <PlatformSettingsProvider>
            <I18nProvider>
              <BusinessSyncObserver />
              <BrowserRouter>
                <ScrollToTop />
                <ErrorBoundary>
                  <Suspense fallback={<PageLoaderFallback />}>
                    <Routes>
                      <Route path="/" element={<Index />} />
                      <Route path="/features" element={<Features />} />
                      <Route path="/pricing" element={<Pricing />} />
                      <Route path="/how-it-works" element={<HowItWorks />} />
                      <Route path="/contact" element={<Contact />} />
                      <Route path="/login" element={<Login />} />
                      <Route path="/signup" element={<Signup />} />
                      <Route path="/forgot-password" element={<ForgotPassword />} />
                      <Route path="/reset-password" element={<ResetPassword />} />
                      <Route path="/update-password" element={<ResetPassword />} />
                      <Route path="/auth/callback" element={<AuthCallback />} />
                      <Route path="/auth/confirm" element={<AuthCallback />} />
                      <Route path="/checkout" element={<Checkout />} />
                      <Route path="/admin" element={<AdminGuard><Admin /></AdminGuard>} />
                      <Route path="/admin/dashboard" element={<AdminGuard><Admin /></AdminGuard>} />
                      <Route path="/admin/users" element={<AdminGuard><AdminUsers /></AdminGuard>} />
                      <Route path="/admin/businesses" element={<AdminGuard><AdminBusinesses /></AdminGuard>} />
                      <Route path="/admin/business-categories" element={<AdminGuard><AdminBusinessCategories /></AdminGuard>} />
                      <Route path="/admin/business-categories/uom" element={<AdminGuard><AdminUoM /></AdminGuard>} />
                      <Route path="/admin/uom" element={<AdminGuard><AdminUoM /></AdminGuard>} />
                      <Route path="/admin/product-categories" element={<AdminGuard><AdminProductCategories /></AdminGuard>} />
                      <Route path="/admin/billing" element={<AdminGuard><AdminBilling /></AdminGuard>} />
                      <Route path="/admin/billing/subscriptions" element={<AdminGuard><AdminBillingSubscriptions /></AdminGuard>} />
                      <Route path="/admin/billing/pricing-plans" element={<AdminGuard><AdminBillingPricing /></AdminGuard>} />
                      <Route path="/admin/billing/invoices" element={<AdminGuard><AdminBillingInvoices /></AdminGuard>} />
                      <Route path="/admin/billing/refunds" element={<AdminGuard><AdminBillingRefunds /></AdminGuard>} />
                      <Route path="/admin/billing/coupons" element={<AdminGuard><AdminBillingCoupons /></AdminGuard>} />
                      <Route path="/admin/features" element={<AdminGuard><AdminFeatures /></AdminGuard>} />
                      <Route path="/admin/analytics" element={<AdminGuard><AdminAnalytics /></AdminGuard>} />
                      <Route path="/admin/payments" element={<AdminGuard><AdminPayments /></AdminGuard>} />
                      <Route path="/admin/support" element={<AdminGuard><AdminSupport /></AdminGuard>} />
                      <Route path="/admin/plan-limits" element={<AdminGuard><AdminPlanLimits /></AdminGuard>} />
                      <Route path="/admin/logs" element={<AdminGuard><AdminLogs /></AdminGuard>} />
                      <Route path="/admin/notifications" element={<AdminGuard><AdminNotifications /></AdminGuard>} />
                      <Route path="/admin/newsletter" element={<AdminGuard><AdminNewsletter /></AdminGuard>} />
                      <Route path="/admin/settings" element={<AdminGuard><AdminSettings /></AdminGuard>} />
                      <Route path="/admin/profile" element={<AdminGuard><AdminProfile /></AdminGuard>} />
                      <Route path="/setup/business" element={<AuthGuard><SetupBusiness /></AuthGuard>} />
                      <Route path="/setup-business" element={<AuthGuard><SetupBusiness /></AuthGuard>} />
                      <Route path="/setup" element={<AuthGuard><SetupBusiness /></AuthGuard>} />
                      <Route path="/business-setup" element={<AuthGuard><SetupBusiness /></AuthGuard>} />
                      <Route path="/business/setup" element={<AuthGuard><SetupBusiness /></AuthGuard>} />
                      <Route path="/onboarding" element={<AuthGuard><SetupBusiness /></AuthGuard>} />
                      <Route path="/dashboard" element={<AuthGuard><Dashboard /></AuthGuard>} />
                      <Route path="/dashboard/inventory" element={<AuthGuard><UserInventory /></AuthGuard>} />
                      <Route path="/dashboard/low-stock" element={<AuthGuard><UserLowStock /></AuthGuard>} />
                      <Route path="/dashboard/businesses" element={<AuthGuard><UserBusinesses /></AuthGuard>} />
                      <Route path="/dashboard/my-businesses" element={<AuthGuard><UserBusinesses /></AuthGuard>} />
                      <Route path="/businesses" element={<AuthGuard><UserBusinesses /></AuthGuard>} />
                      <Route path="/dashboard/out-of-stock" element={<AuthGuard><UserOutOfStock /></AuthGuard>} />
                      <Route path="/dashboard/pos" element={<AuthGuard><UserPOS /></AuthGuard>} />
                      <Route path="/dashboard/customer-credits" element={<AuthGuard><UserCustomerCredits /></AuthGuard>} />
                      <Route path="/dashboard/udhar" element={<AuthGuard><UserCustomerCredits /></AuthGuard>} />
                      <Route path="/customer-credits" element={<AuthGuard><UserCustomerCredits /></AuthGuard>} />
                      <Route path="/dashboard/returns" element={<AuthGuard><UserReturns /></AuthGuard>} />
                      <Route path="/returns" element={<AuthGuard><UserReturns /></AuthGuard>} />
                      <Route path="/dashboard/purchases" element={<AuthGuard><UserPurchases /></AuthGuard>} />
                      <Route path="/dashboard/purchase" element={<AuthGuard><UserPurchases /></AuthGuard>} />
                      <Route path="/dashboard/reports" element={<AuthGuard><UserReports /></AuthGuard>} />
                      <Route path="/dashboard/report" element={<AuthGuard><UserReports /></AuthGuard>} />
                      <Route path="/reports" element={<AuthGuard><UserReports /></AuthGuard>} />
                      <Route path="/report" element={<AuthGuard><UserReports /></AuthGuard>} />
                      <Route path="/dashboard/analytics" element={<AuthGuard><UserAnalytics /></AuthGuard>} />
                      <Route path="/dashboard/team" element={<AuthGuard><UserTeam /></AuthGuard>} />
                      <Route path="/dashboard/team-hub" element={<AuthGuard><UserTeam /></AuthGuard>} />
                      <Route path="/dashboard/subscription" element={<AuthGuard><UserSubscription /></AuthGuard>} />
                      <Route path="/dashboard/announcements" element={<AuthGuard><UserAnnouncements /></AuthGuard>} />
                      <Route path="/dashboard/announcements/notifications" element={<AuthGuard><UserNotifications /></AuthGuard>} />
                      <Route path="/dashboard/support" element={<AuthGuard><UserSupport /></AuthGuard>} />
                      <Route path="/dashboard/settings" element={<AuthGuard><UserSettings /></AuthGuard>} />
                      <Route path="/dashboard/workspace" element={<AuthGuard><UserSettings /></AuthGuard>} />
                      <Route path="/dashboard/profile" element={<AuthGuard><UserProfile /></AuthGuard>} />
                      <Route path="/profile" element={<AuthGuard><UserProfile /></AuthGuard>} />
                      <Route path="/app/profile" element={<AuthGuard><UserProfile /></AuthGuard>} />
                      <Route path="/about" element={<About />} />
                      <Route path="/privacy" element={<Privacy />} />
                      <Route path="/refund" element={<Refund />} />
                      <Route path="/terms" element={<Terms />} />
                      <Route path="/disclaimer" element={<Disclaimer />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </ErrorBoundary>
      </BrowserRouter>
      </I18nProvider>
      </PlatformSettingsProvider>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
