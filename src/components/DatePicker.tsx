
import * as React from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerProps {
  date?: Date;
  onDateChange: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
}

export function DatePicker({ 
  date, 
  onDateChange, 
  placeholder = "Seleziona mese",
  className 
}: DatePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [displayYear, setDisplayYear] = React.useState(new Date().getFullYear());

  const handleMonthSelect = (month: number, year: number) => {
    console.log("Selezione mese:", month, year);
    const monthDate = new Date(year, month, 1);
    console.log("Data creata:", monthDate);
    onDateChange(monthDate);
    // Chiudi il popover del DatePicker ma NON quello del SearchWithDropdown
    setIsOpen(false);
  };

  const handleOpenChange = (open: boolean) => {
    console.log("DatePicker popover open change:", open);
    setIsOpen(open);
  };

  const months = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ];

  return (
    <div className={cn("relative", className)}>
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            title="Seleziona mese"
            aria-label="Seleziona mese"
            className={cn(
              "inline-flex items-center gap-2 px-3 py-2 rounded-md border border-purple-200 hover:border-purple-400 bg-white dark:bg-neutral-900 text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="h-4 w-4 text-purple-600" />
            <span className="text-sm truncate">
              {date ? format(date, "MMMM yyyy", { locale: it }) : placeholder}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-auto p-0 bg-white/95 backdrop-blur-md border-purple-200 shadow-xl rounded-xl z-[70]" 
          align="start"
          onInteractOutside={(e) => {
            // Previeni la propagazione dell'evento al SearchWithDropdown
            e.stopPropagation();
          }}
        >
          <div className="p-4 pointer-events-auto rounded-xl">
            {/* Controlli per navigazione anno */}
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setDisplayYear(displayYear - 1);
                }}
                className="hover:bg-purple-100 rounded-lg"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-lg font-semibold text-purple-900">{displayYear}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setDisplayYear(displayYear + 1);
                }}
                className="hover:bg-purple-100 rounded-lg"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Griglia mesi */}
            <div className="grid grid-cols-3 gap-2 w-80">
              {months.map((month, index) => {
                const isCurrentMonth = date && 
                  date.getFullYear() === displayYear && 
                  date.getMonth() === index;
                const isPastMonth = new Date(displayYear, index + 1, 0) < new Date(new Date().setHours(0, 0, 0, 0));
                
                return (
                  <Button
                    key={month}
                    variant="ghost"
                    size="sm"
                    disabled={isPastMonth}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleMonthSelect(index, displayYear);
                    }}
                    className={cn(
                      "h-12 text-sm transition-colors rounded-lg",
                      isCurrentMonth 
                        ? "bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600"
                        : "hover:bg-purple-50 text-purple-700",
                      isPastMonth && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {month}
                  </Button>
                );
              })}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
