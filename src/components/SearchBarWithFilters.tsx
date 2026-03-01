
import { useState } from "react";
import { Search, Calendar, Globe, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/DatePicker";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

interface SearchBarWithFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  nationFilter: string;
  onNationChange: (value: string) => void;
  dateFilter: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  nations?: string[];
  isMobile?: boolean;
}

export const SearchBarWithFilters = ({
  searchTerm,
  onSearchChange,
  nationFilter,
  onNationChange,
  dateFilter,
  onDateChange,
  nations = [],
  isMobile = false,
}: SearchBarWithFiltersProps) => {
  const { t } = useLanguage();
  return (
    <div className="relative max-w-4xl mx-auto">
      <div className={`relative bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border-0 overflow-hidden ${
        isMobile ? 'flex-col' : 'flex items-center'
      }`}>
        {/* Search Input */}
        <div className="flex-1 relative">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 z-10" />
          <Input
            placeholder={t('search_bar.placeholder', 'Cerca eventi, corsi, competizioni...')}
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className={`pl-14 pr-6 border-0 bg-transparent text-lg focus:ring-0 focus:outline-none ${
              isMobile ? 'h-14' : 'h-16'
            }`}
          />
        </div>

        {/* Vertical Separator */}
        {!isMobile && (
          <div className="w-px h-8 bg-gray-200"></div>
        )}

        {/* Nation Filter */}
        <div className={`relative ${isMobile ? 'border-t border-gray-200' : ''}`}>
          <Globe className={`absolute ${isMobile ? 'left-4' : 'left-6'} top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 z-10`} />
          <Select value={nationFilter} onValueChange={onNationChange}>
            <SelectTrigger className={`border-0 bg-transparent focus:ring-0 ${
              isMobile ? 'h-12 pl-12 w-full' : 'h-16 pl-12 w-48'
            }`}>
              <SelectValue placeholder={t('search_bar.all_nations', 'Tutte le Nazioni')} />
            </SelectTrigger>
            <SelectContent className="bg-white border shadow-xl z-50">
              <SelectItem value="all">{t('search_bar.all_nations', 'Tutte le Nazioni')}</SelectItem>
              {nations.map((nation) => (
                <SelectItem key={nation} value={nation}>
                  {nation}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Vertical Separator */}
        {!isMobile && (
          <div className="w-px h-8 bg-gray-200"></div>
        )}

        {/* Date Filter */}
        <div className={`relative ${isMobile ? 'border-t border-gray-200' : ''}`}>
          <Calendar className={`absolute ${isMobile ? 'left-4' : 'left-6'} top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 z-10`} />
          <div className={`${isMobile ? 'pl-12 pr-4 py-2' : 'pl-12 pr-6 py-4'} flex items-center ${isMobile ? 'h-12' : 'h-16'}`}>
            <DatePicker
              date={dateFilter}
              onDateChange={onDateChange}
              placeholder={t('search_bar.select_date', 'Seleziona data')}
              className="border-0 bg-transparent"
            />
          </div>
        </div>

        {/* Clear Filters Button (if any filters are active) */}
        {(nationFilter !== "all" || dateFilter) && (
          <>
            {!isMobile && <div className="w-px h-8 bg-gray-200"></div>}
            <div className={`${isMobile ? 'border-t border-gray-200 px-4 py-2' : 'px-4'}`}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onNationChange("all");
                  onDateChange(undefined);
                }}
                className="text-gray-500 hover:text-gray-700 p-2"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
