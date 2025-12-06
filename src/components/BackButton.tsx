import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

interface BackButtonProps {
  fallbackPath?: string;
  label?: string;
  variant?: "default" | "outline" | "ghost" | "link";
  className?: string;
}

export const BackButton = ({ 
  fallbackPath = "/", 
  label, 
  variant = "outline",
  className = ""
}: BackButtonProps) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const buttonLabel = label || t('common.back', 'Indietro');

  const handleBack = () => {
    navigate(fallbackPath);
  };

  return (
    <Button 
      variant={variant} 
      onClick={handleBack}
      className={className}
    >
      <ArrowLeft className="mr-2 h-4 w-4" />
      {buttonLabel}
    </Button>
  );
};