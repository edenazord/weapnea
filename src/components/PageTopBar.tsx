import { BackButton } from "@/components/BackButton";

type Props = {
  fallbackPath?: string;
  label?: string;
  className?: string;
};

export const PageTopBar = ({ fallbackPath = "/", label = "Torna alla Home", className = "" }: Props) => {
  return (
    <div className={`w-full ${className}`}>
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        <div className="h-12 flex items-center">
          <BackButton fallbackPath={fallbackPath} label={label} variant="outline" />
        </div>
      </div>
    </div>
  );
};

export default PageTopBar;