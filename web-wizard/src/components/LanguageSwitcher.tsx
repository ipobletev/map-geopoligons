import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

const LanguageSwitcher = () => {
    const { i18n } = useTranslation();

    const toggleLanguage = () => {
        const newLang = i18n.language === 'en' ? 'es' : 'en';
        i18n.changeLanguage(newLang);
    };

    return (
        <button
            onClick={toggleLanguage}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/80 hover:bg-white text-slate-600 hover:text-slate-900 border border-slate-200 shadow-sm transition-all text-sm font-medium"
            title="Switch Language"
        >
            <Globe className="w-4 h-4" />
            {i18n.language === 'en' ? 'ES' : 'EN'}
        </button>
    );
};

export default LanguageSwitcher;
