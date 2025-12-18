
import { Link } from "react-router-dom";
import { Waves, Mail, MapPin, Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const Footer = () => {
  const { t, currentLanguage } = useLanguage();
  
  console.log('🦶 Footer rendering with language:', currentLanguage);
  
  return (
    <footer className="relative bg-gradient-to-br from-blue-900 via-purple-900 to-blue-900 text-white mt-auto overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-64 h-64 bg-white/5 rounded-full blur-3xl floating-animation"></div>
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-purple-400/10 rounded-full blur-3xl floating-animation" style={{ animationDelay: '-2s' }}></div>
      </div>
      
      <div className="relative container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          {/* Logo e descrizione */}
          <div className="col-span-1 md:col-span-2">
            <Link to="/" className="flex items-center space-x-3 mb-6 group">
              <div className="relative">
                <Waves className="h-10 w-10 text-blue-300 group-hover:text-white transition-colors duration-300" />
                <div className="absolute -top-1 -right-1">
                  <Sparkles className="h-4 w-4 text-yellow-400 animate-pulse" />
                </div>
              </div>
              <span className="text-3xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
                WeApnea
              </span>
            </Link>
            <p className="text-blue-100 mb-6 max-w-md leading-relaxed text-lg">
              {t('footer.description', 'La prima piattaforma internazionale dedicata all\'apnea. Partecipa a eventi, viaggi e attività formative collegandoti con una community di appassionati non proprio superficiale!')}
            </p>
          </div>

          {/* Link rapidi */}
          <div className="space-y-4">
            <h3 className="font-bold text-xl mb-6 bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
              {t('footer.quick_links', 'Link Rapidi')}
            </h3>
            <ul className="space-y-4">
              <li>
                <Link
                  to="/chi-siamo"
                  className="text-blue-200 hover:text-white transition-all duration-300 group flex items-center"
                >
                  <span className="relative">
                    {t('nav.about', 'Chi Siamo')}
                    <div className="absolute inset-x-0 -bottom-1 h-0.5 bg-gradient-to-r from-blue-400 to-purple-400 scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
                  </span>
                </Link>
              </li>
              <li>
                <Link
                  to="/eventi-imminenti"
                  className="text-blue-200 hover:text-white transition-all duration-300 group flex items-center"
                >
                  <span className="relative">
                    {t('nav.events', 'Eventi')}
                    <div className="absolute inset-x-0 -bottom-1 h-0.5 bg-gradient-to-r from-blue-400 to-purple-400 scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
                  </span>
                </Link>
              </li>
              <li>
                <Link
                  to="/blog"
                  className="text-blue-200 hover:text-white transition-all duration-300 group flex items-center"
                >
                  <span className="relative">
                    {t('nav.blog', 'Blog')}
                    <div className="absolute inset-x-0 -bottom-1 h-0.5 bg-gradient-to-r from-blue-400 to-purple-400 scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
                  </span>
                </Link>
              </li>
              <li>
                <Link
                  to="/contattaci"
                  className="text-blue-200 hover:text-white transition-all duration-300 group flex items-center"
                >
                  <span className="relative">
                    {t('nav.contact', 'Contattaci')}
                    <div className="absolute inset-x-0 -bottom-1 h-0.5 bg-gradient-to-r from-blue-400 to-purple-400 scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
                  </span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Policy */}
          <div className="space-y-4">
            <h3 className="font-bold text-xl mb-6 bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
              {t('footer.policy', 'Policy')}
            </h3>
            <ul className="space-y-4">
              <li>
                <Link
                  to="/privacy-policy"
                  className="text-blue-200 hover:text-white transition-all duration-300 group flex items-center"
                >
                  <span className="relative">
                    {t('footer.privacy_policy', 'Privacy Policy')}
                    <div className="absolute inset-x-0 -bottom-1 h-0.5 bg-gradient-to-r from-blue-400 to-purple-400 scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
                  </span>
                </Link>
              </li>
              <li>
                <Link
                  to="/cookie-policy"
                  className="text-blue-200 hover:text-white transition-all duration-300 group flex items-center"
                >
                  <span className="relative">
                    {t('footer.cookie_policy', 'Cookie Policy')}
                    <div className="absolute inset-x-0 -bottom-1 h-0.5 bg-gradient-to-r from-blue-400 to-purple-400 scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
                  </span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Contatti */}
          <div className="space-y-4">
            <h3 className="font-bold text-xl mb-6 bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
              {t('footer.contact', 'Contatti')}
            </h3>
            <div className="space-y-4">
              <div className="flex items-center text-blue-200 hover:text-white transition-colors duration-300 group">
                <div className="p-2 rounded-full bg-white/10 mr-3 group-hover:bg-white/20 transition-colors duration-300">
                  <Mail className="h-4 w-4" />
                </div>
                <span className="text-sm">weapnea@gmail.com</span>
              </div>
              <div className="flex items-center text-blue-200 hover:text-white transition-colors duration-300 group">
                <div className="p-2 rounded-full bg-white/10 mr-3 group-hover:bg-white/20 transition-colors duration-300">
                  <MapPin className="h-4 w-4" />
                </div>
                <span className="text-sm">Italia</span>
              </div>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-white/20 mt-12 pt-8 text-center">
          <p className="text-blue-200 text-sm bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-transparent">
            © {new Date().getFullYear()} WeApnea. {t('footer.copyright', 'Tutti i diritti riservati.')}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
