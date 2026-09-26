import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Receipt, LogOut, FileSpreadsheet, CheckCircle, Settings, Moon, Sun, Menu, X, AlertTriangle, Landmark, Target, FileText, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import ForcePasswordChangeModal from './ForcePasswordChangeModal';
import { Users } from 'lucide-react';

// FIX: Explicitly importing the JFCM-SL Logo
import logo from '../assets/jfcm-sl_logo.png';

export default function Layout() {
  const location = useLocation();
  const { darkMode, toggleDarkMode } = useTheme();
  const { user } = useAuth();
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [signOutModalOpen, setSignOutModalOpen] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [userRole, setUserRole] = useState<string>('auditor'); 

  // Accordion Menu State
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    core: true,
    audit: true,
    missionary: true,
    admin: false
  });

  const toggleMenu = (key: string) => setOpenMenus(p => ({ ...p, [key]: !p[key] }));

  useEffect(() => {
    if (user) checkUserStatus();
  }, [user]);

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

  // Define Grouped Navigation
  const menuGroups = [
    {
      key: 'core',
      title: 'Core Operations',
      roles: ['admin', 'auditor', 'missionary'],
      items: [
        { name: 'Dashboard', href: '/', icon: LayoutDashboard },
        { name: 'Transactions', href: '/transactions', icon: Receipt },
        { name: 'Tithers Monitor', href: '/tithers', icon: Users },
        { name: 'Export Center', href: '/export-center', icon: FileSpreadsheet },
      ]
    },
    {
      key: 'audit',
      title: 'Audit & Ledger',
      roles: ['admin', 'auditor', 'missionary'],
      items: [
        { name: 'Mission Readiness', href: '/mission-readiness', icon: CheckCircle },
        { name: 'SJ Koop Ledger', href: '/coop-ledger', icon: Landmark },
      ]
    },
    {
      key: 'missionary',
      title: 'Missionary Duty',
      roles: ['admin', 'missionary'],
      items: [
        { name: 'MPR Reporting', href: '/missionary-report', icon: FileText },
      ]
    },
    {
      key: 'admin',
      title: 'Administration',
      roles: ['admin'],
      items: [
        { name: 'Financial Setup', href: '/financial-setup', icon: Target },
        { name: 'System Admin', href: '/admin', icon: Settings },
      ]
    }
  ];

  return (
    <div className="flex h-screen bg-brand-bg dark:bg-brand-darkBg text-slate-800 dark:text-slate-100 transition-colors duration-200 overflow-hidden">
      {mustChangePassword && user && <ForcePasswordChangeModal onSuccess={() => setMustChangePassword(false)} />}

      {/* Backdrop for mobile menu */}
      <div className={`lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-30 transition-opacity duration-300 ${mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setMobileMenuOpen(false)} aria-hidden="true" />

      {/* Top Navbar for Mobile/Tablet (Visible up to lg 1024px so landscape phones stay clean) */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white/90 dark:bg-brand-darkSurface/90 backdrop-blur-md border-b border-brand-border dark:border-brand-darkBorder z-20 flex items-center justify-between px-4 shadow-sm">
        <div className="flex items-center gap-3">
          {/* FIX: Restored the physical image logo */}
          <img src={logo} alt="Logo" className="h-8 w-8 object-contain drop-shadow-sm" />
          <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">JFCM-SL Stewards</span>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="flex items-center gap-2 p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:block">Menu</span>
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Sidebar (Hidden on mobile/landscape phone, visible on Desktop LG+) */}
      <div className={`fixed inset-y-0 left-0 w-64 bg-white dark:bg-brand-darkSurface border-r border-brand-border dark:border-brand-darkBorder flex flex-col shadow-2xl transition-transform duration-300 ease-in-out z-40 lg:z-0 lg:translate-x-0 lg:static lg:shadow-none ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-20 hidden lg:flex items-center px-6 border-b border-brand-border dark:border-brand-darkBorder gap-3 shrink-0">
          {/* FIX: Restored the physical image logo */}
          <img src={logo} alt="Logo" className="h-10 w-10 object-contain drop-shadow-sm" />
          <div>
            <h1 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white leading-tight">JFCM-SL Stewards</h1>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Financial Operations</p>
          </div>
        </div>
        
        <nav className="flex-1 px-4 py-4 space-y-4 mt-16 lg:mt-0 overflow-y-auto custom-scrollbar">
          {menuGroups.map((group) => {
            if (!group.roles.includes(userRole)) return null;
            const isOpen = openMenus[group.key];
            return (
              <div key={group.key} className="space-y-1">
                <button onClick={() => toggleMenu(group.key)} className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                  {group.title}
                  {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
                {isOpen && (
                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const isActive = location.pathname === item.href;
                      const Icon = item.icon;
                      return (
                        <Link key={item.name} to={item.href} onClick={() => setMobileMenuOpen(false)} className={`flex items-center px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${isActive ? 'bg-brand dark:bg-emerald-800 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'}`}>
                          <Icon className={`mr-3 h-4 w-4 ${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`} />
                          {item.name}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-brand-border dark:border-brand-darkBorder space-y-2 shrink-0">
          <button onClick={toggleDarkMode} className="flex items-center justify-between w-full px-3.5 py-2.5 text-xs font-medium text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors">
            <span className="flex items-center">
              {darkMode ? <Sun className="mr-3 h-4 w-4 text-amber-400" /> : <Moon className="mr-3 h-4 w-4 text-slate-400" />}
              {darkMode ? 'Light Mode' : 'Dark Mode'}
            </span>
            <div className={`w-8 h-4 rounded-full transition-colors relative p-0.5 ${darkMode ? 'bg-emerald-600' : 'bg-slate-300'}`}>
              <div className={`w-3 h-3 rounded-full bg-white transition-transform ${darkMode ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
          </button>
          <button onClick={() => setSignOutModalOpen(true)} className="flex items-center w-full px-3.5 py-2.5 text-xs font-medium text-red-600 dark:text-red-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
            <LogOut className="mr-3 h-4 w-4 text-red-500" /> Sign Out
          </button>
        </div>
      </div>

      {/* Main Content with optimized responsive padding */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-10 mt-16 lg:mt-0 custom-scrollbar">
        <div className="max-w-workspace mx-auto pb-12">
          <Outlet />
        </div>
      </main>

      {signOutModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-[#121212] rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-[#27272A] space-y-5 animate-modal">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 rounded-2xl"><AlertTriangle className="h-6 w-6" /></div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Confirm Sign Out</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Are you sure you want to end your secure session?</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setSignOutModalOpen(false)} className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Cancel</button>
              <button onClick={handleConfirmSignOut} className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md transition-all">Sign Out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}