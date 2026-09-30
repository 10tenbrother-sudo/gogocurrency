import React, { createContext, useContext, useState, useEffect } from 'react';

export type AppTheme = 'dark' | 'light';

export interface ThemeContextType {
  theme: AppTheme;
  isDark: boolean;
  isLight: boolean;
  toggleTheme: () => void;
  setTheme: (t: AppTheme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  isDark: true,
  isLight: false,
  toggleTheme: () => {},
  setTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    try {
      const saved = localStorage.getItem('flowmonitor_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (e) {}
    return 'dark';
  });

  const setTheme = (newTheme: AppTheme) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  useEffect(() => {
    try {
      localStorage.setItem('flowmonitor_theme', theme);
      const root = document.documentElement;
      if (theme === 'dark') {
        root.classList.add('dark');
        root.classList.remove('light');
        root.setAttribute('data-theme', 'dark');
        document.body.classList.add('dark');
        document.body.classList.remove('light');
      } else {
        root.classList.remove('dark');
        root.classList.add('light');
        root.setAttribute('data-theme', 'light');
        document.body.classList.remove('dark');
        document.body.classList.add('light');
      }
    } catch (e) {}
  }, [theme]);

  const isDark = theme === 'dark';
  const isLight = theme === 'light';

  return (
    <ThemeContext.Provider value={{ theme, isDark, isLight, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

/**
 * Semantic style tokens for components to ensure 100% theme harmony across the entire application.
 * Prevents any accidental dark-cards-on-light-background or white-cards-on-dark-background bugs.
 */
export const getThemeStyles = (isDark: boolean) => ({
  // Page background & text
  pageBg: isDark ? 'bg-[#08090D] text-zinc-100' : 'bg-[#F8F9FA] text-zinc-900',
  pageBgHex: isDark ? '#08090D' : '#F8F9FA',
  
  // Header
  headerBg: isDark ? 'bg-[#0A0C12]/95 border-white/[0.08]' : 'bg-white/95 border-zinc-200 shadow-xs',
  
  // Cards & Containers
  cardBg: isDark ? 'bg-[#0E111A] border-white/[0.08] text-white shadow-none' : 'bg-white border-zinc-200 text-zinc-900 shadow-xs',
  cardHover: isDark ? 'hover:bg-[#131722] hover:border-white/20' : 'hover:bg-zinc-50 hover:border-zinc-300',
  subCardBg: isDark ? 'bg-[#141824] border-white/[0.06] text-zinc-200' : 'bg-zinc-50 border-zinc-200 text-zinc-800',
  
  // Typography
  textTitle: isDark ? 'text-white' : 'text-zinc-950',
  textSecondary: isDark ? 'text-zinc-400' : 'text-zinc-600',
  textMuted: isDark ? 'text-zinc-500' : 'text-zinc-400',
  
  // Borders
  border: isDark ? 'border-white/[0.08]' : 'border-zinc-200',
  borderDivider: isDark ? 'border-white/[0.06]' : 'border-zinc-200',
  
  // Interactive Elements (Pills, Tabs, Inputs)
  pillContainer: isDark ? 'bg-zinc-900 border-white/[0.08]' : 'bg-zinc-100 border-zinc-200 shadow-2xs',
  pillActive: isDark ? 'bg-zinc-800 text-white font-semibold shadow-xs' : 'bg-white text-zinc-950 font-semibold shadow-xs border border-zinc-200',
  pillInactive: isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-zinc-600 hover:text-zinc-950',
  inputBg: isDark ? 'bg-zinc-900 border-white/[0.08] text-zinc-200 placeholder-zinc-500' : 'bg-white border-zinc-300 text-zinc-900 placeholder-zinc-400 shadow-2xs',
  dropdownBg: isDark ? 'bg-[#0E1119] border-white/[0.1] text-zinc-200' : 'bg-white border-zinc-200 text-zinc-800 shadow-xl',
});
