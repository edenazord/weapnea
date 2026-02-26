import { useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, Globe, ExternalLink } from "lucide-react";

interface SeoSetting {
  path: string;
  title: string | null;
  description: string | null;
  og_image: string | null;
  updated_at: string | null;
}

const STATIC_PAGES: { path: string; label: string; group: string }[] = [
  // Navbar
  { path: "/", label: "Home", group: "Navbar" },
  { path: "/chi-siamo", label: "Chi Siamo", group: "Navbar" },
  { path: "/contattaci", label: "Contattaci", group: "Navbar" },
  { path: "/blog", label: "Blog", group: "Navbar" },
  // Footer extras
  { path: "/eventi-imminenti", label: "Eventi Imminenti", group: "Footer" },
  { path: "/forum", label: "Forum", group: "Footer" },
  { path: "/privacy-policy", label: "Privacy Policy", group: "Footer" },
  { path: "/cookie-policy", label: "Cookie Policy", group: "Footer" },
];

const DEFAULT_PLACEHOLDERS: Record<string, { title: string; description: string }> = {
  "/": {
    title: "WeApnea – Community Apnea & Freediving",
    description: "La community italiana per apneisti e freediver. Scopri eventi, corsi e allenamenti di apnea.",
  },
  "/chi-siamo": {
    title: "Chi Siamo | WeApnea",
    description: "Scopri il team WeApnea e la nostra missione per la community dell'apnea e del freediving.",
  },
  "/contattaci": {
    title: "Contattaci | WeApnea",
    description: "Hai domande o vuoi collaborare con WeApnea? Scrivici!",
  },
  "/blog": {
    title: "Blog | WeApnea",
    description: "Articoli, guide e approfondimenti sull'apnea e il freediving dalla community WeApnea.",
  },
  "/eventi-imminenti": {
    title: "Eventi Imminenti | WeApnea",
    description: "Scopri i prossimi eventi di apnea e freediving nella community WeApnea.",
  },
  "/forum": {
    title: "Forum | WeApnea",
    description: "Discussioni, consigli e domande sulla comunità di apnea e freediving su WeApnea.",
  },
  "/privacy-policy": {
    title: "Privacy Policy | WeApnea",
    description: "Informativa sulla privacy di WeApnea – come trattiamo i tuoi dati personali.",
  },
  "/cookie-policy": {
    title: "Cookie Policy | WeApnea",
    description: "Cookie policy di WeApnea – tipologie di cookie utilizzati e come gestirli.",
  },
};

export default function SeoManager() {
  const [settings, setSettings] = useState<Record<string, SeoSetting>>({});
  const [editing, setEditing] = useState<Record<string, Partial<SeoSetting>>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet("/api/admin/seo-settings")
      .then((rows: SeoSetting[]) => {
        const map: Record<string, SeoSetting> = {};
        for (const r of rows) map[r.path] = r;
        setSettings(map);
      })
      .catch(() => toast.error("Errore nel caricamento impostazioni SEO"))
      .finally(() => setLoading(false));
  }, []);

  const getEditing = (path: string): Partial<SeoSetting> =>
    editing[path] ?? {
      title: settings[path]?.title ?? "",
      description: settings[path]?.description ?? "",
      og_image: settings[path]?.og_image ?? "",
    };

  const setField = (path: string, field: keyof SeoSetting, value: string) => {
    setEditing((prev) => ({
      ...prev,
      [path]: { ...getEditing(path), [field]: value },
    }));
  };

  const handleSave = async (path: string) => {
    setSaving((prev) => ({ ...prev, [path]: true }));
    try {
      const data = getEditing(path);
      const saved = await apiSend("/api/admin/seo-settings", "PUT", {
        path,
        title: data.title || null,
        description: data.description || null,
        og_image: data.og_image || null,
      });
      setSettings((prev) => ({ ...prev, [path]: saved as SeoSetting }));
      setEditing((prev) => {
        const next = { ...prev };
        delete next[path];
        return next;
      });
      toast.success(`SEO salvato per ${path}`);
    } catch (e: any) {
      toast.error(e?.message || "Errore nel salvataggio");
    } finally {
      setSaving((prev) => ({ ...prev, [path]: false }));
    }
  };

  const isDirty = (path: string): boolean => {
    if (!editing[path]) return false;
    const e = editing[path];
    const s = settings[path];
    return (
      (e.title ?? "") !== (s?.title ?? "") ||
      (e.description ?? "") !== (s?.description ?? "") ||
      (e.og_image ?? "") !== (s?.og_image ?? "")
    );
  };

  const groups = Array.from(new Set(STATIC_PAGES.map((p) => p.group)));

  if (loading) {
    return <p className="text-gray-500 text-sm py-4">Caricamento impostazioni SEO…</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2 text-sm text-gray-500 bg-blue-50 border border-blue-100 rounded-lg p-3">
        <Globe className="h-4 w-4 text-blue-500 shrink-0" />
        <span>
          Le impostazioni SEO configurate qui vengono usate dai motori di ricerca (Google, Bing) e dalle anteprime sui social (WhatsApp, Telegram, Facebook). Per ogni pagina puoi impostare <strong>Titolo</strong>, <strong>Descrizione</strong> e <strong>Immagine Open Graph</strong> (URL pubblico).
        </span>
      </div>

      {groups.map((group) => (
        <div key={group} className="space-y-4">
          <h3 className="text-base font-semibold text-gray-700 border-b pb-2">
            {group === "Navbar" ? "Pagine Navbar" : "Pagine Footer"}
          </h3>
          <div className="grid gap-4">
            {STATIC_PAGES.filter((p) => p.group === group).map(({ path, label }) => {
              const e = getEditing(path);
              const saved = settings[path];
              const placeholder = DEFAULT_PLACEHOLDERS[path] ?? { title: "", description: "" };
              const dirty = isDirty(path);

              return (
                <Card key={path} className={dirty ? "border-blue-300 ring-1 ring-blue-300" : ""}>
                  <CardHeader className="py-3 px-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-sm font-semibold">{label}</CardTitle>
                        <code className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{path}</code>
                        <a
                          href={`https://www.weapnea.com${path}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-blue-600"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                      <div className="flex items-center gap-2">
                        {saved?.updated_at && (
                          <span className="text-xs text-gray-400">
                            Salvato: {new Date(saved.updated_at).toLocaleDateString("it-IT")}
                          </span>
                        )}
                        {dirty && <Badge variant="secondary" className="text-xs">Non salvato</Badge>}
                        <Button
                          size="sm"
                          disabled={!dirty || saving[path]}
                          onClick={() => handleSave(path)}
                          className="h-7 px-3 text-xs"
                        >
                          <Save className="h-3.5 w-3.5 mr-1" />
                          {saving[path] ? "Salvataggio…" : "Salva"}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="py-3 px-4 space-y-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">
                        Titolo SEO <span className="text-gray-400 font-normal">(max 60 caratteri)</span>
                      </label>
                      <Input
                        value={e.title ?? ""}
                        placeholder={placeholder.title}
                        onChange={(ev) => setField(path, "title", ev.target.value)}
                        maxLength={80}
                        className="text-sm"
                      />
                      <p className="text-xs text-gray-400 mt-1">{(e.title ?? "").length}/60</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">
                        Descrizione SEO <span className="text-gray-400 font-normal">(max 160 caratteri)</span>
                      </label>
                      <Textarea
                        value={e.description ?? ""}
                        placeholder={placeholder.description}
                        onChange={(ev) => setField(path, "description", ev.target.value)}
                        maxLength={200}
                        rows={2}
                        className="text-sm resize-none"
                      />
                      <p className="text-xs text-gray-400 mt-1">{(e.description ?? "").length}/160</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">
                        Immagine Open Graph <span className="text-gray-400 font-normal">(URL pubblico, es. /images/chi-siamo.jpg)</span>
                      </label>
                      <Input
                        value={e.og_image ?? ""}
                        placeholder="/images/weapnea-logo.png"
                        onChange={(ev) => setField(path, "og_image", ev.target.value)}
                        className="text-sm font-mono"
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
