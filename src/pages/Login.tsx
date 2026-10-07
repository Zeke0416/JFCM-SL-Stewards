import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { Lock, Mail, ArrowRight, AlertCircle, Loader2, X, CheckCircle2 } from 'lucide-react';
import logo from '../assets/favicon.png';

interface SavedAccount {
  email: string;
  fullName: string;
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  
  // Rate limiting state
  const [lockoutUntil, setLockoutUntil] = useState<number>(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  const navigate = useNavigate();

  useEffect(() => {
    const stored = localStorage.getItem('jfcm_saved_accounts');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSavedAccounts(parsed);
        }
      } catch (e) {
        console.error("Failed to parse saved accounts", e);
      }
    }

    // Check active lockout
    const storedLockout = localStorage.getItem('jfcm_login_lockout');
    if (storedLockout) {
      const lockTime = parseInt(storedLockout, 10);
      if (Date.now() < lockTime) {
        setLockoutUntil(lockTime);
      } else {
        localStorage.removeItem('jfcm_login_lockout');
        localStorage.removeItem('jfcm_login_attempts');
      }
    }
  }, []);

  useEffect(() => {
    if (lockoutUntil > 0) {
      const interval = setInterval(() => {
        const left = Math.ceil((lockoutUntil - Date.now()) / 1000);
        if (left <= 0) {
          setLockoutUntil(0);
          setRemainingSeconds(0);
          localStorage.removeItem('jfcm_login_lockout');
          localStorage.removeItem('jfcm_login_attempts');
          clearInterval(interval);
        } else {
          setRemainingSeconds(left);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [lockoutUntil]);

  const saveAccountToDevice = (userEmail: string, name: string) => {
    const existing = savedAccounts.filter(acc => acc.email !== userEmail);
    const updated = [{ email: userEmail, fullName: name || userEmail }, ...existing].slice(0, 4);
    setSavedAccounts(updated);
    localStorage.setItem('jfcm_saved_accounts', JSON.stringify(updated));
  };

  const handleRemoveSavedAccount = (e: React.MouseEvent, accountEmail: string) => {
    e.stopPropagation();
    const updated = savedAccounts.filter(acc => acc.email !== accountEmail);
    setSavedAccounts(updated);
    localStorage.setItem('jfcm_saved_accounts', JSON.stringify(updated));
    if (selectedAccount === accountEmail) {
      setSelectedAccount(null);
      setEmail('');
    }
  };

  const handleSelectAccount = (account: SavedAccount) => {
    setSelectedAccount(account.email);
    setEmail(account.email);
    setError('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutUntil > 0 && Date.now() < lockoutUntil) return;

    setLoading(true);
    setError('');

    const { data, error: authError } = await supabase.auth.signInWithPassword({ 
      email, 
      password 
    });
    
    if (authError) {
      const attemptsKey = 'jfcm_login_attempts';
      const currentAttempts = parseInt(localStorage.getItem(attemptsKey) || '0', 10) + 1;
      localStorage.setItem(attemptsKey, currentAttempts.toString());

      if (currentAttempts >= 5) {
        const suspensionTime = Date.now() + 60000; // 1 minute lockout
        setLockoutUntil(suspensionTime);
        localStorage.setItem('jfcm_login_lockout', suspensionTime.toString());
        setError('Maximum login attempts exceeded (5/5). Account suspended for 1 minute.');
      } else {
        setError(`${authError.message} (${currentAttempts}/5 failed attempts)`);
      }

      setLoading(false);
      return;
    }

    // Clear attempts on success
    localStorage.removeItem('jfcm_login_attempts');
    localStorage.removeItem('jfcm_login_lockout');

    if (data.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', data.user.id)
        .single();
      
      const fullName = profile?.full_name || data.user.email?.split('@')[0] || 'Steward';
      if (rememberMe) {
        saveAccountToDevice(email, fullName);
      }
    }

    setLoading(false);
    setShowSuccessModal(true);
    setTimeout(() => {
      navigate('/');
    }, 1200);
  };

  const isLocked = lockoutUntil > 0 && Date.now() < lockoutUntil;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-[#05070A] p-4 sm:p-6 transition-colors duration-200">
      
      {/* Login Success Modal */}
      {showSuccessModal && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/75 dark:bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#27272A] rounded-2xl p-8 shadow-2xl flex flex-col items-center justify-center space-y-4 animate-in zoom-in-95 duration-300 min-w-[300px]">
            <div className="h-16 w-16 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 animate-bounce">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold uppercase tracking-wider text-slate-900 dark:text-white">Authentication Verified</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Redirecting to secure financial portal...</p>
            </div>
          </div>
        </div>,
        document.body
      )}

      <div className="w-full max-w-md bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#27272A] rounded-2xl p-6 sm:p-10 shadow-2xl space-y-6 sm:space-y-8 animate-in fade-in zoom-in-95 duration-300">
        
        {/* Header Section */}
        <div className="text-center space-y-3">
          <img 
            src={logo} 
            alt="JFCM-SL Logo" 
            className="mx-auto h-16 w-16 object-contain drop-shadow-md"
          />
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">JFCM-SL Stewards</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Church Financial Operations & Audit Portal</p>
          </div>
        </div>

        {/* Saved Accounts Picker */}
        {savedAccounts.length > 0 && !selectedAccount && !isLocked && (
          <div className="space-y-3 pt-1">
            <p className="text-[10px] sm:text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Recent Accounts</p>
            
            {savedAccounts.length === 1 ? (
              <div
                onClick={() => handleSelectAccount(savedAccounts[0])}
                className="group relative bg-slate-50 dark:bg-[#121212] hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 border border-slate-200 dark:border-[#27272A] hover:border-emerald-500/50 p-4 rounded-xl cursor-pointer transition-all flex items-center justify-between shadow-sm"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="h-11 w-11 shrink-0 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-base shadow-inner">
                    {savedAccounts[0].fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{savedAccounts[0].fullName}</p>
                    <p className="text-[11px] text-slate-400 truncate">{savedAccounts[0].email}</p>
                  </div>
                </div>
                <button
                  onClick={(e) => handleRemoveSavedAccount(e, savedAccounts[0].email)}
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-slate-200 dark:hover:bg-[#1A1A1A] transition-all shrink-0"
                  title="Remove account"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {savedAccounts.map((acc) => (
                  <div
                    key={acc.email}
                    onClick={() => handleSelectAccount(acc)}
                    className="group relative bg-slate-50 dark:bg-[#121212] hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 border border-slate-200 dark:border-[#27272A] hover:border-emerald-500/50 p-4 rounded-xl cursor-pointer transition-all flex items-center sm:flex-col sm:items-center text-left sm:text-center space-x-3 sm:space-x-0 sm:space-y-2 shadow-sm"
                  >
                    <button
                      onClick={(e) => handleRemoveSavedAccount(e, acc.email)}
                      className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 p-1.5 rounded-full text-slate-400 hover:text-rose-500 hover:bg-slate-200 dark:hover:bg-[#1A1A1A] transition-all"
                      title="Remove account"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <div className="h-10 w-10 shrink-0 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm shadow-inner">
                      {acc.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div className="w-full truncate">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{acc.fullName}</p>
                      <p className="text-[10px] text-slate-400 truncate">{acc.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="relative flex py-3 items-center">
              <div className="flex-grow border-t border-slate-200 dark:border-[#27272A]"></div>
              <span className="flex-shrink mx-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">or log in with email</span>
              <div className="flex-grow border-t border-slate-200 dark:border-[#27272A]"></div>
            </div>
          </div>
        )}

        {selectedAccount && (
          <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 p-4 rounded-xl">
            <div className="flex items-center gap-3 truncate">
              <div className="h-9 w-9 shrink-0 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                {selectedAccount.charAt(0).toUpperCase()}
              </div>
              <div className="truncate">
                <p className="text-xs font-bold text-slate-900 dark:text-white">Signing in as</p>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-mono truncate">{selectedAccount}</p>
              </div>
            </div>
            <button 
              onClick={() => { setSelectedAccount(null); setEmail(''); }} 
              className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white underline shrink-0 ml-2"
            >
              Switch
            </button>
          </div>
        )}

        {isLocked && (
          <div className="bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 p-4 rounded-xl text-xs font-medium flex items-center gap-2.5 border border-rose-200 dark:border-rose-900/50">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Account temporarily suspended due to multiple failed logins. Please retry in <strong>{remainingSeconds}s</strong>.</span>
          </div>
        )}

        {error && !isLocked && (
          <div className="bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 p-4 rounded-xl text-xs font-medium flex items-center gap-2.5 border border-rose-200 dark:border-rose-900/50">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5">
          {!selectedAccount && (
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  required
                  disabled={isLocked}
                  autoComplete="email"
                  placeholder="steward@jfcm.org"
                  className="w-full pl-10 pr-4 py-3 sm:py-3.5 rounded-xl border border-slate-200 dark:border-[#27272A] bg-slate-50 dark:bg-[#121212] text-xs font-medium text-slate-900 dark:text-white focus:border-emerald-500 outline-none transition-colors disabled:opacity-50"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
              <input
                type="password"
                required
                disabled={isLocked}
                autoFocus={!!selectedAccount}
                autoComplete="current-password"
                placeholder="Enter password..."
                className="w-full pl-10 pr-4 py-3 sm:py-3.5 rounded-xl border border-slate-200 dark:border-[#27272A] bg-slate-50 dark:bg-[#121212] text-xs font-medium text-slate-900 dark:text-white focus:border-emerald-500 outline-none transition-colors disabled:opacity-50"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2.5 cursor-pointer text-slate-600 dark:text-slate-400 font-medium">
              <input 
                type="checkbox" 
                disabled={isLocked}
                checked={rememberMe} 
                onChange={(e) => setRememberMe(e.target.checked)} 
                className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-[#1A1A1A]" 
              />
              Remember account on this device
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || isLocked}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-md mt-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            <span>{loading ? 'Authenticating...' : isLocked ? `Locked (${remainingSeconds}s)` : 'Sign In to Portal'}</span>
            {!loading && !isLocked && <ArrowRight className="h-4 w-4" />}
          </button>
        </form>

        <div className="text-center pt-3 border-t border-slate-200 dark:border-[#27272A]">
          <p className="text-[11px] text-slate-400 dark:text-slate-500">Authorized personnel only. All access is audited.</p>
        </div>

      </div>
    </div>
  );
}