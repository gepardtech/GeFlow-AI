import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index";
import Features from "./pages/Features";
import Pricing from "./pages/Pricing";
import HowItWorks from "./pages/HowItWorks";
import Contact from "./pages/Contact";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AuthCallback from "./pages/AuthCallback";
import Checkout from "./pages/Checkout";
import Admin from "./pages/Admin";
import Dashboard from "./pages/Dashboard";
import About from "./pages/About";
import Privacy from "./pages/Privacy";
import Refund from "./pages/Refund";
import Terms from "./pages/Terms";
import Disclaimer from "./pages/Disclaimer";
import NotFound from "./pages/NotFound";
import SetupBusiness from "./pages/SetupBusiness";
import PlatformSettingsProvider from "./components/PlatformSettingsProvider";
import AdminGuard from "./components/AdminGuard";
import I18nProvider from "./components/I18nProvider";
import AuthGuard from "./components/AuthGuard";
import AdminBillingCoupons from "./pages/admin/AdminBillingCoupons";

import AdminUsers from "./pages/admin/AdminUsers";
import AdminBusinesses from "./pages/admin/AdminBusinesses";
import AdminBusinessCategories from "./pages/admin/AdminBusinessCategories";
import AdminProductCategories from "./pages/admin/AdminProductCategories";
import AdminBilling from "./pages/admin/AdminBilling";
import AdminPayments from "./pages/admin/AdminPayments";
import AdminBillingSubscriptions from "./pages/admin/AdminBillingSubscriptions";
import AdminBillingPricing from "./pages/admin/AdminBillingPricing";
import AdminBillingInvoices from "./pages/admin/AdminBillingInvoices";
import AdminBillingRefunds from "./pages/admin/AdminBillingRefunds";
import AdminFeatures from "./pages/admin/AdminFeatures";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminSupport from "./pages/admin/AdminSupport";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminPlanLimits from "./pages/admin/AdminPlanLimits";
import AdminNotifications from "./pages/admin/AdminNotifications";
import AdminLogs from "./pages/admin/AdminLogs";

import UserInventory from "./pages/user/UserInventory";
import UserLowStock from "./pages/user/UserLowStock";
import UserBusinesses from "./pages/user/UserBusinesses";
import UserOutOfStock from "./pages/user/UserOutOfStock";
import UserPOS from "./pages/user/UserPOS";
import UserPurchases from "./pages/user/UserPurchases";
import UserReports from "./pages/user/UserReports";
import UserAnalytics from "./pages/user/UserAnalytics";
import UserTeam from "./pages/user/UserTeam";
import UserSubscription from "./pages/user/UserSubscription";
import UserWorkspace from "./pages/user/UserWorkspace";
import UserSettings from "./pages/user/UserSettings";
import UserAnnouncements from "./pages/user/UserAnnouncements";
import UserNotifications from "./pages/user/UserNotifications";
import UserSupport from "./pages/user/UserSupport";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <PlatformSettingsProvider>
      <I18nProvider>
      <BrowserRouter>
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
          <Route path="/admin/users" element={<AdminGuard><AdminUsers /></AdminGuard>} />
          <Route path="/admin/businesses" element={<AdminGuard><AdminBusinesses /></AdminGuard>} />
          <Route path="/admin/business-categories" element={<AdminGuard><AdminBusinessCategories /></AdminGuard>} />
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
          <Route path="/admin/settings" element={<AdminGuard><AdminSettings /></AdminGuard>} />
          <Route path="/setup/business" element={<AuthGuard><SetupBusiness /></AuthGuard>} />
          <Route path="/dashboard" element={<AuthGuard><Dashboard /></AuthGuard>} />
          <Route path="/dashboard/inventory" element={<AuthGuard><UserInventory /></AuthGuard>} />
          <Route path="/dashboard/low-stock" element={<AuthGuard><UserLowStock /></AuthGuard>} />
          <Route path="/dashboard/businesses" element={<AuthGuard><UserBusinesses /></AuthGuard>} />
          <Route path="/businesses" element={<AuthGuard><UserBusinesses /></AuthGuard>} />
          <Route path="/dashboard/out-of-stock" element={<AuthGuard><UserOutOfStock /></AuthGuard>} />
          <Route path="/dashboard/pos" element={<AuthGuard><UserPOS /></AuthGuard>} />
          <Route path="/dashboard/purchases" element={<AuthGuard><UserPurchases /></AuthGuard>} />
          <Route path="/dashboard/reports" element={<AuthGuard><UserReports /></AuthGuard>} />
          <Route path="/dashboard/analytics" element={<AuthGuard><UserAnalytics /></AuthGuard>} />
          <Route path="/dashboard/team" element={<AuthGuard><UserTeam /></AuthGuard>} />
          <Route path="/dashboard/subscription" element={<AuthGuard><UserSubscription /></AuthGuard>} />
          <Route path="/dashboard/announcements" element={<AuthGuard><UserAnnouncements /></AuthGuard>} />
          <Route path="/dashboard/announcements/notifications" element={<AuthGuard><UserNotifications /></AuthGuard>} />
          <Route path="/dashboard/support" element={<AuthGuard><UserSupport /></AuthGuard>} />
          <Route path="/dashboard/settings" element={<AuthGuard><UserSettings /></AuthGuard>} />
          <Route path="/dashboard/workspace" element={<AuthGuard><UserSettings /></AuthGuard>} />
          <Route path="/about" element={<About />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/refund" element={<Refund />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/disclaimer" element={<Disclaimer />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      </I18nProvider>
      </PlatformSettingsProvider>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
