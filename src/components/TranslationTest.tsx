
import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const TranslationTest: React.FC = () => {
  const { t, currentLanguage, translations, isLoading } = useLanguage();

  return (
    <Card className="mb-4 border-2 border-yellow-300 bg-yellow-50">
      <CardHeader>
        <CardTitle>🧪 Translation Test (Current: {currentLanguage})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p><strong>Hello:</strong> {t('test.hello', 'Hello (fallback)')}</p>
          <p><strong>Welcome:</strong> {t('test.welcome', 'Welcome (fallback)')}</p>
          <p><strong>Goodbye:</strong> {t('test.goodbye', 'Goodbye (fallback)')}</p>
          <p><strong>Loading:</strong> {isLoading ? 'Yes' : 'No'}</p>
          <p><strong>Total translations:</strong> {Object.keys(translations).length}</p>
          <details className="mt-2">
            <summary className="cursor-pointer font-semibold">All available translations</summary>
            <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
              {JSON.stringify(translations, null, 2)}
            </pre>
          </details>
        </div>
      </CardContent>
    </Card>
  );
};

export default TranslationTest;
