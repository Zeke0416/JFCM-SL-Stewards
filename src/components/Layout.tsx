import UserAvatar from './ui/UserAvatar';
import { PROFILE_PHOTO_UPDATED } from '../utils/profilePhoto';
import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight, Command, LogOut, Menu, Moon, Search, Sun, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import ForcePasswordChangeModal from './ForcePasswordChangeModal';
import DialogLayer from './ui/DialogLayer';
import { MotionToggle } from './ui/Motion';
import { StewardGlyph } from './ui/StewardGlyph';
import type { GlyphName } from './ui/StewardGlyph';
import logo from '../assets/jfcm-sl_logo.png';
const groups: { title: string; roles: string[]; items: { title: string; path: string; glyph: GlyphName; detail: string }[] }[] = [
  { title: 'Workspace', roles: ['admin', 'auditor', 'missionary'], items: [
    { title:'Dashboard', path:'/', glyph:'overview', detail:'Financial position and priorities' },
    { title:'Transactions', path:'/transactions', glyph:'ledger', detail:'Receipts, disbursements and evidence' },
    { title:'Reconciliation', path:'/reconciliation', glyph:'reconcile', detail:'Compare ComBud and system records' },
    { title:'Church tithers', path:'/tithers', glyph:'people', detail:'Member directory and monthly follow-up' },
    { title:'Export center', path:'/export-center', glyph:'export', detail:'Prepare ComBud and MPR workbooks' },
  ] },
  { title:'Stewardship', roles:['admin','auditor','missionary'], items:[
    { title:'Mission readiness', path:'/mission-readiness', glyph:'mission', detail:'Cash, bank balances and supporting receipts' },
    { title:'SJ Koop ledger', path:'/coop-ledger', glyph:'coop', detail:'Cooperative deposits and withdrawals' },
  ] },
  { title:'Reporting', roles:['admin','missionary'], items:[{ title:'Missionary report', path:'/missionary-report', glyph:'report', detail:'Monthly ministry progress' }] },
  { title:'Administration', roles:['admin'], items:[
    { title:'Financial setup', path:'/financial-setup', glyph:'setup', detail:'Financial years and budget targets' },
    { title:'System administration', path:'/admin', glyph:'admin', detail:'Personnel, categories and configuration' },
  ] },
];
export default function Layout() {
  const { user } = useAuth();
  const { darkMode, transitioning, toggleDarkMode } = useTheme();
  const location = useLocation(); const navigate = useNavigate();
  const [role, setRole] = useState('auditor');
  const [account, setAccount] = useState<{full_name:string;avatar_data_url?:string|null} | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const sidebar = useRef<HTMLElement>(null);
  const visibleGroups = groups.filter(group => group.roles.includes(role));
  const items = visibleGroups.flatMap(group => group.items);
  const current = items.find(item => item.path === location.pathname);
  const results = items.filter(item => `${item.title} ${item.detail}`.toLowerCase().includes(query.toLowerCase()));
  useEffect(() => {
    let cancelled = false;
    if (user) void supabase.from('profiles').select('must_change_password,role,full_name,avatar_data_url').eq('id', user.id).single().then(({ data }) => {
      if (!cancelled && data) { setRole(data.role || 'auditor'); setAccount({full_name:data.full_name || 'Church personnel',avatar_data_url:data.avatar_data_url}); setMustChangePassword(!!data.must_change_password); }
    });
    return () => { cancelled = true; };
  }, [user]);
  useEffect(() => {
    const updatePhoto = (event: Event) => {
      const detail = (event as CustomEvent<{profileId:string;photo:string|null}>).detail;
      if (detail?.profileId === user?.id) setAccount(current => current ? {...current,avatar_data_url:detail.photo} : current);
    };
    window.addEventListener(PROFILE_PHOTO_UPDATED, updatePhoto);
    return () => window.removeEventListener(PROFILE_PHOTO_UPDATED, updatePhoto);
  }, [user?.id]);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (document.querySelector('.theme-transition')) return;
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') { if (document.querySelector('[data-dialog-layer][data-active=true]') && !document.querySelector('[data-dialog-layer][aria-label="Find a page"]')) return; event.preventDefault(); setQuery(''); setSelectedIndex(0); setCommandOpen(value => !value); }
      if (event.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', keyboard); return () => window.removeEventListener('keydown', keyboard);
  }, []);
  useEffect(() => {
    if (!mobileOpen || !sidebar.current) return;
    const region = sidebar.current; const previous = document.activeElement as HTMLElement | null;
    const controls = () => Array.from(region.querySelectorAll<HTMLElement>('a, button')).filter(element => element.getClientRects().length);
    controls()[0]?.focus();
    const keyboard = (event: KeyboardEvent) => { if (event.key !== 'Tab') return; const list = controls(); const first = list[0]; const last = list[list.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } };
    region.addEventListener('keydown', keyboard); return () => { region.removeEventListener('keydown', keyboard); previous?.focus(); };
  }, [mobileOpen]);
  const jump = (path: string) => { navigate(path); setCommandOpen(false); setMobileOpen(false); };
  const signOut = async () => { setSigningOut(true); setSignOutError(''); const { error } = await supabase.auth.signOut(); if (error) { setSignOutError(error.message); setSigningOut(false); } };
  return <div className={`stewards-app ${collapsed ? 'nav-collapsed' : ''}`}>
    <a href="#main-content" className="skip-link" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus(); }}>Skip to content</a>
    {mobileOpen && <div className="navigation-scrim" onClick={() => setMobileOpen(false)} />}
    <aside ref={sidebar} className={`stewards-sidebar ${mobileOpen ? 'mobile-open' : ''}`} role={mobileOpen ? 'dialog' : undefined} aria-modal={mobileOpen || undefined} aria-label="Main navigation">
      <div className="sidebar-brand"><img src={logo} alt="JFCM-SL" /><div><strong>Stewards<span>.</span></strong><span>JFCM-SL</span></div><button type="button" className="mobile-close icon-button" aria-label="Close navigation" onClick={() => setMobileOpen(false)}><X size={18} /></button></div>
      <div className="sidebar-purpose">Church finance & auditing</div>
      <nav>{visibleGroups.map(group => <section className="navigation-group" key={group.title}><h2><StewardGlyph name={group.title === 'Workspace' ? 'overview' : group.title === 'Stewardship' ? 'mission' : group.title === 'Reporting' ? 'report' : 'admin'} size={15} /><span>{group.title}</span><i /></h2>{group.items.map(item => <Link key={item.path} to={item.path} title={collapsed ? item.title : undefined} aria-label={item.title} aria-current={location.pathname === item.path ? 'page' : undefined} onClick={() => setMobileOpen(false)}><span className="nav-glyph"><StewardGlyph name={item.glyph} /></span><span className="nav-text">{item.title}</span><ChevronRight size={14} className="nav-chevron" /></Link>)}</section>)}</nav>
      <div className="sidebar-footer"><div className="sidebar-current-user"><UserAvatar photoUrl={account?.avatar_data_url} size={32}/><div><strong>{account?.full_name || 'Church personnel'}</strong><span>{role === 'admin' ? 'Administrator' : role}</span></div></div><button className="sidebar-signout" type="button" aria-label="Sign out" title="Sign out" onClick={() => setSignOutOpen(true)}><LogOut size={17} /><span>Sign out</span></button><button className="collapse-navigation" aria-expanded={!collapsed} type="button" onClick={() => setCollapsed(value => !value)} aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}><ChevronLeft size={16} /><span>Collapse navigation</span></button></div>
    </aside>
    <div className="workspace-frame"><header className="workspace-header"><div className="workspace-breadcrumb"><button type="button" aria-label="Open navigation" className="mobile-menu icon-button" onClick={() => setMobileOpen(true)}><Menu size={20} /></button><span className="breadcrumb-mark"><StewardGlyph name={current?.glyph || 'overview'} size={20} /></span><span>Workspace</span><ChevronRight size={13} /><strong>{current?.title || 'Stewards'}</strong></div><div className="workspace-tools"><button className="command-trigger" type="button" onClick={() => { setCommandOpen(true); setQuery(''); setSelectedIndex(0); }} aria-label="Find a page"><Search size={16} /><span>Jump to a page</span><kbd><Command size={11} /> K</kbd></button><MotionToggle compact /><button type="button" disabled={transitioning} className="icon-button theme-toggle" onClick={toggleDarkMode} aria-label={`Switch to ${darkMode ? 'light' : 'dark'} mode`} title={`Switch to ${darkMode ? 'light' : 'dark'} mode`}>{darkMode ? <Sun size={18} /> : <Moon size={18} />}</button></div></header>
      <main id="main-content" tabIndex={-1} className="workspace-main custom-scrollbar"><div key={location.pathname} className={`route-page route-${location.pathname === '/' ? 'dashboard' : location.pathname.slice(1)}`}><Outlet /></div><footer className="workspace-footer"><span className="church-owner">Jesus First Christian Ministries Inc. - Sapang Lamig</span><span>Faithful before God. Accountable to the church.</span></footer></main>
    </div>
    {commandOpen && <DialogLayer label="Find a page" onDismiss={() => setCommandOpen(false)}><div className="command-dialog dialog-surface"><div className="command-search"><Search size={21} /><input value={query} onChange={event => { setQuery(event.target.value); setSelectedIndex(0); }} placeholder="Where would you like to go?" aria-label="Find a page" onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); setSelectedIndex(index => (index + 1) % Math.max(results.length, 1)); } if (event.key === 'ArrowUp') { event.preventDefault(); setSelectedIndex(index => (index - 1 + results.length) % Math.max(results.length, 1)); } if (event.key === 'Enter' && results[selectedIndex]) jump(results[selectedIndex].path); }} /><button type="button" className="keycap" onClick={() => setCommandOpen(false)}>Esc</button></div><div className="command-results">{results.map((item, index) => <button type="button" key={item.path} data-selected={index === selectedIndex} onPointerMove={() => setSelectedIndex(index)} onClick={() => jump(item.path)}><span className="command-glyph"><StewardGlyph name={item.glyph} /></span><span><strong>{item.title}</strong><span>{item.detail}</span></span><ArrowRight size={17} /></button>)}{!results.length && <p className="empty-panel">No pages match “{query}”.</p>}</div><div className="command-footer"><span>↑ ↓ Navigate</span><span>Enter to open</span></div></div></DialogLayer>}
    {signOutOpen && <DialogLayer label="Sign out of Stewards" onDismiss={signingOut ? undefined : () => setSignOutOpen(false)}><div className="dialog-surface confirmation-dialog"><div className="confirmation-emblem"><LogOut size={26} /></div><h2>Leave your workspace?</h2><p>Sign out of Stewards on this device.</p>{signOutError && <p className="field-error" role="alert">{signOutError}</p>}<div className="confirmation-actions"><button className="button-secondary" disabled={signingOut} onClick={() => setSignOutOpen(false)}>Stay here</button><button className="button-primary" disabled={signingOut} onClick={signOut}>{signingOut ? 'Signing out…' : 'Sign out'}</button></div></div></DialogLayer>}
    {mustChangePassword && user && <ForcePasswordChangeModal onSuccess={() => setMustChangePassword(false)} />}
  </div>;
}
