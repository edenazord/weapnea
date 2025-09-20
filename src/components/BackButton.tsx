import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface BackButtonProps {
  fallbackPath?: string;
  label?: string;
  variant?: "default" | "outline" | "ghost" | "link";
  className?: string;
}

export const BackButton = ({ 
  fallbackPath = "/", 
  label = "Indietro", 
  variant = "outline",
  className = ""
}: BackButtonProps) => {
  const navigate = useNavigate();

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
      {label}
    </Button>
  );
};