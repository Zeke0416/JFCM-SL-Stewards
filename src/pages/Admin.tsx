// ==========================================
// SYSTEM ADMIN PAGE
// Purpose: Manage system settings, users, roles, and categories.
// ==========================================

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Users, FolderTree, Settings, Plus, Calendar, Edit2, Check, X, Trash2, AlertTriangle, ShieldCheck, KeyRound, CheckCircle2, Copy, Loader2, AlertCircle } from 'lucide-react';
import type { Profile, Category, FinancialYear, FinancialPeriod } from '../types/database.types';

export default function Admin() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'SYSTEM' | 'CATEGORIES' | 'USERS'>('USERS');
  const [churchId, setChurchId] = useState('');
  
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [years, setYears] = useState<FinancialYear[]>([]);
  const [periods, setPeriods] = useState<FinancialPeriod[]>([]);
  const [loading, setLoading] = useState(true);

  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', fullName: '', tempPassword: '', role: 'auditor' });
  const [userLoading, setUserLoading] = useState(false);
  const [userError, setUserError] = useState('');

  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState<{ id: string; name: string } | null>(null);
  const [newTempPassword, setNewTempPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');

  const [createdUserResult, setCreatedUserResult] = useState<{ fullName: string; tempPass: string; type: 'CREATED' | 'RESET' } | null>(null);
  const [copied, setCopied] = useState(false);

  const [isAddingCat, setIsAddingCat] = useState(false);
  const [newCat, setNewCat] = useState({ type: 'EXPENSE', code: '', name: '' });

  const [isAddingYear, setIsAddingYear] = useState(false);
  const [newYear, setNewYear] = useState({ year: new Date().getFullYear(), budget: '' });

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editRole, setEditRole] = useState<string>('');

  const [selectedResetPeriod, setSelectedResetPeriod] = useState('');
  const [resetConfirmation, setResetConfirmation] = useState('');
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (user) {
      setLoading(true);
      fetchAdminData().finally(() => setLoading(false));
    }
  }, [user]);

  const fetchAdminData = async () => {
    const { data: currentProfile } = await supabase.from('profiles').select('church_id, role').eq('id', user?.id).single();
    
    if (currentProfile) {
      setChurchId(currentProfile.church_id);
      
      const [profileRes, catRes, yearRes, periodRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('church_id', currentProfile.church_id).order('full_name'),
        supabase.from('categories').select('*').eq('church_id', currentProfile.church_id).order('type').order('sort_order'),
        supabase.from('financial_years').select('*').eq('church_id', currentProfile.church_id).order('year', { ascending: false }),
        supabase.from('financial_periods').select('*').eq('church_id', currentProfile.church_id).order('month', { ascending: true })
      ]);

      if (profileRes.data) setProfiles(profileRes.data);
      if (catRes.data) setCategories(catRes.data);
      
      if (yearRes.data) {
        setYears(yearRes.data);
        const nextAvailableYear = yearRes.data.length > 0 
          ? Math.max(...yearRes.data.map(y => y.year)) + 1 
          : new Date().getFullYear();
        setNewYear(prev => ({ ...prev, year: nextAvailableYear }));
      }

      if (periodRes.data) {
        setPeriods(periodRes.data);
        if (periodRes.data.length > 0 && !selectedResetPeriod) {
          setSelectedResetPeriod(periodRes.data[0].id);
        }
      }
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserLoading(true);
    setUserError('');
    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: { email: newUser.email, password: newUser.tempPassword, full_name: newUser.fullName, role: newUser.role, church_id: churchId }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setCreatedUserResult({ fullName: newUser.fullName, tempPass: newUser.tempPassword, type: 'CREATED' });
      setNewUser({ email: '', fullName: '', tempPassword: '', role: 'auditor' });
      setIsAddingUser(false);
      fetchAdminData(); 
    } catch (err: any) {
      setUserError(err.message || 'Failed to connect to Supabase Edge Function.');
    }
    setUserLoading(false);
  };

  const handleManualPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser) return;
    setResetLoading(true);
    setResetError('');
    try {
      const { data, error } = await supabase.functions.invoke('reset-password', {
        body: { userId: resetTargetUser.id, newPassword: newTempPassword }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setCreatedUserResult({ fullName: resetTargetUser.name, tempPass: newTempPassword, type: 'RESET' });
      setIsResettingPassword(false);
      setResetTargetUser(null);
      setNewTempPassword('');
      fetchAdminData();
    } catch (err: any) {
      setResetError(err.message || 'Failed to trigger reset-password edge function.');
    }
    setResetLoading(false);
  };

  const handleDeleteUser = async (targetUserId: string, name: string) => {
    if (targetUserId === user?.id) {
      alert("You cannot delete your own active administrator account.");
      return;
    }
    if (!confirm(`Are you sure you want to permanently delete test account "${name}"?`)) return;
    try {
      const { error } = await supabase.functions.invoke('delete-user', { body: { userId: targetUserId } });
      if (error) throw error;
      alert("User account successfully deleted.");
      fetchAdminData();
    } catch (err: any) {
      alert("Failed to delete user: " + (err.message || err));
    }
  };

  const handleCopyCredentials = () => {
    if (!createdUserResult) return;
    const text = `JFCM-SL Stewards Portal Access\nUser: ${createdUserResult.fullName}\nTemp Password: ${createdUserResult.tempPass}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCat.code || !newCat.name) return;
    await supabase.from('categories').insert({ church_id: churchId, type: newCat.type as 'INCOME' | 'EXPENSE', export_code: newCat.code, name: newCat.name, sort_order: 999 });
    setNewCat({ type: 'EXPENSE', code: '', name: '' });
    setIsAddingCat(false);
    fetchAdminData();
  };

  const handleAddYear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newYear.year) return;
    const { data: yearData, error } = await supabase.from('financial_years').insert({ church_id: churchId, year: newYear.year, approved_budget: parseFloat(newYear.budget) || 0 }).select().single();
    if (error) return alert("Error creating year: " + error.message);

    if (yearData) {
      const periodsToInsert = Array.from({ length: 12 }, (_, i) => {
        const date = new Date(yearData.year, i, 1);
        const monthName = date.toLocaleString('default', { month: 'long' });
        return { church_id: churchId, financial_year_id: yearData.id, month: i + 1, period_name: `${monthName} ${yearData.year}`, status: 'OPEN' };
      });
      await supabase.from('financial_periods').insert(periodsToInsert);
    }
    setIsAddingYear(false);
    fetchAdminData();
  };

  const handleSaveUser = async (id: string) => {
    if (!editFullName.trim() || !editRole) return;
    if (id === user?.id && editRole !== 'admin') {
      alert("You cannot remove your own administrator access.");
      return;
    }
    
    await supabase.from('profiles').update({ 
      full_name: editFullName.trim(),
      role: editRole 
    }).eq('id', id);
    
    setEditingUserId(null);
    fetchAdminData();
  };

  const handleResetPeriod = async () => {
    if (resetConfirmation !== 'RESET') {
      alert("Please type 'RESET' exactly to confirm deletion.");
      return;
    }
    if (!selectedResetPeriod) return;
    setResetting(true);
    const { error } = await supabase.rpc('reset_period_transactions', { p_period_id: selectedResetPeriod, p_church_id: churchId });
    setResetting(false);
    if (error) {
      alert("Failed to reset period: " + error.message);
    } else {
      alert("Transactions and reconciliation data for this period have been successfully wiped clean!");
      setResetConfirmation('');
    }
  };

  if (loading) return <div className="p-12 text-center text-slate-500 font-medium text-xs">Loading administrative workspace...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
          <ShieldCheck className="h-7 w-7 text-brand dark:text-emerald-500" />
          System Administration
        </h1>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">Manage institutional users, temporary passwords, reset requests, and financial years.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-1.5 p-1.5 bg-slate-200/70 dark:bg-slate-900/80 rounded-xl w-full max-w-xl border border-slate-300 dark:border-slate-800 shadow-inner">
        <button onClick={() => setActiveTab('USERS')} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-bold transition-all truncate ${activeTab === 'USERS' ? 'bg-slate-800 text-white dark:bg-slate-700 shadow-md' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'}`}>
          <Users className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">Personnel</span>
        </button>
        <button onClick={() => setActiveTab('SYSTEM')} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-bold transition-all truncate ${activeTab === 'SYSTEM' ? 'bg-slate-800 text-white dark:bg-slate-700 shadow-md' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'}`}>
          <Settings className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">System</span>
        </button>
        <button onClick={() => setActiveTab('CATEGORIES')} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-bold transition-all truncate ${activeTab === 'CATEGORIES' ? 'bg-slate-800 text-white dark:bg-slate-700 shadow-md' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'}`}>
          <FolderTree className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">Categories</span>
        </button>
      </div>

      {activeTab === 'USERS' && (
        <div className="bento-card space-y-6 bg-white dark:bg-[#121212]">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Authorized Personnel & User Management</h3>
              <p className="text-xs text-slate-500 mt-0.5">Add new auditors, reassign roles, and handle credentials.</p>
            </div>
            {!isAddingUser && (
              <button onClick={() => setIsAddingUser(true)} className="flex items-center gap-2 bg-brand dark:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-brand-dark transition-colors shadow-sm shrink-0 w-full sm:w-auto justify-center">
                <Plus className="h-4 w-4" /> Add New User
              </button>
            )}
          </div>

          {userError && (
            <div className="bg-red-50 text-red-700 p-4 rounded-2xl text-xs font-medium flex items-center gap-2.5 border border-red-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{userError}</span>
            </div>
          )}

          {isAddingUser && (
            <form onSubmit={handleCreateUser} className="bg-slate-50/50 dark:bg-[#1A1A1A] p-5 rounded-2xl border border-slate-200 dark:border-[#27272A] space-y-4">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Create User Account</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1 w-full">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">Full Name</label>
                  <input type="text" required placeholder="Ezekiel Cabusay" className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#121212] px-3.5 py-2.5 text-xs font-medium text-slate-900 dark:text-white" value={newUser.fullName} onChange={e => setNewUser({...newUser, fullName: e.target.value})} />
                </div>
                <div className="space-y-1 w-full">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">Email Address</label>
                  <input type="email" required placeholder="user@jfcm.org" className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#121212] px-3.5 py-2.5 text-xs font-medium text-slate-900 dark:text-white" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
                </div>
                <div className="space-y-1 w-full">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">Temporary Password</label>
                  <input type="text" required placeholder="Min 6 characters" className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#121212] px-3.5 py-2.5 text-xs font-medium text-slate-900 dark:text-white" value={newUser.tempPassword} onChange={e => setNewUser({...newUser, tempPassword: e.target.value})} />
                </div>
                <div className="space-y-1 w-full">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">System Role</label>
                  <select className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#121212] px-3.5 py-2.5 text-xs font-medium text-slate-900 dark:text-white" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                    <option value="auditor">Auditor</option>
                    <option value="missionary">Missionary</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsAddingUser(false)} className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-slate-600 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">Cancel</button>
                <button type="submit" disabled={userLoading} className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-white bg-brand dark:bg-emerald-700 rounded-xl shadow-sm flex items-center justify-center gap-2 hover:bg-brand-dark">
                  {userLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{userLoading ? 'Creating User...' : 'Create & Assign Temp Password'}</span>
                </button>
              </div>
            </form>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-[#27272A] custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-[#0A0A0A] border-b border-slate-200 dark:border-[#27272A] text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="p-4 whitespace-nowrap">Real Name (Encoder)</th>
                  <th className="p-4 whitespace-nowrap">System Role</th>
                  <th className="p-4 whitespace-nowrap">Status</th>
                  <th className="p-4 text-right whitespace-nowrap">Admin Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#27272A]/50 bg-transparent">
                {profiles.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors group">
                    <td className="p-4 whitespace-nowrap min-w-[200px]">
                      {editingUserId === p.id ? (
                        <input type="text" autoFocus className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white" value={editFullName} onChange={(e) => setEditFullName(e.target.value)} />
                      ) : (
                        <span className="font-semibold text-slate-900 dark:text-white">{p.full_name}</span>
                      )}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      {editingUserId === p.id ? (
                        <select className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white" value={editRole} onChange={(e) => setEditRole(e.target.value)}>
                          <option value="auditor">Auditor</option>
                          <option value="missionary">Missionary</option>
                          <option value="admin">Administrator</option>
                        </select>
                      ) : (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide border border-slate-200 dark:border-[#27272A] bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 uppercase`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${p.role === 'admin' ? 'bg-purple-500' : p.role === 'missionary' ? 'bg-amber-500' : 'bg-blue-500'}`}></span>
                          {p.role}
                        </span>
                      )}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide border border-slate-200 dark:border-[#27272A] bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 uppercase">
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${p.is_active ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                        {p.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="p-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {editingUserId === p.id ? (
                          <div className="inline-flex items-center gap-1">
                            <button onClick={() => setEditingUserId(null)} className="p-1.5 text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-lg"><X className="h-4 w-4" /></button>
                            <button onClick={() => handleSaveUser(p.id)} className="p-1.5 text-white bg-emerald-600 rounded-lg hover:bg-emerald-500"><Check className="h-4 w-4" /></button>
                          </div>
                        ) : (
                          <>
                            <button onClick={() => { setEditingUserId(p.id); setEditFullName(p.full_name); setEditRole(p.role); }} className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Edit Profile"><Edit2 className="h-3.5 w-3.5" /> Edit</button>
                            <button onClick={() => { setResetTargetUser({ id: p.id, name: p.full_name }); setIsResettingPassword(true); }} className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Reset"><KeyRound className="h-3.5 w-3.5" /> Reset</button>
                            <button onClick={() => handleDeleteUser(p.id, p.full_name)} className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors" title="Delete"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isResettingPassword && resetTargetUser && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
          <form onSubmit={handleManualPasswordReset} className="w-full max-w-md bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#27272A] rounded-3xl p-8 shadow-2xl space-y-6 animate-modal">
            <div className="text-center space-y-2">
              <div className="mx-auto h-14 w-14 bg-amber-100 dark:bg-amber-950/60 rounded-2xl flex items-center justify-center text-amber-600"><KeyRound className="h-7 w-7" /></div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Admin Password Reset</h3>
              <p className="text-xs text-slate-500">Set a new temporary password for <strong className="text-slate-700 dark:text-slate-300">{resetTargetUser.name}</strong>.</p>
            </div>
            {resetError && <div className="bg-red-50 text-red-700 p-3.5 rounded-xl text-xs font-medium border border-red-200">{resetError}</div>}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">New Temporary Password</label>
              <input type="text" required placeholder="Min 6 characters" className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-3 text-xs font-medium text-slate-900 dark:text-white" value={newTempPassword} onChange={e => setNewTempPassword(e.target.value)} />
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button type="button" onClick={() => { setIsResettingPassword(false); setResetTargetUser(null); }} className="w-full sm:flex-1 py-3.5 rounded-xl text-xs font-bold text-slate-600 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">Cancel</button>
              <button type="submit" disabled={resetLoading} className="w-full sm:flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 transition-all shadow-md">
                {resetLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>{resetLoading ? 'Resetting...' : 'Confirm Reset'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {createdUserResult && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#27272A] rounded-3xl p-8 shadow-2xl space-y-6 animate-modal text-center">
            <div className="mx-auto h-16 w-16 bg-emerald-100 dark:bg-emerald-950/60 rounded-2xl flex items-center justify-center text-emerald-600 animate-bounce"><CheckCircle2 className="h-8 w-8" /></div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{createdUserResult.type === 'CREATED' ? 'Auditor Account Created!' : 'Password Reset Successful!'}</h3>
              <p className="text-xs text-slate-500">The user has been successfully provisioned with a temporary password.</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-left space-y-2 text-xs font-mono">
              <div className="flex justify-between"><span className="text-slate-400">Name:</span><span className="font-bold text-slate-900 dark:text-white">{createdUserResult.fullName}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Temp Password:</span><span className="font-bold text-emerald-600">{createdUserResult.tempPass}</span></div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button onClick={handleCopyCredentials} className="w-full sm:flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200"><Copy className="h-4 w-4" />{copied ? 'Copied Details!' : 'Copy Credentials'}</button>
              <button onClick={() => setCreatedUserResult(null)} className="w-full sm:flex-1 py-3.5 rounded-xl text-xs font-bold text-white bg-brand dark:bg-emerald-700 shadow-md">Done</button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'SYSTEM' && (
        <div className="space-y-6">
          <div className="bento-card space-y-6 bg-white dark:bg-[#121212]">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Financial Years</h3>
                <p className="text-xs text-slate-500 mt-0.5">Initializing a new year automatically provisions its 12 open monthly reporting periods.</p>
              </div>
              {!isAddingYear && (
                <button onClick={() => setIsAddingYear(true)} className="flex items-center justify-center gap-2 bg-brand dark:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm w-full sm:w-auto">
                  <Calendar className="h-4 w-4" /> Initialize New Year
                </button>
              )}
            </div>

            {isAddingYear && (
              <form onSubmit={handleAddYear} className="bg-slate-50/50 dark:bg-[#1A1A1A] p-5 rounded-2xl border border-slate-200 dark:border-[#27272A] flex flex-col sm:flex-row items-end gap-4 animate-in fade-in">
                <div className="space-y-1.5 w-full sm:flex-1 sm:min-w-[150px]">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">Year</label>
                  <input type="number" required className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#121212] px-3.5 py-2.5 text-xs font-medium text-slate-900 dark:text-white" value={newYear.year} onChange={e => setNewYear({...newYear, year: parseInt(e.target.value)})} />
                </div>
                <div className="space-y-1.5 w-full sm:flex-1 sm:min-w-[150px]">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">Approved Budget</label>
                  <input type="number" required className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#121212] px-3.5 py-2.5 text-xs font-medium text-slate-900 dark:text-white" value={newYear.budget} onChange={e => setNewYear({...newYear, budget: e.target.value})} />
                </div>
                <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                  <button type="button" onClick={() => setIsAddingYear(false)} className="flex-1 sm:flex-none px-4 py-2.5 text-xs font-bold text-slate-600 bg-white dark:bg-[#121212] border border-slate-200 dark:border-slate-700 rounded-xl">Cancel</button>
                  <button type="submit" className="flex-1 sm:flex-none px-5 py-2.5 text-xs font-bold text-white bg-brand dark:bg-emerald-700 rounded-xl shadow-sm">Save Year</button>
                </div>
              </form>
            )}

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-[#27272A] custom-scrollbar">
              <table className="w-full text-left text-xs border-collapse min-w-[500px]">
                <thead>
                  <tr className="bg-transparent border-b border-slate-200 dark:border-[#27272A] text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="p-4">Financial Year</th>
                    <th className="p-4">Approved Budget</th>
                    <th className="p-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#27272A]/50 bg-transparent">
                  {years.map(y => (
                    <tr key={y.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="p-4 font-semibold text-slate-900 dark:text-white">{y.year}</td>
                      <td className="p-4 font-mono font-medium text-slate-700 dark:text-slate-300">₱{Number(y.approved_budget).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="p-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide border border-slate-200 dark:border-[#27272A] bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 uppercase">
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${y.is_closed ? 'bg-slate-400' : 'bg-emerald-500'}`}></span>
                          {y.is_closed ? 'Closed' : 'Active'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bento-card border-red-200 dark:border-red-900/30 bg-red-50/30 dark:bg-red-950/10 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-red-100 dark:bg-red-900/40 rounded-xl text-red-600 dark:text-red-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-red-900 dark:text-red-200">Test Data Maintenance (Reset Period)</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Permanently wipe transactions and reconciliation records for a specific month/year.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">Select Period to Reset</label>
                <select 
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#121212] px-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-white shadow-sm"
                  value={selectedResetPeriod}
                  onChange={(e) => setSelectedResetPeriod(e.target.value)}
                >
                  {periods.map(p => (
                    <option key={p.id} value={p.id}>{p.period_name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">Type "RESET" to Confirm</label>
                <input 
                  type="text" 
                  placeholder="Type RESET here" 
                  className="w-full rounded-xl border border-red-200 dark:border-red-900/50 bg-white dark:bg-[#121212] px-3.5 py-2.5 text-xs font-bold text-red-900 dark:text-red-300 shadow-sm"
                  value={resetConfirmation}
                  onChange={(e) => setResetConfirmation(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <button 
                  onClick={handleResetPeriod}
                  disabled={resetting || resetConfirmation !== 'RESET'}
                  className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-all"
                >
                  <Trash2 className="h-4 w-4" />
                  {resetting ? 'Wiping Data...' : 'Reset Period Data'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'CATEGORIES' && (
        <div className="bento-card space-y-6 bg-white dark:bg-[#121212]">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Dynamic ComBud Categories</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Manage official ComBud account codes and custom institutional categories.</p>
            </div>
            {!isAddingCat && (
              <button onClick={() => setIsAddingCat(true)} className="flex items-center justify-center gap-2 bg-brand dark:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-brand-dark shadow-sm w-full sm:w-auto">
                <Plus className="h-4 w-4" /> Add Category
              </button>
            )}
          </div>

          {isAddingCat && (
            <form onSubmit={handleAddCategory} className="bg-slate-50/50 dark:bg-[#1A1A1A] p-5 rounded-2xl border border-slate-200 dark:border-[#27272A] flex flex-col sm:flex-row items-end gap-4 animate-in fade-in">
              <div className="space-y-1.5 w-full sm:flex-1 sm:min-w-[120px]">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Type</label>
                <select className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#121212] px-3.5 py-2.5 text-xs font-medium text-slate-900 dark:text-white" value={newCat.type} onChange={e => setNewCat({...newCat, type: e.target.value as 'INCOME' | 'EXPENSE'})}>
                  <option value="EXPENSE">Expense</option>
                  <option value="INCOME">Income</option>
                </select>
              </div>
              <div className="space-y-1.5 w-full sm:flex-1 sm:min-w-[120px]">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Account Code</label>
                <input type="text" required placeholder="e.g. 501" className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#121212] px-3.5 py-2.5 text-xs font-medium text-slate-900 dark:text-white" value={newCat.code} onChange={e => setNewCat({...newCat, code: e.target.value})} />
              </div>
              <div className="space-y-1.5 w-full sm:flex-[2] sm:min-w-[200px]">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Category Name</label>
                <input type="text" required placeholder="e.g. Honorarium" className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#121212] px-3.5 py-2.5 text-xs font-medium text-slate-900 dark:text-white" value={newCat.name} onChange={e => setNewCat({...newCat, name: e.target.value})} />
              </div>
              <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                <button type="button" onClick={() => setIsAddingCat(false)} className="flex-1 sm:flex-none px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 bg-white dark:bg-[#121212] border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancel</button>
                <button type="submit" className="flex-1 sm:flex-none px-5 py-2.5 text-xs font-bold text-white bg-brand dark:bg-emerald-700 rounded-xl shadow-sm hover:bg-brand-dark dark:hover:bg-emerald-800 transition-colors">Save</button>
              </div>
            </form>
          )}

          <div className="max-h-[500px] overflow-y-auto custom-scrollbar rounded-xl border border-slate-200 dark:border-[#27272A]">
            <table className="w-full text-left text-xs border-collapse relative min-w-[500px]">
              <thead className="sticky top-0 bg-transparent z-10 border-b border-slate-200 dark:border-[#27272A] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px] backdrop-blur-md">
                <tr>
                  <th className="p-4 w-28">Type</th>
                  <th className="p-4 w-36">Account Code</th>
                  <th className="p-4">Account Name</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#27272A]/50 bg-transparent">
                {categories.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="p-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide border border-slate-200 dark:border-[#27272A] bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 uppercase">
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${c.type === 'INCOME' ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                        {c.type}
                      </span>
                    </td>
                    <td className="p-4 font-mono font-medium text-slate-700 dark:text-slate-300">{c.export_code}</td>
                    <td className="p-4 font-semibold text-slate-900 dark:text-white">{c.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}