import { Link, useLocation } from "react-router-dom";
import { Home, User, Calendar, Settings, FileText, MessageCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useChatStore } from "@/hooks/useChatStore";

interface MobileBottomNavProps {
  variant?: "default" | "dashboard" | "profile";
}

type NavItem =
  | { type: 'link'; icon: React.ElementType; label: string; path: string }
  | { type: 'action'; icon: React.ElementType; label: string; action: () => void; badge?: number };

const MobileBottomNav = ({ variant = "default" }: MobileBottomNavProps) => {
  const { session } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const { unreadTotal, openList } = useChatStore();

  const messagesItem: NavItem = {
    type: 'action',
    icon: MessageCircle,
    label: t('mobile_nav.messages', 'Messaggi'),
    action: openList,
    badge: unreadTotal,
  };

  const getNavItems = (): NavItem[] => {
    switch (variant) {
      case "dashboard":
        return [
          { type: 'link', icon: Home, label: t('mobile_nav.home', 'Home'), path: "/" },
          { type: 'link', icon: Calendar, label: t('mobile_nav.my_events', 'I Miei Eventi'), path: "/my-events" },
          messagesItem,
          { type: 'link', icon: Settings, label: t('mobile_nav.dashboard', 'Dashboard'), path: "/dashboard" },
          { type: 'link', icon: User, label: t('mobile_nav.profile', 'Profilo'), path: "/profile" },
        ];
      case "profile":
        return [
          { type: 'link', icon: Home, label: t('mobile_nav.home', 'Home'), path: "/" },
          { type: 'link', icon: Calendar, label: t('mobile_nav.events', 'Eventi'), path: "/my-events" },
          messagesItem,
          { type: 'link', icon: User, label: t('mobile_nav.profile', 'Profilo'), path: "/profile" },
          { type: 'link', icon: Settings, label: t('mobile_nav.settings', 'Impostazioni'), path: "/dashboard" },
        ];
      default:
        if (session) {
          return [
            { type: 'link', icon: Home, label: t('nav.home', 'Home'), path: "/" },
            { type: 'link', icon: FileText, label: t('nav.blog', 'Blog'), path: "/blog" },
            messagesItem,
            { type: 'link', icon: User, label: t('nav.profile', 'Profilo'), path: "/profile" },
          ];
        }
        return [
          { type: 'link', icon: Home, label: t('nav.home', 'Home'), path: "/" },
          { type: 'link', icon: FileText, label: t('nav.blog', 'Blog'), path: "/blog" },
          { type: 'link', icon: User, label: t('nav.profile', 'Profilo'), path: "/auth" },
        ];
    }
  };

  const navItems = getNavItems();

  return (
    <nav className="fixed bottom-0 left-0 right-0 modern-blur border-t border-white/20 px-2 py-2 z-50 safe-area-inset-bottom shadow-lg">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          if (item.type === 'action') {
            return (
              <button
                key={item.label}
                onClick={item.action}
                className="relative flex flex-col items-center space-y-1 p-2 rounded-lg transition-all duration-300 min-w-0 flex-1 text-gray-600 hover:text-purple-600 hover:bg-white/50"
              >
                <div className="relative">
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  {item.badge != null && item.badge > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </div>
                <span className="text-xs font-medium truncate w-full text-center">{item.label}</span>
              </button>
            );
          }
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center space-y-1 p-2 rounded-lg transition-all duration-300 min-w-0 flex-1 ${
                isActive 
                  ? "text-white bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg scale-105" 
                  : "text-gray-600 hover:text-purple-600 hover:bg-white/50"
              }`}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              <span className="text-xs font-medium truncate w-full text-center">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;