import { BackButton } from "@/components/BackButton";
import { useLanguage } from "@/contexts/LanguageContext";

type Props = {
  fallbackPath?: string;
  label?: string;
  className?: string;
};

export const PageTopBar = ({ fallbackPath = "/", label, className = "" }: Props) => {
  const { t } = useLanguage();
  const buttonLabel = label || t('not_found.back_home', 'Torna alla Home');
  
  return (
    <div className={`w-full ${className}`}>
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        <div className="h-12 flex items-center">
          <BackButton fallbackPath={fallbackPath} label={buttonLabel} variant="outline" />
        </div>
      </div>
    </div>
  );
};

export default PageTopBar;