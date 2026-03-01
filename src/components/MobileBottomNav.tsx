import { Link, useLocation } from "react-router-dom";
import { Home, User, Calendar, Settings, FileText } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

interface MobileBottomNavProps {
  variant?: "default" | "dashboard" | "profile";
}

const MobileBottomNav = ({ variant = "default" }: MobileBottomNavProps) => {
  const { session } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();

  const getNavItems = () => {
    switch (variant) {
      case "dashboard":
        return [
          { icon: Home, label: t('mobile_nav.home', 'Home'), path: "/" },
          { icon: Calendar, label: t('mobile_nav.my_events', 'I Miei Eventi'), path: "/my-events" },
          { icon: Settings, label: t('mobile_nav.dashboard', 'Dashboard'), path: "/dashboard" },
          { icon: User, label: t('mobile_nav.profile', 'Profilo'), path: "/profile" },
        ];
      case "profile":
        return [
          { icon: Home, label: t('mobile_nav.home', 'Home'), path: "/" },
          { icon: Calendar, label: t('mobile_nav.events', 'Eventi'), path: "/my-events" },
          { icon: User, label: t('mobile_nav.profile', 'Profilo'), path: "/profile" },
          { icon: Settings, label: t('mobile_nav.settings', 'Impostazioni'), path: "/dashboard" },
        ];
      default:
        return [
          { icon: Home, label: t('nav.home', 'Home'), path: "/" },
          { icon: FileText, label: t('nav.blog', 'Blog'), path: "/blog" },
          { icon: User, label: t('nav.profile', 'Profilo'), path: session ? "/profile" : "/auth" },
        ];
    }
  };

  const navItems = getNavItems();

  return (
    <nav className="fixed bottom-0 left-0 right-0 modern-blur border-t border-white/20 px-2 py-2 z-50 safe-area-inset-bottom shadow-lg">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
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