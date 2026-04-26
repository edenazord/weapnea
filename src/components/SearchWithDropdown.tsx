
import { useState, useRef, useEffect } from "react";
import { Search, Calendar, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MonthPicker } from "@/components/MonthPicker";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

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
    onDateChange(date);
  };

  const hasActiveFilters = nationFilter !== "all" || dateFilter || categoryFilter !== "all" || disciplineFilter !== "all";

  return (
    <div className="relative max-w-4xl mx-auto" ref={dropdownRef}>
      {/* Barra di ricerca compatta */}
      <div className="flex items-stretch bg-white rounded-2xl shadow-lg border border-gray-100">

        {/* Search Input */}
        <div className="flex-1 flex items-center px-4 min-w-0">
          <Search className="h-4 w-4 text-gray-400 shrink-0 mr-2" />
          <Input
            ref={inputRef}
            placeholder={t('search.placeholder', 'Cerca...')}
            value={searchTerm}
            onChange={handleInputChange}
            className="border-0 bg-transparent text-sm focus:ring-0 focus:outline-none h-14 p-0 placeholder:text-gray-400"
          />
          {searchTerm && (
            <button onClick={() => onSearchChange("")} className="ml-1 text-gray-400 hover:text-gray-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Separatore */}
        <div className="w-px bg-gray-200 self-stretch my-3" />

        {/* Filtro Tipologia (categoria) */}
        <div className="flex items-center px-2" style={{ minWidth: '160px' }}>
          <Select value={categoryFilter} onValueChange={onCategoryChange} onOpenChange={handleSelectOpen}>
            <SelectTrigger className="border-0 bg-transparent focus:ring-0 h-14 text-sm font-medium text-amber-500 hover:text-amber-600 w-full">
              <SelectValue placeholder={t('search.category', 'Tipologia')} />
            </SelectTrigger>
            <SelectContent className="bg-white border shadow-xl z-[60]">
              <SelectItem value="all">{t('search.all_categories', 'Tutte le Categorie')}</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.id === 'uncategorized'
                    ? t('search.uncategorized_trainings', 'Allenamenti (senza categoria)')
                    : category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Separatore */}
        <div className="w-px bg-gray-200 self-stretch my-3" />

        {/* Filtro Periodo (mese) */}
        <div className="flex items-center px-4" style={{ minWidth: '160px' }}>
          <div className="flex items-center gap-2 w-full">
            <MonthPicker
              date={dateFilter}
              onDateChange={handleDateChange}
              placeholder={t('search.period', 'Periodo')}
              className="border-0 bg-transparent text-sm text-gray-500 w-full"
            />
            <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
            {dateFilter && (
              <button onClick={() => onDateChange(undefined)} className="text-gray-400 hover:text-gray-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Bottone Cerca */}
        <Button
          onClick={() => setIsDropdownOpen(false)}
          className="rounded-none rounded-r-2xl h-full px-8 text-base font-semibold bg-primary hover:bg-primary/90 text-white shrink-0"
          style={{ minHeight: '56px' }}
        >
          {t('search.search_button', 'Cerca')}
        </Button>
      </div>

      {/* Filtri extra (nazione, disciplina) — mostrati solo se attivi */}
      {(nationFilter !== "all" || disciplineFilter !== "all") && (
        <div className="flex flex-wrap gap-2 mt-2 px-1">
          {nationFilter !== "all" && (
            <div className="flex items-center gap-1 bg-white rounded-full px-3 py-1 text-sm shadow border border-gray-100 text-gray-700">
              <span>{nationFilter}</span>
              <button onClick={() => onNationChange("all")} className="ml-1 text-gray-400 hover:text-gray-600">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          {disciplineFilter !== "all" && (
            <div className="flex items-center gap-1 bg-white rounded-full px-3 py-1 text-sm shadow border border-gray-100 text-gray-700">
              <span>{disciplineFilter}</span>
              <button onClick={() => onDisciplineChange("all")} className="ml-1 text-gray-400 hover:text-gray-600">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
