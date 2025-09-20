import { Calendar, UserCircle, Shield, FileText } from "lucide-react";

interface ProfileMobileNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const ProfileMobileNav = ({ activeTab, onTabChange }: ProfileMobileNavProps) => {
  const navItems = [
    { id: "events", icon: Calendar, label: "Eventi" },
    { id: "personal", icon: UserCircle, label: "Personali" },
    { id: "certifications", icon: Shield, label: "Certificazioni" },
    { id: "records", icon: FileText, label: "Record" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 modern-blur border-t border-white/20 px-2 py-2 z-50 safe-area-inset-bottom shadow-lg">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center space-y-1 p-2 rounded-lg transition-all duration-300 min-w-0 flex-1 ${
                isActive 
                  ? "text-white bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg scale-105" 
                  : "text-gray-600 hover:text-purple-600 hover:bg-white/50"
              }`}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              <span className="text-xs font-medium truncate w-full text-center">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default ProfileMobileNav;