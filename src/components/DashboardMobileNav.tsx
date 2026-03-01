import { Calendar, FolderTree, FileText, Users, Mail, Globe } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface DashboardMobileNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const DashboardMobileNav = ({ activeTab, onTabChange }: DashboardMobileNavProps) => {
  const { t } = useLanguage();
  const navItems = [
    { id: "events", icon: Calendar, label: t('admin_dashboard.tabs.events', 'Eventi') },
    { id: "categories", icon: FolderTree, label: t('admin_dashboard.tabs.categories', 'Categorie') },
    { id: "blog", icon: FileText, label: t('admin_dashboard.tabs.blog', 'Blog') },
    { id: "users", icon: Users, label: t('admin_dashboard.tabs.users', 'Utenti') },
    { id: "email", icon: Mail, label: t('admin_dashboard.tabs.email', 'Email') },
    { id: "seo", icon: Globe, label: t('admin_dashboard.tabs.seo', 'SEO') },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm border-t border-white/20 px-1 py-2 z-50 safe-area-inset-bottom shadow-lg">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center space-y-1 p-1.5 rounded-lg transition-all duration-300 min-w-0 flex-1 ${
                isActive 
                  ? "text-white bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg scale-105" 
                  : "text-gray-600 hover:text-purple-600 hover:bg-white/50"
              }`}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              <span className="text-xs font-medium truncate w-full text-center">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default DashboardMobileNav;