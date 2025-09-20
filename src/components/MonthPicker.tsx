import * as React from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface MonthPickerProps {
  date?: Date;
  onDateChange: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
}

export function MonthPicker({ 
  date, 
  onDateChange, 
  placeholder = "Seleziona mese",
  className 
}: MonthPickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [displayYear, setDisplayYear] = React.useState(date?.getFullYear() || new Date().getFullYear());

  const handleMonthSelect = (month: number, year: number) => {
    console.log("MonthPicker - Selezione mese:", month, year);
    const monthDate = new Date(year, month, 1);
    console.log("MonthPicker - Data creata:", monthDate);
    onDateChange(monthDate);
    setIsOpen(false);
  };

  const months = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ];

  return (
    <div className={cn("relative w-full", className)}>
      {/* Trigger Button */}
      <Button
        type="button"
        variant="ghost"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-start text-left font-normal bg-transparent hover:bg-gray-50 border-0 shadow-none p-0 h-auto"
      >
        <Calendar className="mr-2 h-4 w-4 text-gray-400" />
        <span className="text-sm">
          {date ? format(date, "MMMM yyyy", { locale: it }) : placeholder}
        </span>
      </Button>

      {/* Dropdown Content */}
      {isOpen && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 md:left-0 md:translate-x-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-4 w-[280px] md:min-w-[300px] md:w-auto">
          {/* Controlli per navigazione anno */}
          <div className="flex items-center justify-between mb-6">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDisplayYear(displayYear - 1)}
              className="hover:bg-gray-100 rounded-lg"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-lg font-semibold text-gray-900">{displayYear}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDisplayYear(displayYear + 1)}
              className="hover:bg-gray-100 rounded-lg"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Griglia mesi */}
          <div className="grid grid-cols-3 gap-6 w-full">
            {months.map((month, index) => {
              const isCurrentMonth = date && 
                date.getFullYear() === displayYear && 
                date.getMonth() === index;
              const isPastMonth = new Date(displayYear, index + 1, 0) < new Date(new Date().setHours(0, 0, 0, 0));
              
              return (
                <Button
                  key={month}
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isPastMonth}
                  onClick={() => handleMonthSelect(index, displayYear)}
                  className={cn(
                    "h-10 py-2 px-3 text-sm transition-colors rounded-lg",
                    isCurrentMonth 
                      ? "bg-blue-500 text-white hover:bg-blue-600"
                      : "hover:bg-gray-100 text-gray-700",
                    isPastMonth && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {month}
                </Button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}