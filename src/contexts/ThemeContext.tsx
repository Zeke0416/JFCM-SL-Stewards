import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LedgerMotion } from '../components/ui/Motion';
type ThemeContextType = { darkMode: boolean; transitioning: boolean; toggleDarkMode: () => void };
const ThemeContext = createContext<ThemeContextType>({ darkMode: false, transitioning: false, toggleDarkMode: () => {} });
export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [darkMode, setDarkMode] = useState(() => { const saved = localStorage.getItem('jfcm_theme'); return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches; });
  const [transitioning, setTransitioning] = useState(false);
  const [themeApplied, setThemeApplied] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const locked = useRef(false);
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => { document.documentElement.classList.toggle('dark', darkMode); localStorage.setItem('jfcm_theme', darkMode ? 'dark' : 'light'); }, [darkMode]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    if (!transitioning) return;
    const root = document.getElementById('root');
    if (!root) return;
    const wasInert = root.inert; root.inert = true;
    return () => { root.inert = wasInert; previousFocus.current?.focus(); };
  }, [transitioning]);
  const toggleDarkMode = () => {
    if (locked.current) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    locked.current = true; setThemeApplied(false); setTransitioning(true);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    timers.current = [setTimeout(() => { setDarkMode(value => !value); setThemeApplied(true); }, reduced ? 120 : 850), setTimeout(() => { setTransitioning(false); locked.current = false; timers.current = []; }, reduced ? 450 : 1900)];
  };
  const targetDark = themeApplied ? darkMode : !darkMode;
  return <ThemeContext.Provider value={{ darkMode, transitioning, toggleDarkMode }}>{children}{transitioning && createPortal(
    <div className={`theme-transition ${targetDark ? 'to-dark' : 'to-light'} ${themeApplied ? 'theme-applied' : ''}`} role="status" aria-live="polite" aria-label={`Switching to ${targetDark ? 'dark' : 'light'} mode`}>
      <div className="theme-iris" /><div className="theme-transition-content"><span className="theme-brand">JFCM-SL / Stewards</span><LedgerMotion variant="transition" /><h2>{themeApplied ? `${targetDark ? 'Dark' : 'Light'} mode ready` : `Switching to ${targetDark ? 'dark' : 'light'} mode`}</h2><p>{themeApplied ? 'Returning to your workspace' : 'Adjusting your workspace appearance'}</p><div className="theme-progress"><span /></div><span className="theme-mode-label">{targetDark ? 'Graphite' : 'Silver'} workspace</span></div>
    </div>, document.body)}</ThemeContext.Provider>;
};
export const useTheme = () => useContext(ThemeContext);
