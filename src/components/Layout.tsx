import { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Receipt, LogOut, FileSpreadsheet, CheckCircle, 
  Settings, Moon, Sun, Menu, Landmark, Target, FileText, 
  Search, ChevronRight, AlertTriangle, Users, Check 
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import ForcePasswordChangeModal from './ForcePasswordChangeModal';
import logo from '../assets/jfcm-sl_logo.png';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { darkMode, toggleDarkMode } = useTheme();
  const { user } = useAuth();
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [signOutModalOpen, setSignOutModalOpen] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [userRole, setUserRole] = useState<string>('auditor'); 
  
  // Slow, Smooth Professional Financial Theme Transition State with Entrance Phase
  const [isSwitchingTheme, setIsSwitchingTheme] = useState(false);
  const [transitionStage, setTransitionStage] = useState<'idle' | 'entering' | 'active' | 'exiting'>('idle');
  const [themeStep, setThemeStep] = useState(0);

  // Command Palette State
  const [cmdOpen, setCmdOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) checkUserStatus();
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen(prev => !prev);
      }
      if (e.key === 'Escape') setCmdOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearInterval(timer);
    };
  }, [user]);

  // Handle smooth entrance animation trigger on mount
  useEffect(() => {
    if (transitionStage === 'entering') {
      const timer = setTimeout(() => {
        setTransitionStage('active');
      }, 40); // Ensures DOM registers opacity-0 before transitioning to opacity-100
      return () => clearTimeout(timer);
    }
  }, [transitionStage]);

  useEffect(() => {
    setSelectedIndex(0);
    if (cmdOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    } else {
      setSearchQuery('');
    }
  }, [searchQuery, cmdOpen]);

  const checkUserStatus = async () => {
    const { data } = await supabase.from('profiles').select('must_change_password, role').eq('id', user?.id).single();
    if (data) {
      if (data.must_change_password) setMustChangePassword(true);
      if (data.role) setUserRole(data.role);
    }
  };

  const handleConfirmSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleCommandNav = (path: string) => {
    navigate(path);
    setCmdOpen(false);
  };

  // Slow, Smooth, Deliberate Financial Theme Transition Handler
  const handleThemeTransition = () => {
    if (isSwitchingTheme) return;
    setIsSwitchingTheme(true);
    setTransitionStage('entering');
    setThemeStep(1); // Phase 1: Preparing interface presentation

    // Phase 2: Toggle theme securely while obscured (at 1100ms)
    setTimeout(() => {
      setThemeStep(2);
      toggleDarkMode();
    }, 1100);

    // Phase 3: Finalizing ledger display (at 2000ms)
    setTimeout(() => {
      setThemeStep(3);
    }, 2000);

    // Phase 4: Success message displayed (at 2800ms)
    setTimeout(() => {
      setThemeStep(4);
    }, 2800);

    // Phase 5: Start smooth fade out (at 3600ms)
    setTimeout(() => {
      setTransitionStage('exiting');
    }, 3600);

    // Phase 6: Unmount overlay completely (at 4300ms)
    setTimeout(() => {
      setIsSwitchingTheme(false);
      setTransitionStage('idle');
      setThemeStep(0);
    }, 4300);
  };

  const menuGroups = [
    {
      key: 'core', title: 'Operations', roles: ['admin', 'auditor', 'missionary'],
      items: [
        { name: 'Dashboard', href: '/', icon: LayoutDashboard },
        { name: 'Transactions', href: '/transactions', icon: Receipt },
        { name: 'Church Tithers', href: '/tithers', icon: Users },
        { name: 'Export Center', href: '/export-center', icon: FileSpreadsheet },
      ]
    },
    {
      key: 'audit', title: 'Audit & Ledger', roles: ['admin', 'auditor', 'missionary'],
      items: [
        { name: 'Mission Readiness', href: '/mission-readiness', icon: CheckCircle },
        { name: 'SJ Koop Ledger', href: '/coop-ledger', icon: Landmark },
      ]
    },
    {
      key: 'missionary', title: 'Missionary', roles: ['admin', 'missionary'],
      items: [
        { name: 'MPR Reporting', href: '/missionary-report', icon: FileText },
      ]
    },
    {
      key: 'admin', title: 'System', roles: ['admin'],
      items: [
        { name: 'Financial Setup', href: '/financial-setup', icon: Target },
        { name: 'System Admin', href: '/admin', icon: Settings },
      ]
    }
  ];

  const availableCommands = menuGroups
    .flatMap(g => g.roles.includes(userRole) ? g.items : [])
    .filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const handlePaletteKeyDown = (e: React.KeyboardEvent) => {
    if (availableCommands.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % availableCommands.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(
        prev => (prev - 1 + availableCommands.length) % availableCommands.length
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selectedCommand = availableCommands[selectedIndex];
      if (selectedCommand) {
        handleCommandNav(selectedCommand.href);
      }
    }
  };

  return (
    <div className="relative flex h-screen w-full bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text overflow-hidden font-sans selection:bg-brand-soft selection:text-brand-dark transition-colors duration-300">
      
      {/* Slow, Smooth Professional Financial Theme Transition Overlay with Gradual Opening & Closing */}
      {isSwitchingTheme && (
        <div className={`fixed inset-0 z-[99999] bg-slate-950/85 dark:bg-[#080B0F]/90 backdrop-blur-md flex flex-col items-center justify-center p-4 overflow-hidden transition-opacity duration-700 ease-in-out ${
          transitionStage === 'entering' || transitionStage === 'exiting' ? 'opacity-0' : 'opacity-100'
        }`}>
          <div className={`relative z-10 flex flex-col items-center max-w-sm w-full space-y-6 text-center transition-all duration-700 ease-out ${
            transitionStage === 'entering' || transitionStage === 'exiting' ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
          }`}>
            
            {/* Financial Ledger Icon or Success Checkmark */}
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl transition-all duration-700 ${
              themeStep === 4 
                ? 'bg-emerald-500/20 border border-emerald-500 text-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.5)] scale-105' 
                : 'bg-emerald-950/60 border border-emerald-500/30 text-emerald-400'
            }`}>
              {themeStep === 4 ? (
                <Check className="h-7 w-7 animate-in zoom-in duration-500" />
              ) : (
                <Landmark className="h-7 w-7 transition-transform duration-700 animate-pulse" />
              )}
            </div>

            <div className="space-y-2 w-full">
              <h3 className="text-sm font-bold text-white tracking-wide uppercase font-sans transition-opacity duration-500">
                {themeStep === 1 && "Preparing Interface Presentation..."}
                {themeStep === 2 && "Synchronizing Financial Ledger Theme..."}
                {themeStep === 3 && "Finalizing Display Preferences..."}
                {themeStep === 4 && "Theme Synchronized Successfully"}
              </h3>
              <p className="text-xs text-slate-400 font-mono transition-opacity duration-500">
                {themeStep === 4 ? "Ledger visual environment updated." : "Applying secure user configurations..."}
              </p>

              {/* Clean Financial Progress Bar */}
              <div className="w-full bg-slate-900 border border-slate-800 h-2 rounded-full overflow-hidden mt-5 p-0.5">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ease-out ${
                    themeStep === 4 
                      ? 'bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.8)]' 
                      : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                  }`}
                  style={{ 
                    width: themeStep === 1 ? '25%' : themeStep === 2 ? '60%' : themeStep === 3 ? '85%' : '100%' 
                  }}
                />
              </div>

              <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 uppercase tracking-widest pt-1 px-1">
                <span>SYSTEM_STEWARD</span>
                <span className={themeStep === 4 ? 'text-emerald-400 font-bold' : 'text-emerald-400 font-semibold'}>
                  {themeStep === 1 ? '25%' : themeStep === 2 ? '60%' : themeStep === 3 ? '85%' : '100%'}
                </span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 1. Ambient Environmental Layers */}
      <div className="bg-tech-grid absolute inset-0 z-0 pointer-events-none" />
      <div className="bg-noise absolute inset-0 z-0 pointer-events-none" />
      <div className="ambient-light -top-[10%] -left-[10%] bg-brand-bright/15 z-0 pointer-events-none" />

      {/* Forced Password Modal */}
      {mustChangePassword && user && (
        <div className="relative z-[9999]">
          <ForcePasswordChangeModal onSuccess={() => setMustChangePassword(false)} />
        </div>
      )}
      
      {/* 2. Interactive Command Palette (Cmd+K) */}
      {cmdOpen && (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[12vh] p-4 transition-all duration-300">
          <div 
            className="absolute inset-0 bg-light-bg/60 dark:bg-dark-bg/80 backdrop-blur-md animate-in fade-in duration-200"
            onClick={() => setCmdOpen(false)}
          />
          <div className="tech-glass w-full max-w-2xl relative z-10 animate-in fade-in zoom-in-95 duration-200 ease-out flex flex-col rounded-2xl overflow-hidden">
            <div className="flex items-center px-5 py-4 border-b border-light-border dark:border-dark-borderStrong">
              <Search className="h-5 w-5 text-brand-bright mr-3 shrink-0" />
              <input 
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handlePaletteKeyDown}
                placeholder="Quick navigation..." 
                className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-light-text dark:text-dark-text placeholder:text-light-textMuted dark:placeholder:text-dark-textMuted focus:ring-0"
              />
              <div className="flex items-center gap-1 text-[10px] text-light-textMuted dark:text-dark-textMuted font-mono bg-light-bg dark:bg-dark-bg px-2 py-1 rounded-md border border-light-border dark:border-dark-borderStrong shrink-0">ESC</div>
            </div>
            <div className="p-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {availableCommands.length > 0 ? (
                <div className="py-1">
                  {availableCommands.map((item, index) => {
                    const isSelected = index === selectedIndex;
                    return (
                      <button 
                        key={item.name} 
                        onClick={() => handleCommandNav(item.href)}
                        onMouseEnter={() => setSelectedIndex(index)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-colors relative overflow-hidden ${
                          isSelected ? 'bg-light-soft dark:bg-dark-soft' : 'hover:bg-light-soft dark:hover:bg-dark-soft'
                        }`}
                      >
                        <div className={`flex items-center text-sm font-medium transition-colors ${
                          isSelected ? 'text-light-text dark:text-dark-text' : 'text-light-textSecondary dark:text-dark-textSecondary'
                        }`}>
                          <item.icon className={`h-4 w-4 mr-3 transition-colors ${
                            isSelected ? 'text-brand-bright opacity-100' : 'opacity-70'
                          }`} /> 
                          {item.name}
                        </div>
                        <ChevronRight className={`h-4 w-4 transition-opacity ${
                          isSelected ? 'opacity-100 text-brand-bright' : 'opacity-0'
                        }`} />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="px-4 py-8 text-center text-sm text-light-textMuted dark:text-dark-textMuted">
                  No modules found matching "{searchQuery}"
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Drawer Overlay */}
      <div 
        className={`lg:hidden fixed inset-0 bg-light-bg/60 dark:bg-dark-bg/80 backdrop-blur-sm z-30 transition-opacity duration-300 ${mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={() => setMobileMenuOpen(false)} 
        aria-hidden="true" 
      />

      {/* 3. Application Layout Structure */}
      <div className="relative z-10 flex w-full h-full">
        
        {/* Command Rail Sidebar */}
        <div className={`fixed inset-y-0 left-0 w-[280px] bg-light-surface/95 dark:bg-dark-surface/95 backdrop-blur-2xl border-r border-light-border dark:border-dark-border flex flex-col shadow-tech transition-transform duration-300 ease-out z-40 lg:z-0 lg:translate-x-0 lg:static lg:bg-light-surface lg:dark:bg-dark-surface lg:backdrop-blur-none lg:shadow-none ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          
          {/* Sidebar Header */}
          <div className="h-16 flex items-center gap-3 px-6 border-b border-light-border dark:border-dark-border shrink-0 bg-transparent">
            <img src={logo} alt="JFCM-SL Logo" className="h-7 w-7 object-contain drop-shadow-sm" />
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight text-light-text dark:text-dark-text leading-tight">JFCM-SL</span>
              <span className="text-[9px] font-bold tracking-widest text-light-textSecondary dark:text-dark-textSecondary uppercase">Stewards</span>
            </div>
          </div>
          
          {/* System Status Indicator */}
          <div className="px-6 py-4 border-b border-light-border dark:border-dark-border bg-light-floating/50 dark:bg-dark-floating/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-success opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-status-success"></span>
                </div>
                <span className="text-xs font-semibold text-light-text dark:text-dark-text tracking-wide">Online</span>
              </div>
              <div className="text-[10px] font-mono font-medium text-light-textSecondary dark:text-dark-textSecondary tabular-nums">
                {currentTime.toLocaleTimeString([], { hour12: false })}
              </div>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="flex-1 px-2 py-6 space-y-6 overflow-y-auto custom-scrollbar">
            {menuGroups.map((group) => {
              if (!group.roles.includes(userRole)) return null;
              return (
                <div key={group.key} className="space-y-1">
                  <h2 className="px-4 text-[10px] font-bold uppercase tracking-widest text-light-textMuted dark:text-dark-textMuted mb-2">{group.title}</h2>
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const isActive = location.pathname === item.href;
                      const Icon = item.icon;
                      return (
                        <Link 
                          key={item.name} 
                          to={item.href} 
                          onClick={() => setMobileMenuOpen(false)} 
                          className={`flex items-center px-4 py-2.5 mx-2 text-sm font-medium transition-all relative group rounded-xl overflow-hidden ${
                            isActive 
                              ? 'text-brand-dark dark:text-brand-soft bg-gradient-to-r from-brand-soft/50 dark:from-brand-glow/10 to-transparent' 
                              : 'text-light-textSecondary dark:text-dark-textSecondary hover:text-light-text dark:hover:text-dark-text hover:bg-light-soft dark:hover:bg-dark-soft/50'
                          }`}
                        >
                          {isActive && (
                            <span className="absolute left-0 top-0 bottom-0 w-1 bg-brand-bright shadow-emerald-glow" />
                          )}
                          <Icon className={`mr-3 h-4 w-4 transition-colors ${isActive ? 'text-brand-DEFAULT dark:text-brand-bright' : 'opacity-70 group-hover:opacity-100'}`} />
                          {item.name}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>

          {/* Sidebar Footer Controls */}
          <div className="p-4 border-t border-light-border dark:border-dark-border space-y-1.5 shrink-0 bg-light-surface dark:bg-dark-surface/50">
            <button onClick={handleThemeTransition} className="flex items-center justify-between w-full px-4 py-2.5 text-xs font-medium text-light-textSecondary dark:text-dark-textSecondary hover:bg-light-soft dark:hover:bg-dark-soft hover:text-light-text dark:hover:text-dark-text transition-colors rounded-xl group">
              <div className="flex items-center gap-3">
                {darkMode ? <Sun className="h-4 w-4 text-brand-bright" /> : <Moon className="h-4 w-4 group-hover:text-light-text" />}
                <span>{darkMode ? 'Light Theme' : 'Dark Theme'}</span>
              </div>
            </button>
            <button onClick={() => setSignOutModalOpen(true)} className="flex items-center w-full px-4 py-2.5 text-xs font-medium text-status-danger dark:text-status-danger-soft hover:bg-status-danger-soft dark:hover:bg-status-danger-dark/20 transition-colors rounded-xl">
              <LogOut className="mr-3 h-4 w-4" /> Sign Out
            </button>
          </div>
        </div>

        {/* Main Workspace Area */}
        <div className="flex-1 flex flex-col relative overflow-hidden bg-transparent">
          
          {/* Contextual Header */}
          <header className="h-16 bg-light-surface/70 dark:bg-dark-surface/70 backdrop-blur-xl border-b border-light-border dark:border-dark-border flex items-center justify-between px-4 sm:px-8 z-30 shrink-0 shadow-sm">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden p-2 text-light-textSecondary hover:bg-light-soft dark:hover:bg-dark-soft rounded-lg transition-colors">
                <Menu className="h-5 w-5" />
              </button>
              <div className="hidden sm:flex items-center text-sm font-medium text-light-textSecondary dark:text-dark-textSecondary gap-2.5">
                <span>Workspace</span>
                <ChevronRight className="h-3.5 w-3.5 text-light-textMuted dark:text-dark-textMuted" />
                <span className="text-light-text dark:text-dark-text font-semibold capitalize">
                  {location.pathname === '/' ? 'Dashboard' : location.pathname.replace('/','').replace('-',' ')}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <button onClick={() => setCmdOpen(true)} className="hidden sm:flex items-center justify-between w-64 px-3 py-1.5 bg-light-floating dark:bg-dark-floating border border-light-border dark:border-dark-border hover:border-brand-bright/40 dark:hover:border-brand-glow/40 text-light-textSecondary dark:text-dark-textSecondary text-xs transition-all rounded-lg group shadow-sm">
                <span className="flex items-center gap-2">
                  <Search className="h-3.5 w-3.5 opacity-70 group-hover:text-brand-bright group-hover:opacity-100 transition-colors" /> 
                  Quick navigation...
                </span>
                <kbd className="font-mono text-[10px] font-bold bg-light-surface dark:bg-dark-surface px-1.5 py-0.5 rounded border border-light-borderStrong dark:border-dark-borderStrong text-light-textMuted dark:text-dark-textMuted">⌘K</kbd>
              </button>
            </div>
          </header>

          {/* Dynamic Page Content */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar">
            <div className="max-w-workspace mx-auto pb-16">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      {/* 4. Secure Sign Out Modal */}
      {signOutModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-all duration-300">
          <div 
            className="absolute inset-0 bg-light-bg/60 dark:bg-dark-bg/80 backdrop-blur-md animate-in fade-in duration-200" 
            onClick={() => setSignOutModalOpen(false)} 
          />
          <div className="tech-glass w-full max-w-md p-6 relative z-10 animate-in fade-in zoom-in-95 duration-200 ease-out rounded-2xl border border-light-border dark:border-dark-borderStrong shadow-tech-lg space-y-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-status-danger-soft dark:bg-status-danger-dark/20 text-status-danger dark:text-status-danger-soft rounded-xl border border-status-danger/10 dark:border-status-danger/20 shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-light-text dark:text-dark-text tracking-tight">Sign Out</h3>
                <p className="text-sm text-light-textSecondary dark:text-dark-textSecondary mt-0.5">Are you sure you want to end your current session?</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button 
                onClick={() => setSignOutModalOpen(false)} 
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-light-textSecondary dark:text-dark-textSecondary hover:bg-light-soft dark:hover:bg-dark-soft transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmSignOut} 
                className="px-6 py-2.5 bg-status-danger hover:bg-status-danger-dark text-white rounded-xl text-sm font-semibold shadow-md transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}