
import { useState, useRef, useEffect } from "react";
import { Search, Globe, X, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MonthPicker } from "@/components/MonthPicker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { localizeCategoryName } from "@/lib/i18n-utils";

interface SearchWithDropdownProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  nationFilter: string;
  onNationChange: (value: string) => void;
  dateFilter: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  categoryFilter: string;
  onCategoryChange: (value: string) => void;
  disciplineFilter: string;
  onDisciplineChange: (value: string) => void;
  nations?: string[];
  categories?: Array<{ id: string; name: string }>;
  isMobile?: boolean;
}

export const SearchWithDropdown = ({
  searchTerm,
  onSearchChange,
  nationFilter,
  onNationChange,
  dateFilter,
  onDateChange,
  categoryFilter,
  onCategoryChange,
  disciplineFilter,
  onDisciplineChange,
  nations = [],
  categories = [],
  isMobile = false,
}: SearchWithDropdownProps) => {
  const { t, currentLanguage } = useLanguage();
  
  console.log('🔍 SearchWithDropdown rendering with language:', currentLanguage);
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [preventClose, setPreventClose] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Chiudi dropdown quando clicchi fuori
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        if (!preventClose) {
          console.log("Chiusura dropdown da click esterno");
          setIsDropdownOpen(false);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [preventClose]);

  const handleInputClick = () => {
    setIsDropdownOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    onSearchChange(value);
  };

  const clearAllFilters = () => {
    onSearchChange("");
    onNationChange("all");
    onDateChange(undefined);
    onCategoryChange("all");
    onDisciplineChange("all");
    setIsDropdownOpen(false);
    inputRef.current?.blur();
  };

  const handleSelectOpen = (isOpen: boolean) => {
    setPreventClose(isOpen);
  };

  const handleDateChange = (date: Date | undefined) => {
    console.log("SearchWithDropdown - Data cambiata:", date);
    onDateChange(date);
    // Il dropdown principale rimane aperto
  };

  const hasActiveFilters = nationFilter !== "all" || dateFilter || categoryFilter !== "all" || disciplineFilter !== "all";

  return (
    <div className="relative max-w-4xl mx-auto" ref={dropdownRef}>
      {/* Barra di ricerca principale */}
      <div className="relative gradient-border hover:scale-[1.01] transition-all duration-200">
        <div className="gradient-border-inner rounded-lg shadow-md hover:shadow-lg overflow-hidden transition-all duration-200">
          <div className="flex items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/50 z-10" />
              <Input
                ref={inputRef}
                placeholder={t('search.placeholder', 'Cerca eventi, corsi, competizioni...')}
                value={searchTerm}
                onChange={handleInputChange}
                onClick={handleInputClick}
                className={`pl-14 pr-6 border-0 bg-transparent text-base focus:ring-0 focus:outline-none cursor-pointer placeholder:text-muted-foreground ${
                  isMobile ? 'h-14' : 'h-16'
                }`}
              />
            </div>

            {/* Indicatore filtri attivi */}
            {hasActiveFilters && (
              <div className="px-4">
                <div className="flex items-center space-x-2 text-primary">
                  <Filter className="h-4 w-4" />
                  <span className="text-sm font-medium">{t('search.active_filters', 'Filtri attivi')}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllFilters}
                    className="text-primary/70 hover:text-primary hover:bg-primary/10 p-1 rounded-full"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dropdown filtri */}
      {isDropdownOpen && (
        <Card className="absolute top-full left-0 right-0 mt-2 p-6 bg-white/95 backdrop-blur-sm shadow-xl border-0 z-50 rounded-2xl">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{t('search.filter_results', 'Filtra i tuoi risultati')}</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsDropdownOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className={`grid gap-6 ${isMobile ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-4'}`}>
              {/* Filtro Categoria */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('search.category', 'Categoria')}</label>
                <Select 
                  value={categoryFilter} 
                  onValueChange={onCategoryChange}
                  onOpenChange={handleSelectOpen}
                >
                  <SelectTrigger className="border border-gray-200 bg-white">
                    <SelectValue placeholder={t('search.all_categories', 'Tutte le Categorie')} />
                  </SelectTrigger>
                  <SelectContent className="bg-white border shadow-xl z-[60]">
                    <SelectItem value="all">{t('search.all_categories', 'Tutte le Categorie')}</SelectItem>
          {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
            {localizeCategoryName(category.name, t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro Disciplina */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('search.discipline', 'Disciplina')}</label>
                <Select 
                  value={disciplineFilter} 
                  onValueChange={onDisciplineChange}
                  onOpenChange={handleSelectOpen}
                >
                  <SelectTrigger className="border border-gray-200 bg-white">
                    <SelectValue placeholder={t('search.all_disciplines', 'Tutte le Discipline')} />
                  </SelectTrigger>
                  <SelectContent className="bg-white border shadow-xl z-[60]">
                    <SelectItem value="all">{t('search.all_disciplines', 'Tutte le Discipline')}</SelectItem>
                    <SelectItem value="indoor">{t('search.disciplines.indoor', 'Indoor')}</SelectItem>
                    <SelectItem value="outdoor">{t('search.disciplines.outdoor', 'Outdoor')}</SelectItem>
                    <SelectItem value="indoor&outdoor">{t('search.disciplines.indoor_outdoor', 'Indoor & Outdoor')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro Nazione */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('search.nation', 'Nazione')}</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
                  <Select 
                    value={nationFilter} 
                    onValueChange={onNationChange}
                    onOpenChange={handleSelectOpen}
                  >
                    <SelectTrigger className="border border-gray-200 bg-white pl-10">
                      <SelectValue placeholder={t('search.all_nations', 'Tutte le Nazioni')} />
                    </SelectTrigger>
                    <SelectContent className="bg-white border shadow-xl z-[60]">
                      <SelectItem value="all">{t('search.all_nations', 'Tutte le Nazioni')}</SelectItem>
                      {nations.map((nation) => (
                        <SelectItem key={nation} value={nation}>
                          {nation}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Filtro Data */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('search.date', 'Data')}</label>
                <div className="border border-gray-200 rounded-md bg-white min-h-[40px] flex items-center px-3 py-2">
                  <MonthPicker
                    date={dateFilter}
                    onDateChange={handleDateChange}
                    placeholder={t('search.select_month', 'Seleziona mese')}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
