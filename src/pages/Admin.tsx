
import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EventsManager from "@/components/admin/EventsManager";
import CategoriesManager from "@/components/admin/CategoriesManager";
import BlogManager from "@/components/admin/BlogManager";
import BlogTagManager from "@/components/admin/BlogTagManager";
// Forum disabilitato temporaneamente
import UsersManager from "@/components/admin/UsersManager";
import EmailTemplatesManager from "@/components/admin/EmailTemplatesManager";
import SeoManager from "@/components/admin/SeoManager";
import { BackButton } from "@/components/BackButton";
import { useIsMobile } from "@/hooks/useIsMobile";
import DashboardMobileNav from "@/components/DashboardMobileNav";
import { useState } from "react";

const AdminDashboard = () => {
    const { profile } = useAuth();
    const { t } = useLanguage();
    const isMobile = useIsMobile();
    const [activeTab, setActiveTab] = useState("events");

    const renderMobileContent = () => {
        switch (activeTab) {
            case "events":
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('admin_dashboard.manage_events', 'Gestione Eventi e Allenamenti')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <EventsManager />
                        </CardContent>
                    </Card>
                );
            case "categories":
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('admin_dashboard.manage_categories', 'Gestione Categorie')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <CategoriesManager />
                        </CardContent>
                    </Card>
                );
            case "blog":
                return (
                    <>
                    <Card>
                        <CardHeader>
                            <CardTitle>Gestione Articoli Blog</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <BlogManager />
                        </CardContent>
                    </Card>
                    <Card className="mt-6">
                        <CardContent className="pt-6">
                            <BlogTagManager />
                        </CardContent>
                    </Card>
                    </>
                );
            // forum: sezione rimossa
            case "users":
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('admin_dashboard.manage_users', 'Gestione Utenti')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <UsersManager />
                        </CardContent>
                    </Card>
                );
            case "email":
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('admin_dashboard.manage_email', 'Gestione Email')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <EmailTemplatesManager />
                        </CardContent>
                    </Card>
                );
            case "seo":
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('admin_dashboard.manage_seo', 'Impostazioni SEO')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <SeoManager />
                        </CardContent>
                    </Card>
                );
            default:
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('admin_dashboard.manage_events', 'Gestione Eventi e Allenamenti')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <EventsManager />
                        </CardContent>
                    </Card>
                );
        }
    };

    if (isMobile) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
                <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-sm border-b border-gray-200 px-4 py-3">
                    <div className="flex items-center gap-3">
                        <BackButton fallbackPath="/" label="" />
                        <div>
                            <h1 className="text-xl font-bold text-blue-900">{t('admin_dashboard.mobile_title', 'Admin Dashboard')}</h1>
                            <p className="text-sm text-gray-600">{t('admin_dashboard.welcome', 'Benvenuto, {name}!').replace('{name}', profile?.full_name || t('admin_dashboard.welcome_fallback', 'Admin'))}</p>
                        </div>
                    </div>
                </div>
                
                <div className="pb-20 px-4 py-6">
                    {renderMobileContent()}
                </div>
                
                <DashboardMobileNav 
                    activeTab={activeTab} 
                    onTabChange={setActiveTab} 
                />
            </div>
        );
    }
    
    return (
        <AdminLayout>
            {/* Back Button */}
            <div className="mb-6">
                <BackButton fallbackPath="/" label={t('not_found.back_home', 'Torna alla Home')} />
            </div>
            
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-blue-900">{t('admin_dashboard.title', 'Dashboard Amministratore')}</h1>
                <p className="text-gray-600">{t('admin_dashboard.welcome', 'Benvenuto, {name}!').replace('{name}', profile?.full_name || t('admin_dashboard.welcome_fallback', 'Admin'))}</p>
            </div>
            
            <Tabs defaultValue="events">
                <TabsList className="grid w-full grid-cols-6">
                    <TabsTrigger value="events">{t('admin_dashboard.tabs.events', 'Eventi')}</TabsTrigger>
                    <TabsTrigger value="categories">{t('admin_dashboard.tabs.categories', 'Categorie')}</TabsTrigger>
                    <TabsTrigger value="blog">{t('admin_dashboard.tabs.blog', 'Blog')}</TabsTrigger>
                    <TabsTrigger value="users">{t('admin_dashboard.tabs.users', 'Utenti')}</TabsTrigger>
                    <TabsTrigger value="email">{t('admin_dashboard.tabs.email', 'Email')}</TabsTrigger>
                    <TabsTrigger value="seo">{t('admin_dashboard.tabs.seo', 'SEO')}</TabsTrigger>
                </TabsList>
                <TabsContent value="events">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('admin_dashboard.manage_events', 'Gestione Eventi e Allenamenti')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <EventsManager />
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="categories">
                     <Card>
                        <CardHeader>
                            <CardTitle>{t('admin_dashboard.manage_categories', 'Gestione Categorie')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <CategoriesManager />
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="blog">
                     <Card>
                        <CardHeader>
                            <CardTitle>{t('admin_dashboard.manage_blog', 'Gestione Articoli Blog')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <BlogManager />
                        </CardContent>
                    </Card>
                    <Card className="mt-6">
                        <CardContent className="pt-6">
                            <BlogTagManager />
                        </CardContent>
                    </Card>
                </TabsContent>
                {/* forum: contenuto rimosso */}
                <TabsContent value="users">
                     <Card>
                        <CardHeader>
                            <CardTitle>{t('admin_dashboard.manage_users', 'Gestione Utenti')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <UsersManager />
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="email">
                     <Card>
                        <CardHeader>
                            <CardTitle>{t('admin_dashboard.manage_email', 'Gestione Email')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <EmailTemplatesManager />
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="seo">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('admin_dashboard.manage_seo', 'Impostazioni SEO')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <SeoManager />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </AdminLayout>
    );
};

export default AdminDashboard;
