
import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Globe } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const LanguageSwitcher: React.FC = () => {
  const { currentLanguage, setCurrentLanguage, languages } = useLanguage();

  const currentLang = languages.find(lang => lang.code === currentLanguage);

  const handleLanguageChange = (languageCode: string) => {
    console.log('Language switcher: changing from', currentLanguage, 'to', languageCode);
    setCurrentLanguage(languageCode);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center space-x-2">
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline">
            {currentLang?.native_name || currentLanguage.toUpperCase()}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((language) => (
          <DropdownMenuItem
            key={language.id}
            onClick={() => handleLanguageChange(language.code)}
            className={currentLanguage === language.code ? 'bg-blue-50' : ''}
          >
            <div className="flex items-center justify-between w-full">
              <span>{language.native_name}</span>
              <span className="text-sm text-gray-500 ml-2">{language.name}</span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSwitcher;
