
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
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
    LayoutDashboard,
    Calendar,
    FolderTree,
    FileText,
    Users,
    Mail,
    Globe,
    BarChart3,
    BadgeEuro,
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

    const statsLoading = usersLoading || eventsLoading || categoriesLoading;

    const stats = useMemo(() => {
        const now = new Date();
        const totalUsers = users.length;
        const activeUsers = users.filter((u) => u.profile?.is_active !== false).length;
        const newUsersLast30Days = users.filter((u) => {
            const created = parseDateSafe(u.created_at);
            if (!created) return false;
            return now.getTime() - created.getTime() <= 30 * 24 * 60 * 60 * 1000;
        }).length;
        const organizerIds = new Set<string>();

        let activeEvents = 0;
        let pastEvents = 0;
        let paidEvents = 0;
        let freeEvents = 0;
        let totalDeclaredSpots = 0;
        let totalEventRegistrations = 0;
        let totalFreeEventRegistrations = 0;
        let totalPaidEventRegistrations = 0;
        let totalPaidParticipants = 0;
        let totalRevenue = 0;
        const nations = new Set<string>();
        const categoryCountById: Record<string, number> = {};

        for (const ev of events) {
            if (ev.created_by) organizerIds.add(ev.created_by);
            if (Array.isArray(ev.coorganizers)) {
                for (const co of ev.coorganizers) {
                    if (co?.status === "accepted" && co.user_id) {
                        organizerIds.add(co.user_id);
                    }
                }
            }

            const start = parseDateSafe(ev.date);
            const end = parseDateSafe(ev.end_date);
            const isActive = end ? end >= now : !!start && start >= now;
            if (isActive) activeEvents += 1;
            else pastEvents += 1;

            const eventCost = Number(ev.cost || 0);
            const paidParticipants = Number(ev.participants_paid_count || 0);
            totalEventRegistrations += paidParticipants;
            if (eventCost > 0) {
                paidEvents += 1;
                totalPaidEventRegistrations += paidParticipants;
                totalPaidParticipants += paidParticipants;
                totalRevenue += eventCost * paidParticipants;
            } else {
                freeEvents += 1;
                totalFreeEventRegistrations += paidParticipants;
            }

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

        return {
            totalUsers,
            activeUsers,
            newUsersLast30Days,
            organizersCount: organizerIds.size,
            totalEvents: events.length,
            activeEvents,
            pastEvents,
            paidEvents,
            freeEvents,
            totalEventRegistrations,
            totalFreeEventRegistrations,
            totalPaidEventRegistrations,
            totalPaidParticipants,
            totalRevenue,
            totalCategories: categories.length,
            categoriesWithEvents: categories.filter((cat) => Number(cat.events_count || 0) > 0).length,
            representedCountries: nations.size,
            avgDeclaredSpots,
            topCategory,
            topCategoryCount,
        };
    }, [users, events, categories]);

    const sections = [
        { id: "statistics" as const, icon: LayoutDashboard, label: t("admin_dashboard.tabs.statistics", "Statistiche") },
        { id: "events" as const, icon: Calendar, label: t("admin_dashboard.tabs.events", "Eventi") },
        { id: "categories" as const, icon: FolderTree, label: t("admin_dashboard.tabs.categories", "Categorie") },
        { id: "blog" as const, icon: FileText, label: t("admin_dashboard.tabs.blog", "Blog") },
        { id: "users" as const, icon: Users, label: t("admin_dashboard.tabs.users", "Utenti") },
        { id: "email" as const, icon: Mail, label: t("admin_dashboard.tabs.email", "Email") },
        { id: "seo" as const, icon: Globe, label: t("admin_dashboard.tabs.seo", "SEO") },
    ];

    const renderStatistics = () => {
        const newUsersRate = stats.totalUsers > 0 ? Math.round((stats.newUsersLast30Days / stats.totalUsers) * 100) : 0;
        const activeEventsRate = stats.totalEvents > 0 ? Math.round((stats.activeEvents / stats.totalEvents) * 100) : 0;
        const paidEventsRate = stats.totalEvents > 0 ? Math.round((stats.paidEvents / stats.totalEvents) * 100) : 0;
        const chartDataByMonth = new Map<string, { month: string; iscrittiEventi: number; ricaviTotali: number }>();

        for (const ev of events) {
            const sourceDate = parseDateSafe(ev.date) || parseDateSafe(ev.created_at);
            if (!sourceDate) continue;
            const key = `${sourceDate.getFullYear()}-${String(sourceDate.getMonth() + 1).padStart(2, "0")}`;
            const monthLabel = sourceDate.toLocaleDateString("it-IT", { month: "short", year: "2-digit" });

            if (!chartDataByMonth.has(key)) {
                chartDataByMonth.set(key, {
                    month: monthLabel,
                    iscrittiEventi: 0,
                    ricaviTotali: 0,
                });
            }

            const row = chartDataByMonth.get(key)!;
            const paidParticipants = Number(ev.participants_paid_count || 0);
            const eventCost = Number(ev.cost || 0);
            row.iscrittiEventi += paidParticipants;
            row.ricaviTotali += eventCost > 0 ? eventCost * paidParticipants : 0;
        }

        const registrationsRevenueChartData = Array.from(chartDataByMonth.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([, value]) => value);

        const chartConfig = {
            iscrittiEventi: {
                label: "Iscritti eventi",
                color: "hsl(221 83% 53%)",
            },
            ricaviTotali: {
                label: "Ricavi totali stimati",
                color: "hsl(160 84% 39%)",
            },
        } satisfies ChartConfig;

        return (
            <div className="space-y-6 p-4 md:p-6">
                {statsLoading ? (
                    <p className="text-sm text-gray-600">{t("common.loading", "Caricamento...")}</p>
                ) : (
                    <>
                        <section className="rounded-md border border-gray-200 bg-white p-4">
                            <div className="mb-3 flex items-center justify-between">
                                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">Trend Iscritti e Ricavi</h3>
                                <BarChart3 className="h-4 w-4 text-blue-600" />
                            </div>
                            {registrationsRevenueChartData.length === 0 ? (
                                <p className="text-sm text-gray-500">Nessun dato disponibile per il grafico.</p>
                            ) : (
                                <ChartContainer config={chartConfig} className="h-[260px] w-full">
                                    <LineChart data={registrationsRevenueChartData}>
                                        <CartesianGrid vertical={false} />
                                        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                                        <YAxis yAxisId="left" tickLine={false} axisLine={false} width={42} />
                                        <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} width={54} />
                                        <ChartTooltip
                                            cursor={false}
                                            content={<ChartTooltipContent indicator="line" />}
                                        />
                                        <Line
                                            yAxisId="left"
                                            type="monotone"
                                            dataKey="iscrittiEventi"
                                            stroke="var(--color-iscrittiEventi)"
                                            strokeWidth={2}
                                            dot={false}
                                        />
                                        <Line
                                            yAxisId="right"
                                            type="monotone"
                                            dataKey="ricaviTotali"
                                            stroke="var(--color-ricaviTotali)"
                                            strokeWidth={2}
                                            dot={false}
                                        />
                                    </LineChart>
                                </ChartContainer>
                            )}
                        </section>

                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-md border border-gray-200 bg-white p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Utenti</p>
                                <div className="mt-2 flex items-center justify-between">
                                    <p className="text-3xl font-bold text-gray-900">{stats.totalUsers}</p>
                                    <Users className="h-5 w-5 text-blue-600" />
                                </div>
                                <p className="mt-1 text-xs text-gray-500">Account registrati</p>
                            </div>

                            <div className="rounded-md border border-gray-200 bg-white p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Eventi attivi</p>
                                <div className="mt-2 flex items-center justify-between">
                                    <p className="text-3xl font-bold text-gray-900">{stats.activeEvents}</p>
                                    <BarChart3 className="h-5 w-5 text-emerald-600" />
                                </div>
                                <p className="mt-1 text-xs text-gray-500">Su {stats.totalEvents} eventi totali</p>
                            </div>

                            <div className="rounded-md border border-gray-200 bg-white p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Iscritti eventi</p>
                                <div className="mt-2 flex items-center justify-between">
                                    <p className="text-3xl font-bold text-gray-900">{stats.totalEventRegistrations}</p>
                                    <Users className="h-5 w-5 text-red-600" />
                                </div>
                                <p className="mt-1 text-xs text-gray-500">Iscritti totali ad eventi (gratuiti e paganti)</p>
                            </div>

                            <div className="rounded-md border border-gray-200 bg-white p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Guadagni</p>
                                <div className="mt-2 flex items-center justify-between">
                                    <p className="text-3xl font-bold text-gray-900">€{stats.totalRevenue.toFixed(0)}</p>
                                    <BadgeEuro className="h-5 w-5 text-indigo-600" />
                                </div>
                                <p className="mt-1 text-xs text-gray-500">Ricavi stimati da eventi a pagamento</p>
                            </div>
                        </div>

                        <div className="grid gap-4 xl:grid-cols-2">
                            <section className="rounded-md border border-gray-200 bg-white p-4">
                                <div className="mb-3 flex items-center justify-between">
                                    <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">Utenti</h3>
                                    <Users className="h-4 w-4 text-blue-600" />
                                </div>
                                <div className="space-y-2 text-sm">
                                    <div className="flex items-center justify-between border-b border-gray-100 pb-2"><span className="text-gray-600">Utenti</span><span className="font-semibold">{stats.totalUsers}</span></div>
                                    <div className="flex items-center justify-between border-b border-gray-100 pb-2"><span className="text-gray-600">Nuovi utenti (30 gg)</span><span className="font-semibold">{stats.newUsersLast30Days}</span></div>
                                    <div className="flex items-center justify-between border-b border-gray-100 pb-2"><span className="text-gray-600">Iscritti eventi</span><span className="font-semibold">{stats.totalEventRegistrations}</span></div>
                                    <div className="flex items-center justify-between border-b border-gray-100 pb-2"><span className="text-gray-600">Iscritti eventi gratuiti</span><span className="font-semibold">{stats.totalFreeEventRegistrations}</span></div>
                                    <div className="flex items-center justify-between border-b border-gray-100 pb-2"><span className="text-gray-600">Iscritti eventi a pagamento</span><span className="font-semibold">{stats.totalPaidEventRegistrations}</span></div>
                                    <div className="flex items-center justify-between"><span className="text-gray-600">Organizzatori + co</span><span className="font-semibold">{stats.organizersCount}</span></div>
                                </div>
                                <div className="mt-4 space-y-3">
                                    <div>
                                        <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
                                            <span>Nuovi utenti su totale (30 gg)</span>
                                            <span>{newUsersRate}%</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-gray-100"><div className="h-2 rounded-full bg-emerald-600" style={{ width: `${newUsersRate}%` }} /></div>
                                    </div>
                                </div>
                            </section>

                            <section className="rounded-md border border-gray-200 bg-white p-4">
                                <div className="mb-3 flex items-center justify-between">
                                    <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">Eventi</h3>
                                    <Calendar className="h-4 w-4 text-emerald-600" />
                                </div>
                                <div className="space-y-2 text-sm">
                                    <div className="flex items-center justify-between border-b border-gray-100 pb-2"><span className="text-gray-600">Eventi totali</span><span className="font-semibold">{stats.totalEvents}</span></div>
                                    <div className="flex items-center justify-between border-b border-gray-100 pb-2"><span className="text-gray-600">Eventi attivi</span><span className="font-semibold">{stats.activeEvents}</span></div>
                                    <div className="flex items-center justify-between border-b border-gray-100 pb-2"><span className="text-gray-600">Eventi passati</span><span className="font-semibold">{stats.pastEvents}</span></div>
                                    <div className="flex items-center justify-between border-b border-gray-100 pb-2"><span className="text-gray-600">Eventi a pagamento</span><span className="font-semibold">{stats.paidEvents}</span></div>
                                    <div className="flex items-center justify-between border-b border-gray-100 pb-2"><span className="text-gray-600">Eventi gratuiti</span><span className="font-semibold">{stats.freeEvents}</span></div>
                                    <div className="flex items-center justify-between"><span className="text-gray-600">Media posti dichiarati</span><span className="font-semibold">{stats.avgDeclaredSpots}</span></div>
                                </div>
                                <div className="mt-4">
                                    <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
                                        <span>Incidenza eventi attivi</span>
                                        <span>{activeEventsRate}%</span>
                                    </div>
                                    <div className="h-2 rounded-full bg-gray-100"><div className="h-2 rounded-full bg-emerald-600" style={{ width: `${activeEventsRate}%` }} /></div>
                                </div>
                            </section>

                            <section className="rounded-md border border-gray-200 bg-white p-4">
                                <div className="mb-3 flex items-center justify-between">
                                    <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">Copertura e tassonomia</h3>
                                    <FolderTree className="h-4 w-4 text-cyan-600" />
                                </div>
                                <div className="space-y-2 text-sm">
                                    <div className="flex items-center justify-between border-b border-gray-100 pb-2"><span className="text-gray-600">Nazioni coperte</span><span className="font-semibold">{stats.representedCountries}</span></div>
                                    <div className="flex items-center justify-between border-b border-gray-100 pb-2"><span className="text-gray-600">Categorie totali</span><span className="font-semibold">{stats.totalCategories}</span></div>
                                    <div className="flex items-center justify-between border-b border-gray-100 pb-2"><span className="text-gray-600">Categorie con eventi</span><span className="font-semibold">{stats.categoriesWithEvents}</span></div>
                                    <div className="flex items-center justify-between"><span className="text-gray-600">Top categoria</span><span className="font-semibold">{stats.topCategory} ({stats.topCategoryCount})</span></div>
                                </div>
                            </section>

                            <section className="rounded-md border border-gray-200 bg-white p-4">
                                <div className="mb-3 flex items-center justify-between">
                                    <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">Guadagni</h3>
                                    <BadgeEuro className="h-4 w-4 text-indigo-600" />
                                </div>
                                <div className="space-y-2 text-sm">
                                    <div className="flex items-center justify-between border-b border-gray-100 pb-2"><span className="text-gray-600">Ricavi totali stimati</span><span className="font-semibold">€{stats.totalRevenue.toFixed(2)}</span></div>
                                    <div className="flex items-center justify-between border-b border-gray-100 pb-2"><span className="text-gray-600">Iscritti paganti</span><span className="font-semibold">{stats.totalPaidParticipants}</span></div>
                                    <div className="flex items-center justify-between"><span className="text-gray-600">Ricavo medio per iscritto</span><span className="font-semibold">€{stats.totalPaidParticipants > 0 ? (stats.totalRevenue / stats.totalPaidParticipants).toFixed(2) : "0.00"}</span></div>
                                </div>
                                <div className="mt-4">
                                    <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
                                        <span>Quota eventi a pagamento</span>
                                        <span>{paidEventsRate}%</span>
                                    </div>
                                    <div className="h-2 rounded-full bg-gray-100"><div className="h-2 rounded-full bg-indigo-600" style={{ width: `${paidEventsRate}%` }} /></div>
                                </div>
                            </section>
                        </div>
                    </>
                )}
            </div>
        );
    };

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
                    <nav className="p-2">
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
