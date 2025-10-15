
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { UserNav } from "@/components/UserNav";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Waves } from "lucide-react";
import { ReactNode } from "react";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const AdminLayout = ({ children }: { children: ReactNode }) => {
    const { user, loading } = useAuth();
    const { t } = useLanguage();
    
    return (
        <div className="flex flex-col min-h-screen bg-gray-50">
            <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <Link to="/" className="flex items-center space-x-2">
                            <Waves className="h-8 w-8 text-blue-600" />
                            <span className="text-2xl font-bold text-blue-900">WeApnea</span>
                        </Link>
                        
                        <div className="flex items-center space-x-3">
                            <LanguageSwitcher />
                            {loading ? (
                                <div className="flex items-center space-x-3">
                                    <Skeleton className="h-9 w-20" />
                                    <Skeleton className="h-9 w-24" />
                                </div>
                            ) : user ? (
                                <UserNav />
                            ) : (
                                <>
                                    <Button variant="outline" size="sm" asChild>
                                      <Link to="/auth">{t('common.login', 'Accedi')}</Link>
                                    </Button>
                                    <Button size="sm" asChild>
                                      <Link to="/auth?view=register">{t('common.register', 'Registrati')}</Link>
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </header>
            <main className="flex-1 container mx-auto px-4 py-8">
                {children}
            </main>
        </div>
    );
};

export default AdminLayout;
