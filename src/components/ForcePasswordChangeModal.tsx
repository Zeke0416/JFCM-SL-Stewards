import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Lock, ShieldAlert, Loader2, CheckCircle2 } from 'lucide-react';

interface Props {
  onSuccess: () => void;
}

export default function ForcePasswordChangeModal({ onSuccess }: Props) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successAnim, setSuccessAnim] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Update password in Supabase Auth securely on the client
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      // 2. Invoke the Edge Function to securely clear the database flag, bypassing RLS
      const { data, error: fnError } = await supabase.functions.invoke('clear-password-flag');
      
      if (fnError || data?.error) {
        throw new Error(fnError?.message || data?.error || 'Failed to clear security flag.');
      }

      setLoading(false);
      
      // 3. Trigger the World-Class Success Animation
      setSuccessAnim(true);
      
      // 4. Wait 1.5 seconds for the user to see the success state before closing
      setTimeout(() => {
        onSuccess();
      }, 1500);

    } catch (err: any) {
      setError(err.message || 'Failed to complete security update. Ensure "clear-password-flag" is deployed.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 transition-opacity">
      <div className="w-full max-w-md bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#27272A] rounded-3xl p-8 shadow-2xl relative flex flex-col justify-center min-h-[400px] animate-modal">
        
        {successAnim ? (
          <div className="flex flex-col items-center justify-center space-y-4 text-center animate-in fade-in zoom-in duration-300 my-auto">
            <div className="h-16 w-16 bg-emerald-100 dark:bg-emerald-950/60 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 animate-bounce">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Password Updated!</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Your account is now fully secured. Redirecting to your portal...</p>
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in duration-300 flex flex-col h-full justify-between">
            <div className="text-center space-y-2 mb-6">
              <div className="mx-auto h-14 w-14 bg-amber-100 dark:bg-amber-950/40 rounded-2xl flex items-center justify-center text-amber-600 dark:text-amber-400">
                <ShieldAlert className="h-7 w-7" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Security Update Required</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">You are logged in with a temporary password. Please set a new secure password to continue.</p>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 p-3.5 rounded-xl text-xs font-medium border border-red-200 dark:border-red-900 mb-4 animate-in fade-in">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 mt-auto">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    autoFocus
                    placeholder="At least 6 characters..."
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:border-brand dark:focus:border-emerald-500 focus:ring-1 focus:ring-brand transition-colors"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Confirm New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    placeholder="Re-enter new password..."
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:border-brand dark:focus:border-emerald-500 focus:ring-1 focus:ring-brand transition-colors"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-xs font-bold text-white bg-brand dark:bg-emerald-700 hover:bg-brand-dark dark:hover:bg-emerald-800 shadow-md transition-all mt-4"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>{loading ? 'Updating Password...' : 'Update Password & Continue'}</span>
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}