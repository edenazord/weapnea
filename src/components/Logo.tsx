import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Waves, Sparkles } from 'lucide-react';

export default function Logo({ className = '', imgClassName = 'h-8', showText = false }: { className?: string; imgClassName?: string; showText?: boolean }) {
  const [imgError, setImgError] = useState(false);
  return (
    <Link to="/" className={`flex items-center space-x-3 group ${className}`} aria-label="WeApnea - Home">
      {!imgError ? (
        <img
          src="/images/weapnea-logo.png"
          alt="WeApnea"
          className={`${imgClassName} w-auto select-none`}
          onError={() => setImgError(true)}
          loading="eager"
          decoding="sync"
        />
      ) : (
        <div className="relative">
          <Waves className="h-8 w-8 text-blue-600 group-hover:text-purple-600 transition-colors duration-300" />
          <div className="absolute -top-1 -right-1">
            <Sparkles className="h-4 w-4 text-yellow-400 animate-pulse" />
          </div>
        </div>
      )}
      {showText && (
        <span className="text-2xl font-bold bg-gradient-to-r from-blue-900 via-purple-700 to-blue-900 bg-clip-text text-transparent">
          WeApnea
        </span>
      )}
    </Link>
  );
}
