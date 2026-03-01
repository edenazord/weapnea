
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { AuthProvider } from "./contexts/AuthContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import TrackingScripts from "./components/TrackingScripts";
import AuthPage from "./pages/Auth";
import AuthConfirm from "./pages/AuthConfirm";
import PasswordResetPage from "./pages/PasswordReset";
import VerifyEmail from "./pages/VerifyEmail";
import EventDetail from "./pages/EventDetail";
import { Navigate, useParams } from "react-router-dom";
import { buildFriendlyEventPath } from "@/lib/seo-utils";
import Dashboard from "./pages/Dashboard";
import AdminDashboard from "./pages/Admin";
import UpcomingEvents from "./pages/UpcomingEvents";
import CategoryEvents from "./pages/CategoryEvents";
import Blog from "./pages/Blog";
import BlogDetail from "./pages/BlogDetail";
import { parseFriendlyBlogSlug } from "@/lib/seo-utils";
import Forum from "./pages/Forum";
import ForumTopic from "./pages/ForumTopic";
import NewForumTopic from "./pages/NewForumTopic";
import Profile from "./pages/Profile";
import InstructorProfile from "./pages/InstructorProfile";
import InstructorPublicProfile from "./pages/InstructorPublicProfile";
import OrganizerPackages from "./pages/OrganizerPackages";
import SponsorPackages from "./pages/SponsorPackages";
import MyEvents from "./pages/MyEvents";
import ChiSiamo from "./pages/ChiSiamo";
import Contattaci from "./pages/Contattaci";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import CookiePolicy from "./pages/CookiePolicy";
import CoOrganizerInvite from "./pages/CoOrganizerInvite";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicProfileBanner from "./components/PublicProfileBanner";
import ChatWidget from "./components/ChatWidget";
import DIdAgent from "./components/DIdAgent";
import { useChatStore } from "./hooks/useChatStore";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30000,
      gcTime: 60000,
    },
  },
});

console.log('App component loading...');

// Redirect component: legacy /events/:slug -> SEO-friendly path
const LegacyEventRedirect = () => {
  const { slug } = useParams<{ slug: string }>();
  const target = slug ? buildFriendlyEventPath(slug) : "/";
  return <Navigate to={target} replace />;
};

// Chat wrapper component to access store
const ChatWidgetWrapper = () => {
  const { targetUserId, targetEventId, resetTarget } = useChatStore();
  console.log('[ChatWidgetWrapper] Store values - targetUserId:', targetUserId, 'targetEventId:', targetEventId);
  return (
    <ChatWidget
      openWithUserId={targetUserId || undefined}
      openWithEventId={targetEventId || undefined}
      onClose={resetTarget}
    />
  );
};

const App = () => {
  console.log('App component rendering...');
  
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <AuthProvider>
            <LanguageProvider>
              <div className="min-h-screen">
                <TrackingScripts />
                <Toaster />
                <Sonner />
                <ChatWidgetWrapper />
                <PublicProfileBanner />
                {/* <DIdAgent /> — AI Assistant nascosto temporaneamente */}
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/chi-siamo" element={<ChiSiamo />} />
                  <Route path="/contattaci" element={<Contattaci />} />
                  <Route path="/auth" element={<AuthPage />} />
                  <Route path="/auth/confirm" element={<AuthConfirm />} />
                  <Route path="/password-reset" element={<PasswordResetPage />} />
                  <Route path="/verify-email" element={<VerifyEmail />} />
                  <Route path="/co-organizer-invite/:token" element={<CoOrganizerInvite />} />
                  {/* Legacy path: redirect to friendly URL */}
                  <Route path="/events/:slug" element={<LegacyEventRedirect />} />
                  {/* SEO-friendly public event route (root-level, single segment) */}
                  <Route path=":slug" element={<EventDetail />} />
                  {/* Public SEO-friendly route by slug must come before the id route if patterns overlap */}
                  <Route path="/profile/:slug" element={<InstructorPublicProfile />} />
                  {/* Internal/admin route by id */}
                  <Route path="/profile/id/:id" element={<InstructorProfile />} />
                  <Route path="/eventi-imminenti" element={<UpcomingEvents />} />
                  <Route path="/categories/:categorySlug" element={<CategoryEvents />} />
                  <Route path="/blog" element={<Blog />} />
                  {/* Blog detail with friendly slug support */}
                  <Route path="/blog/:slug" element={<BlogDetail />} />
                  <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                  <Route path="/cookie-policy" element={<CookiePolicy />} />
                  <Route path="/forum" element={<Forum />} />
                  <Route path="/forum/topic/:id" element={<ForumTopic />} />
                  <Route path="/forum/new-topic" element={<NewForumTopic />} />
                  <Route path="/organizer-packages" element={<OrganizerPackages />} />
                  <Route path="/sponsor-packages" element={<SponsorPackages />} />
                  
                  <Route path="/profile" element={
                    <ProtectedRoute allowedRoles={['final_user', 'admin', 'company', 'instructor', 'blogger', 'creator']}>
                      <Profile />
                    </ProtectedRoute>
                  } />
                  <Route path="/dashboard" element={
                    <ProtectedRoute allowedRoles={['admin', 'creator']}>
                      <Dashboard />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin" element={
                    <ProtectedRoute allowedRoles={['admin', 'creator']}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  } />
                  <Route path="/my-events" element={
                    <ProtectedRoute allowedRoles={['company', 'instructor', 'final_user', 'admin', 'creator']}>
                      <MyEvents />
                    </ProtectedRoute>
                  } />

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </div>
            </LanguageProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

console.log('App component loaded successfully');

export default App;
