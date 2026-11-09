import { LedgerMotion, MotionToggle } from '../components/ui/Motion';
import { useTheme } from '../contexts/ThemeContext';
import { Moon, Sun } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Lock, Mail, ArrowRight, AlertCircle, Loader2, X, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import logo from '../assets/favicon.png';

interface SavedAccount {
  email: string;
  fullName: string;
}

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
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
  const { darkMode, toggleDarkMode, transitioning } = useTheme();

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
    <div className="login-page">
      <aside className="login-story">
        <div className="login-brand"><img src={logo} alt="JFCM-SL" /><span><strong>Stewards.</strong><span>JFCM-SL financial workspace</span></span></div>
        <div className="login-story-copy"><span className="story-caption">Honesty. Integrity. Responsibility.</span><h1>Faithful stewardship.<br />Honest records.</h1><p>Care for the resources entrusted to the church,<br />with accountability before God and His people.</p></div>
        <div className="login-motion-stage"><LedgerMotion /><div className="motion-stage-caption"><span className="caption-rule" /><span>Faithful stewardship before God.</span><MotionToggle /></div></div>
        <div className="login-story-footer"><span>JFCM-SL</span><span>Serve with integrity.</span></div>
      </aside>
      <main className="login-main"><div className="login-utility"><span>Personnel access</span><button type="button" className="icon-button" onClick={toggleDarkMode} disabled={transitioning} aria-label={`Switch to ${darkMode ? 'light' : 'dark'} mode`}>{darkMode ? <Sun size={18} /> : <Moon size={18} />}</button><MotionToggle compact /></div>
        <div className="login-form-wrap" id="login-form">
          <div className="login-mobile-brand"><img src={logo} alt="" /><span>JFCM-SL Stewards</span></div>
          <div className="login-heading"><span className="login-welcome">Church financial system</span><h2>Welcome back.</h2><p>Sign in to your church financial workspace.</p></div>
          {showSuccessModal ? <div className="login-success" role="status"><CheckCircle2 size={30} /><h3>You're signed in.</h3><p>Opening your workspace…</p></div> : <>
            {savedAccounts.length > 0 && !selectedAccount && <section className="saved-accounts" aria-label="Saved accounts"><p className="text-sm text-light-textSecondary dark:text-dark-textSecondary mb-3">Continue with a saved account</p>{savedAccounts.map(account => <div key={account.email} className="saved-account"><button type="button" onClick={() => handleSelectAccount(account)}><span className="account-avatar">{account.fullName.charAt(0).toUpperCase()}</span><span className="min-w-0"><strong>{account.fullName}</strong><span>{account.email}</span></span></button><button type="button" aria-label={`Remove saved account ${account.fullName}`} onClick={e => handleRemoveSavedAccount(e, account.email)}><X size={16} /></button></div>)}</section>}
            {selectedAccount && <div className="selected-account"><div><span className="text-sm">Signing in as</span><strong>{selectedAccount}</strong></div><button type="button" onClick={() => { setSelectedAccount(null); setPassword(''); }}>Change</button></div>}
            {error && <div className="login-error" role="alert" id="login-error"><AlertCircle size={18} /><span>{error}</span></div>}
            {isLocked && <p role="status" className="text-sm text-rose-700 dark:text-rose-300 mb-4">Please wait {remainingSeconds} seconds before trying again.</p>}
            <form onSubmit={handleLogin} className="stewards-login-form" aria-busy={loading}>
              {!selectedAccount && <div><label htmlFor="login-email">Email address</label><div className="login-input"><Mail size={18} /><input id="login-email" type="email" required autoComplete="username" disabled={isLocked || loading} value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.org" aria-describedby={error ? 'login-error' : undefined} /></div></div>}
              <div><label htmlFor="login-password">Password</label><div className="login-input"><Lock size={18} /><input id="login-password" type={showPassword ? 'text' : 'password'} required autoComplete="current-password" disabled={isLocked || loading} autoFocus={!!selectedAccount} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" aria-describedby={error ? 'login-error' : undefined} /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
              <label className="remember-account"><input type="checkbox" disabled={isLocked || loading} checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />Remember account on this device</label>
              <button type="submit" className="login-submit" disabled={loading || isLocked}>{loading ? <Loader2 size={18} className="animate-spin" /> : null}<span>{loading ? 'Signing in…' : isLocked ? `Try again in ${remainingSeconds}s` : 'Sign in'}</span>{!loading && !isLocked && <ArrowRight size={18} />}</button>
            </form>
          </>}
          <div className="login-footnote"><Lock size={14} /><span>For authorized church personnel</span></div>
        </div>
        <footer className="login-footer church-login-footer"><strong>Jesus First Christian Ministries Inc. - Sapang Lamig</strong><span>Stewards · Honest records. Faithful service.</span></footer>
      </main>
    </div>
  );
}
