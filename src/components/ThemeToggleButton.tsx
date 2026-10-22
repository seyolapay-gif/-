import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleButtonProps {
  className?: string;
}

export const ThemeToggleButton: React.FC<ThemeToggleButtonProps> = ({ className = '' }) => {
  const { toggleTheme, isDark } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`p-2 sm:p-2.5 bg-slate-800/80 hover:bg-slate-700 text-amber-400 rounded-xl transition border border-slate-700/60 cursor-pointer flex items-center justify-center shrink-0 ${className}`}
      title={isDark ? 'الوضع المظلم مفعل: انقر للتبديل إلى الوضع الفاتح' : 'الوضع الفاتح مفعل: انقر للتبديل إلى الوضع المظلم'}
      aria-label="تبديل الوضع الليلي والنهاري"
    >
      {isDark ? (
        <Moon className="w-4 h-4 text-amber-400" />
      ) : (
        <Sun className="w-4 h-4 text-amber-500" />
      )}
    </button>
  );
};
