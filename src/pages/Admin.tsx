
import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EventsManager from "@/components/admin/EventsManager";
import CategoriesManager from "@/components/admin/CategoriesManager";
import BlogManager from "@/components/admin/BlogManager";
import ForumCategoriesManager from "@/components/admin/ForumCategoriesManager";
import UsersManager from "@/components/admin/UsersManager";
import PasswordTokensManager from "@/components/admin/PasswordTokensManager";
import UserPackagesManager from "@/components/admin/UserPackagesManager";
import { BackButton } from "@/components/BackButton";
import { useIsMobile } from "@/hooks/useIsMobile";
import DashboardMobileNav from "@/components/DashboardMobileNav";
import { useState } from "react";

const AdminDashboard = () => {
    const { profile } = useAuth();
    const isMobile = useIsMobile();
    const [activeTab, setActiveTab] = useState("events");

    const renderMobileContent = () => {
        switch (activeTab) {
            case "events":
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle>Gestione Eventi e Allenamenti</CardTitle>
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
                            <CardTitle>Gestione Categorie</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <CategoriesManager />
                        </CardContent>
                    </Card>
                );
            case "blog":
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle>Gestione Articoli Blog</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <BlogManager />
                        </CardContent>
                    </Card>
                );
            case "forum":
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle>Gestione Categorie Forum</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ForumCategoriesManager />
                        </CardContent>
                    </Card>
                );
            case "users":
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle>Gestione Utenti</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <UsersManager />
                        </CardContent>
                    </Card>
                );
            case "packages":
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle>Gestione Pacchetti Utenti</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <UserPackagesManager />
                        </CardContent>
                    </Card>
                );
            case "tokens":
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle>Token di Recupero Password</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <PasswordTokensManager />
                        </CardContent>
                    </Card>
                );
            default:
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle>Gestione Eventi e Allenamenti</CardTitle>
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
                            <h1 className="text-xl font-bold text-blue-900">Admin Dashboard</h1>
                            <p className="text-sm text-gray-600">Benvenuto, {profile?.full_name || 'Admin'}!</p>
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
                <BackButton fallbackPath="/" label="Torna alla Home" />
            </div>
            
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-blue-900">Dashboard Amministratore</h1>
                <p className="text-gray-600">Benvenuto, {profile?.full_name || 'Admin'}!</p>
            </div>
            
            <Tabs defaultValue="events">
                <TabsList className="grid w-full grid-cols-7">
                    <TabsTrigger value="events">Eventi</TabsTrigger>
                    <TabsTrigger value="categories">Categorie</TabsTrigger>
                    <TabsTrigger value="blog">Blog</TabsTrigger>
                    <TabsTrigger value="forum">Forum</TabsTrigger>
                    <TabsTrigger value="users">Utenti</TabsTrigger>
                    <TabsTrigger value="packages">Pacchetti</TabsTrigger>
                    <TabsTrigger value="tokens">Token</TabsTrigger>
                </TabsList>
                <TabsContent value="events">
                    <Card>
                        <CardHeader>
                            <CardTitle>Gestione Eventi e Allenamenti</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <EventsManager />
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="categories">
                     <Card>
                        <CardHeader>
                            <CardTitle>Gestione Categorie</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <CategoriesManager />
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="blog">
                     <Card>
                        <CardHeader>
                            <CardTitle>Gestione Articoli Blog</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <BlogManager />
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="forum">
                     <Card>
                        <CardHeader>
                            <CardTitle>Gestione Categorie Forum</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ForumCategoriesManager />
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="users">
                     <Card>
                        <CardHeader>
                            <CardTitle>Gestione Utenti</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <UsersManager />
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="packages">
                     <Card>
                        <CardHeader>
                            <CardTitle>Gestione Pacchetti Utenti</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <UserPackagesManager />
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="tokens">
                     <Card>
                        <CardHeader>
                            <CardTitle>Token di Recupero Password</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <PasswordTokensManager />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </AdminLayout>
    );
};

export default AdminDashboard;
