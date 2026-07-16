
import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import EventsManager from "@/components/admin/EventsManager";
import CategoriesManager from "@/components/admin/CategoriesManager";
import BlogManager from "@/components/admin/BlogManager";
import BlogTagManager from "@/components/admin/BlogTagManager";
// Forum disabilitato temporaneamente
import UsersManager from "@/components/admin/UsersManager";
import EmailTemplatesManager from "@/components/admin/EmailTemplatesManager";
import SeoManager from "@/components/admin/SeoManager";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAllUsers } from "@/lib/admin-users-api";
import { getEvents, getCategories } from "@/lib/api";
import { getBlogArticles } from "@/lib/blog-api";
import {
    LayoutDashboard,
    Calendar,
    FolderTree,
    FileText,
    Users,
    Mail,
    Globe,
    BarChart3,
    UserCheck,
    UserX,
    UserPlus,
    BadgeEuro,
    MapPin,
    Newspaper,
} from "lucide-react";

type AdminSection = "statistics" | "events" | "categories" | "blog" | "users" | "email" | "seo";

const parseDateSafe = (value?: string | null) => {
    if (!value) return null;
    const dt = new Date(value);
    return Number.isNaN(dt.getTime()) ? null : dt;
};

const AdminDashboard = () => {
    const { profile } = useAuth();
    const { t } = useLanguage();
    const isMobile = useIsMobile();
    const [activeSection, setActiveSection] = useState<AdminSection>("statistics");

    const { data: users = [], isLoading: usersLoading } = useQuery({
        queryKey: ["admin-users", "stats"],
        queryFn: getAllUsers,
        staleTime: 60_000,
    });

    const { data: events = [], isLoading: eventsLoading } = useQuery({
        queryKey: ["admin-events", "stats", profile?.id],
        queryFn: () =>
            getEvents(undefined, { column: "date", direction: "desc" }, undefined, undefined, profile?.role, profile?.id),
        enabled: !!profile?.id,
        staleTime: 60_000,
    });

    const { data: categories = [], isLoading: categoriesLoading } = useQuery({
        queryKey: ["admin-categories", "stats"],
        queryFn: getCategories,
        staleTime: 60_000,
    });

    const { data: blogArticles = [], isLoading: blogLoading } = useQuery({
        queryKey: ["admin-blog", "stats"],
        queryFn: () => getBlogArticles(false),
        staleTime: 60_000,
    });

    const statsLoading = usersLoading || eventsLoading || categoriesLoading || blogLoading;

    const stats = useMemo(() => {
        const now = new Date();
        const totalUsers = users.length;
        const verifiedUsers = users.filter((u) => Boolean(u.email_confirmed_at)).length;
        const activeUsers = users.filter((u) => u.profile?.is_active !== false).length;
        const inactiveUsers = Math.max(totalUsers - activeUsers, 0);
        const newUsersLast30Days = users.filter((u) => {
            const created = parseDateSafe(u.created_at);
            if (!created) return false;
            return now.getTime() - created.getTime() <= 30 * 24 * 60 * 60 * 1000;
        }).length;
        const organizersCount = users.filter((u) => ["instructor", "admin", "creator"].includes(u.profile?.role || "")).length;

        let activeEvents = 0;
        let pastEvents = 0;
        let paidEvents = 0;
        let freeEvents = 0;
        let totalDeclaredSpots = 0;
        const nations = new Set<string>();
        const categoryCountById: Record<string, number> = {};

        for (const ev of events) {
            const start = parseDateSafe(ev.date);
            const end = parseDateSafe(ev.end_date);
            const isActive = end ? end >= now : !!start && start >= now;
            if (isActive) activeEvents += 1;
            else pastEvents += 1;

            if ((ev.cost || 0) > 0) paidEvents += 1;
            else freeEvents += 1;

            totalDeclaredSpots += Number(ev.participants || 0);
            if (ev.nation?.trim()) nations.add(ev.nation.trim());
            categoryCountById[ev.category_id] = (categoryCountById[ev.category_id] || 0) + 1;
        }

        const avgDeclaredSpots = events.length > 0 ? Math.round(totalDeclaredSpots / events.length) : 0;

        const categoryNameById = new Map(categories.map((cat) => [cat.id, cat.name]));
        let topCategory = "-";
        let topCategoryCount = 0;
        for (const [categoryId, count] of Object.entries(categoryCountById)) {
            if (count > topCategoryCount) {
                topCategoryCount = count;
                topCategory = categoryNameById.get(categoryId) || "-";
            }
        }

        const publishedArticles = blogArticles.filter((item) => item.published).length;
        const drafts = Math.max(blogArticles.length - publishedArticles, 0);

        return {
            totalUsers,
            verifiedUsers,
            activeUsers,
            inactiveUsers,
            newUsersLast30Days,
            organizersCount,
            totalEvents: events.length,
            activeEvents,
            pastEvents,
            paidEvents,
            freeEvents,
            totalCategories: categories.length,
            categoriesWithEvents: categories.filter((cat) => Number(cat.events_count || 0) > 0).length,
            representedCountries: nations.size,
            avgDeclaredSpots,
            topCategory,
            topCategoryCount,
            totalBlogArticles: blogArticles.length,
            publishedArticles,
            drafts,
        };
    }, [users, events, categories, blogArticles]);

    const sections = [
        { id: "statistics" as const, icon: LayoutDashboard, label: t("admin_dashboard.tabs.statistics", "Statistiche") },
        { id: "events" as const, icon: Calendar, label: t("admin_dashboard.tabs.events", "Eventi") },
        { id: "categories" as const, icon: FolderTree, label: t("admin_dashboard.tabs.categories", "Categorie") },
        { id: "blog" as const, icon: FileText, label: t("admin_dashboard.tabs.blog", "Blog") },
        { id: "users" as const, icon: Users, label: t("admin_dashboard.tabs.users", "Utenti") },
        { id: "email" as const, icon: Mail, label: t("admin_dashboard.tabs.email", "Email") },
        { id: "seo" as const, icon: Globe, label: t("admin_dashboard.tabs.seo", "SEO") },
    ];

    const renderStatistics = () => (
        <div className="space-y-4 p-4 md:p-6">
            <h2 className="text-2xl font-semibold text-blue-900">{t("admin_dashboard.manage_statistics", "Statistiche Generali")}</h2>
            {statsLoading ? (
                <p className="text-sm text-gray-600">{t("common.loading", "Caricamento...")}</p>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-md border border-gray-200 bg-white p-4">
                        <p className="text-sm text-gray-600">Utenti registrati</p>
                        <div className="mt-2 flex items-center justify-between">
                            <p className="text-3xl font-bold">{stats.totalUsers}</p>
                            <Users className="h-5 w-5 text-blue-600" />
                        </div>
                    </div>
                    <div className="rounded-md border border-gray-200 bg-white p-4">
                        <p className="text-sm text-gray-600">Eventi registrati</p>
                        <div className="mt-2 flex items-center justify-between">
                            <p className="text-3xl font-bold">{stats.totalEvents}</p>
                            <Calendar className="h-5 w-5 text-emerald-600" />
                        </div>
                    </div>
                    <div className="rounded-md border border-gray-200 bg-white p-4">
                        <p className="text-sm text-gray-600">Utenti verificati</p>
                        <div className="mt-2 flex items-center justify-between">
                            <p className="text-3xl font-bold">{stats.verifiedUsers}</p>
                            <UserCheck className="h-5 w-5 text-indigo-600" />
                        </div>
                    </div>
                    <div className="rounded-md border border-gray-200 bg-white p-4">
                        <p className="text-sm text-gray-600">Nuovi utenti (30 gg)</p>
                        <div className="mt-2 flex items-center justify-between">
                            <p className="text-3xl font-bold">{stats.newUsersLast30Days}</p>
                            <UserPlus className="h-5 w-5 text-orange-600" />
                        </div>
                    </div>
                    <div className="rounded-md border border-gray-200 bg-white p-4">
                        <p className="text-sm text-gray-600">Eventi attivi</p>
                        <div className="mt-2 flex items-center justify-between">
                            <p className="text-2xl font-bold">{stats.activeEvents}</p>
                            <BarChart3 className="h-5 w-5 text-blue-600" />
                        </div>
                    </div>
                    <div className="rounded-md border border-gray-200 bg-white p-4">
                        <p className="text-sm text-gray-600">Eventi passati</p>
                        <div className="mt-2 flex items-center justify-between">
                            <p className="text-2xl font-bold">{stats.pastEvents}</p>
                            <Calendar className="h-5 w-5 text-gray-600" />
                        </div>
                    </div>
                    <div className="rounded-md border border-gray-200 bg-white p-4">
                        <p className="text-sm text-gray-600">Eventi a pagamento</p>
                        <div className="mt-2 flex items-center justify-between">
                            <p className="text-2xl font-bold">{stats.paidEvents}</p>
                            <BadgeEuro className="h-5 w-5 text-amber-600" />
                        </div>
                    </div>
                    <div className="rounded-md border border-gray-200 bg-white p-4">
                        <p className="text-sm text-gray-600">Eventi gratuiti</p>
                        <div className="mt-2 flex items-center justify-between">
                            <p className="text-2xl font-bold">{stats.freeEvents}</p>
                            <BadgeEuro className="h-5 w-5 text-emerald-600" />
                        </div>
                    </div>
                    <div className="rounded-md border border-gray-200 bg-white p-4">
                        <p className="text-sm text-gray-600">Nazioni coperte</p>
                        <div className="mt-2 flex items-center justify-between">
                            <p className="text-2xl font-bold">{stats.representedCountries}</p>
                            <MapPin className="h-5 w-5 text-red-600" />
                        </div>
                    </div>
                    <div className="rounded-md border border-gray-200 bg-white p-4">
                        <p className="text-sm text-gray-600">Media posti dichiarati</p>
                        <div className="mt-2 flex items-center justify-between">
                            <p className="text-2xl font-bold">{stats.avgDeclaredSpots}</p>
                            <Users className="h-5 w-5 text-purple-600" />
                        </div>
                    </div>
                    <div className="rounded-md border border-gray-200 bg-white p-4">
                        <p className="text-sm text-gray-600">Categorie con eventi</p>
                        <div className="mt-2 flex items-center justify-between">
                            <p className="text-2xl font-bold">{stats.categoriesWithEvents}/{stats.totalCategories}</p>
                            <FolderTree className="h-5 w-5 text-cyan-600" />
                        </div>
                    </div>
                    <div className="rounded-md border border-gray-200 bg-white p-4">
                        <p className="text-sm text-gray-600">Articoli blog</p>
                        <div className="mt-2 flex items-center justify-between">
                            <p className="text-2xl font-bold">{stats.totalBlogArticles}</p>
                            <Newspaper className="h-5 w-5 text-blue-700" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    const renderContent = () => {
        switch (activeSection) {
            case "statistics":
                return renderStatistics();
            case "events":
                return <div className="p-4 md:p-6"><EventsManager /></div>;
            case "categories":
                return <div className="p-4 md:p-6"><CategoriesManager /></div>;
            case "blog":
                return (
                    <div className="space-y-4 p-4 md:p-6">
                        <BlogManager />
                        <div className="border-t border-gray-200 pt-4">
                            <BlogTagManager />
                        </div>
                    </div>
                );
            case "users":
                return <div className="p-4 md:p-6"><UsersManager /></div>;
            case "email":
                return <div className="p-4 md:p-6"><EmailTemplatesManager /></div>;
            case "seo":
                return <div className="p-4 md:p-6"><SeoManager /></div>;
            default:
                return null;
        }
    };

    if (isMobile) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
                <div className="px-4 py-4 border-b border-gray-200 bg-white/80">
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {sections.map((section) => (
                            <button
                                key={section.id}
                                onClick={() => setActiveSection(section.id)}
                                className={`shrink-0 rounded-md px-3 py-2 text-sm font-medium border ${
                                    activeSection === section.id
                                        ? "bg-blue-600 text-white border-blue-600"
                                        : "bg-white text-gray-700 border-gray-200"
                                }`}
                            >
                                {section.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="pb-6 px-4 py-6">{renderContent()}</div>
            </div>
        );
    }

    return (
        <AdminLayout fullScreen>
            <div className="grid min-h-[calc(100vh-84px)] grid-cols-1 bg-white xl:grid-cols-[260px_minmax(0,1fr)]">
                <aside className="h-full border-r border-gray-200 bg-white xl:sticky xl:top-[84px]">
                    <div className="border-b border-gray-200 px-4 py-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-500">WeApnea</p>
                        <h2 className="text-base font-bold text-blue-900">Admin Panel</h2>
                    </div>
                    <nav className="p-2">
                        <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Navigazione</p>
                        {sections.map((section) => (
                            <button
                                key={section.id}
                                onClick={() => setActiveSection(section.id)}
                                className={`mb-1 flex w-full items-center gap-3 rounded-sm border-l-4 px-3 py-2 text-left text-sm font-medium transition ${
                                    activeSection === section.id
                                        ? "border-blue-600 bg-blue-50 text-blue-700"
                                        : "border-transparent text-gray-700 hover:bg-gray-50 hover:text-blue-700"
                                }`}
                            >
                                <section.icon className="h-4 w-4" />
                                <span>{section.label}</span>
                            </button>
                        ))}
                    </nav>
                </aside>

                <section className="bg-gray-50">
                    {renderContent()}
                </section>
            </div>
        </AdminLayout>
    );
};

export default AdminDashboard;
