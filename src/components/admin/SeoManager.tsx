import { useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import { Save, Globe, ExternalLink } from "lucide-react";

interface LangData { title: string; description: string; }
interface SeoSetting {
  path: string;
  title: string | null;
  description: string | null;
  og_image: string | null;
  translations: Record<string, LangData> | null;
  updated_at: string | null;
}

const SUPPORTED_LANGS: { code: string; label: string }[] = [
  { code: "it", label: "🇮🇹 IT" },
  { code: "en", label: "🇬🇧 EN" },
  { code: "es", label: "🇪🇸 ES" },
  { code: "fr", label: "🇫🇷 FR" },
  { code: "pl", label: "🇵🇱 PL" },
  { code: "ru", label: "🇷🇺 RU" },
];

const STATIC_PAGES: { path: string; label: string; group: string }[] = [
  { path: "/", label: "Home", group: "Navbar" },
  { path: "/chi-siamo", label: "Chi Siamo", group: "Navbar" },
  { path: "/contattaci", label: "Contattaci", group: "Navbar" },
  { path: "/blog", label: "Blog", group: "Navbar" },
  { path: "/eventi-imminenti", label: "Eventi Imminenti", group: "Footer" },
  { path: "/privacy-policy", label: "Privacy Policy", group: "Footer" },
  { path: "/cookie-policy", label: "Cookie Policy", group: "Footer" },
  { path: "/forum", label: "Forum", group: "Altro" },
];

const DEFAULT_IT: Record<string, LangData> = {
  "/": { title: "WeApnea – Community Apnea & Freediving", description: "La community italiana per apneisti e freediver. Scopri eventi, corsi e allenamenti di apnea." },
  "/chi-siamo": { title: "Chi Siamo | WeApnea", description: "Scopri il team WeApnea e la nostra missione per la community dell'apnea e del freediving." },
  "/contattaci": { title: "Contattaci | WeApnea", description: "Hai domande o vuoi collaborare con WeApnea? Scrivici!" },
  "/blog": { title: "Blog | WeApnea", description: "Articoli, guide e approfondimenti sull'apnea e il freediving dalla community WeApnea." },
  "/eventi-imminenti": { title: "Eventi Imminenti | WeApnea", description: "Scopri i prossimi eventi di apnea e freediving nella community WeApnea." },
  "/forum": { title: "Forum | WeApnea", description: "Discussioni, consigli e domande sulla comunità di apnea e freediving su WeApnea." },
  "/privacy-policy": { title: "Privacy Policy | WeApnea", description: "Informativa sulla privacy di WeApnea." },
  "/cookie-policy": { title: "Cookie Policy | WeApnea", description: "Cookie policy di WeApnea." },
};

export default function SeoManager() {
  const [settings, setSettings] = useState<Record<string, SeoSetting>>({});
  const [activeLang, setActiveLang] = useState("it");
  const [langEdits, setLangEdits] = useState<Record<string, Record<string, Partial<LangData>>>>({});
  const [ogEdits, setOgEdits] = useState<Record<string, string>>({});
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

  const getSaved = (path: string, lang: string): LangData => {
    const s = settings[path];
    if (!s) return DEFAULT_IT[path] ?? { title: "", description: "" };
    if (lang === "it") return { title: s.title ?? "", description: s.description ?? "" };
    const tr = s.translations ?? {};
    return tr[lang] ?? { title: "", description: "" };
  };

  const getValue = (path: string, lang: string, field: keyof LangData): string => {
    const e = langEdits[path]?.[lang] ?? {};
    if (field in e) return e[field] ?? "";
    return getSaved(path, lang)[field] ?? "";
  };

  const setField = (path: string, lang: string, field: keyof LangData, value: string) => {
    setLangEdits(prev => ({
      ...prev,
      [path]: { ...(prev[path] ?? {}), [lang]: { ...((prev[path] ?? {})[lang] ?? {}), [field]: value } },
    }));
  };

  const getOgImage = (path: string) => path in ogEdits ? ogEdits[path] : (settings[path]?.og_image ?? "");

  const isDirty = (path: string): boolean => {
    const s = settings[path];
    if (path in ogEdits && (s?.og_image ?? "") !== ogEdits[path]) return true;
    const le = langEdits[path];
    if (!le) return false;
    for (const lang of Object.keys(le)) {
      const saved = getSaved(path, lang);
      const edit = le[lang] ?? {};
      if ("title" in edit && edit.title !== saved.title) return true;
      if ("description" in edit && edit.description !== saved.description) return true;
    }
    return false;
  };

  const handleSave = async (path: string) => {
    setSaving(prev => ({ ...prev, [path]: true }));
    try {
      const translations: Record<string, LangData> = {};
      for (const { code } of SUPPORTED_LANGS) {
        const saved = getSaved(path, code);
        const edit = langEdits[path]?.[code] ?? {};
        const merged = { title: ("title" in edit ? edit.title : saved.title) ?? "", description: ("description" in edit ? edit.description : saved.description) ?? "" };
        if (code !== "it") translations[code] = merged;
      }
      const itEdit = langEdits[path]?.["it"] ?? {};
      const itSaved = getSaved(path, "it");
      const saved = await apiSend("/api/admin/seo-settings", "PUT", {
        path,
        title: ("title" in itEdit ? itEdit.title : itSaved.title) || null,
        description: ("description" in itEdit ? itEdit.description : itSaved.description) || null,
        og_image: getOgImage(path) || null,
        translations,
      });
      setSettings(prev => ({ ...prev, [path]: saved as SeoSetting }));
      setLangEdits(prev => { const n = { ...prev }; delete n[path]; return n; });
      setOgEdits(prev => { const n = { ...prev }; delete n[path]; return n; });
      toast.success(`SEO salvato per ${path}`);
    } catch (e: any) {
      toast.error(e?.message || "Errore nel salvataggio");
    } finally {
      setSaving(prev => ({ ...prev, [path]: false }));
    }
  };

  const GROUPS = [
    { key: "Navbar", label: "Pagine Navbar" },
    { key: "Footer", label: "Pagine Footer" },
    { key: "Altro", label: "Altre pagine" },
  ] as const;

  if (loading) return <p className="text-gray-500 text-sm py-4">Caricamento impostazioni SEO…</p>;

  return (
    <div className="space-y-6">
      {/* Language selector */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-600 font-medium">
          <Globe className="h-4 w-4 text-blue-500" />
          Lingua:
        </div>
        <Tabs value={activeLang} onValueChange={setActiveLang}>
          <TabsList>
            {SUPPORTED_LANGS.map(l => (
              <TabsTrigger key={l.code} value={l.code} className="text-xs px-3">{l.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <p className="text-sm text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
        Stai modificando in <strong>{SUPPORTED_LANGS.find(l => l.code === activeLang)?.label}</strong>.
        {activeLang === "it" ? " Usato come fallback per tutte le altre lingue." : " Lascia vuoto per usare il testo italiano come fallback."}
      </p>

      {GROUPS.map(({ key: group, label }) => {
        const pages = STATIC_PAGES.filter(p => p.group === group);
        if (!pages.length) return null;
        return (
          <div key={group} className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide px-1">{label}</h3>
            <Accordion type="multiple" className="space-y-1">
              {pages.map(({ path, label: pageLabel }) => {
                const dirty = isDirty(path);
                const titleVal = getValue(path, activeLang, "title");
                const descVal = getValue(path, activeLang, "description");
                const itDefaults = DEFAULT_IT[path] ?? { title: "", description: "" };
                const saved = settings[path];

                return (
                  <AccordionItem
                    key={path}
                    value={path}
                    className={`border rounded-lg px-0 ${dirty ? "border-blue-300 ring-1 ring-blue-300" : "border-gray-200"}`}
                  >
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center gap-2 flex-wrap text-left w-full mr-2">
                        <span className="text-sm font-semibold text-gray-800">{pageLabel}</span>
                        <code className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{path}</code>
                        <a
                          href={`https://www.weapnea.com${path}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-blue-600"
                          onClick={e => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        {dirty && <Badge variant="secondary" className="text-xs ml-1">Non salvato</Badge>}
                        {saved?.updated_at && !dirty && (
                          <span className="text-xs text-gray-400 ml-auto">{new Date(saved.updated_at).toLocaleDateString("it-IT")}</span>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 space-y-3">
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">
                          Titolo SEO <span className="text-gray-400 font-normal">(max 60 caratteri)</span>
                        </label>
                        <Input
                          value={titleVal}
                          placeholder={activeLang !== "it" ? (getSaved(path, "it").title || itDefaults.title) : itDefaults.title}
                          onChange={e => setField(path, activeLang, "title", e.target.value)}
                          maxLength={80}
                          className="text-sm"
                        />
                        <p className="text-xs text-gray-400 mt-1">{titleVal.length}/60</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">
                          Descrizione SEO <span className="text-gray-400 font-normal">(max 160 caratteri)</span>
                        </label>
                        <Textarea
                          value={descVal}
                          placeholder={activeLang !== "it" ? (getSaved(path, "it").description || itDefaults.description) : itDefaults.description}
                          onChange={e => setField(path, activeLang, "description", e.target.value)}
                          maxLength={200}
                          rows={2}
                          className="text-sm resize-none"
                        />
                        <p className="text-xs text-gray-400 mt-1">{descVal.length}/160</p>
                      </div>
                      {activeLang === "it" && (
                        <div>
                          <label className="text-xs font-medium text-gray-600 mb-1 block">
                            Immagine Open Graph <span className="text-gray-400 font-normal">(URL – uguale per tutte le lingue)</span>
                          </label>
                          <Input
                            value={getOgImage(path)}
                            placeholder="/images/weapnea-logo.png"
                            onChange={e => setOgEdits(prev => ({ ...prev, [path]: e.target.value }))}
                            className="text-sm font-mono"
                          />
                        </div>
                      )}
                      <div className="flex justify-end pt-1">
                        <Button
                          size="sm"
                          disabled={!dirty || saving[path]}
                          onClick={() => handleSave(path)}
                          className="h-7 px-4 text-xs"
                        >
                          <Save className="h-3.5 w-3.5 mr-1" />
                          {saving[path] ? "Salvataggio…" : "Salva"}
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        );
      })}
    </div>
  );
}
