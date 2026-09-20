// ==========================================
// FINANCIAL SETUP PAGE COMPONENT
// Purpose: Manages Financial Years, Base Budgets, Category Target Tracking, and Data Maintenance.
// ==========================================

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, Trash2, Target, ShieldCheck, Plus, CheckCircle2, AlertTriangle, Loader2, Edit2, Check, X, Search } from 'lucide-react';
import type { FinancialYear, FinancialPeriod, Category } from '../types/database.types';

type NotificationState = { isOpen: boolean; type: 'SUCCESS' | 'ERROR' | 'WARNING'; title: string; message: string; } | null;

export default function FinancialSetup() {
  const { user } = useAuth();
  const [churchId, setChurchId] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'YEARS' | 'BUDGET' | 'RESET'>('YEARS');
  const [notification, setNotification] = useState<NotificationState>(null);

  const [years, setYears] = useState<FinancialYear[]>([]);
  const [periods, setPeriods] = useState<FinancialPeriod[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [isAddingYear, setIsAddingYear] = useState(false);
  const [newYear, setNewYear] = useState({ year: new Date().getFullYear(), budget: '' });

  const [editingYearId, setEditingYearId] = useState<string | null>(null);
  const [editBudgetAmount, setEditBudgetAmount] = useState<string>('');

  const [selectedBudgetYear, setSelectedBudgetYear] = useState<string>('');
  const [categoryTargets, setCategoryTargets] = useState<Record<string, number>>({});
  const [displayTargets, setDisplayTargets] = useState<Record<string, string>>({});
  const [savingTargets, setSavingTargets] = useState(false);
  
  // New Budget Search & Tabs
  const [budgetTab, setBudgetTab] = useState<'INCOME' | 'EXPENSE'>('INCOME');
  const [budgetSearch, setBudgetSearch] = useState('');

  const [selectedResetPeriod, setSelectedResetPeriod] = useState('');
  const [resetConfirmation, setResetConfirmation] = useState('');
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (user) {
      setLoading(true);
      fetchSetupData().finally(() => setLoading(false));
    }
  }, [user]);

  const fetchSetupData = async () => {
    const { data: currentProfile } = await supabase.from('profiles').select('church_id').eq('id', user?.id).single();
    if (currentProfile) {
      setChurchId(currentProfile.church_id);
      const [yearRes, periodRes, catRes] = await Promise.all([
        supabase.from('financial_years').select('*').eq('church_id', currentProfile.church_id).order('year', { ascending: false }),
        supabase.from('financial_periods').select('*').eq('church_id', currentProfile.church_id).order('month', { ascending: true }),
        supabase.from('categories').select('*').eq('church_id', currentProfile.church_id).order('sort_order')
      ]);

      if (catRes.data) setCategories(catRes.data);
      if (periodRes.data) {
        setPeriods(periodRes.data);
        if (periodRes.data.length > 0) setSelectedResetPeriod(periodRes.data[0].id);
      }
      if (yearRes.data) {
        setYears(yearRes.data);
        if (yearRes.data.length > 0) {
           setSelectedBudgetYear(yearRes.data[0].id);
           const targets = yearRes.data[0].category_targets || {};
           setCategoryTargets(targets);
           
           const disp: Record<string, string> = {};
           Object.keys(targets).forEach(k => {
             if(targets[k]) disp[k] = targets[k].toLocaleString('en-US');
           });
           setDisplayTargets(disp);
        }
        const nextAvailableYear = yearRes.data.length > 0 ? Math.max(...yearRes.data.map(y => y.year)) + 1 : new Date().getFullYear();
        setNewYear(prev => ({ ...prev, year: nextAvailableYear }));
      }
    }
  };

  const handleAddYear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newYear.year) return;
    const { data: yearData, error } = await supabase.from('financial_years').insert({ church_id: churchId, year: newYear.year, approved_budget: parseFloat(newYear.budget) || 0, category_targets: {} }).select().single();
    if (error) { setNotification({ isOpen: true, type: 'ERROR', title: 'Initialization Failed', message: error.message }); return; }

    if (yearData) {
      const periodsToInsert = Array.from({ length: 12 }, (_, i) => {
        const date = new Date(yearData.year, i, 1);
        const monthName = date.toLocaleString('default', { month: 'long' });
        return { church_id: churchId, financial_year_id: yearData.id, month: i + 1, period_name: `${monthName} ${yearData.year}`, status: 'OPEN' };
      });
      await supabase.from('financial_periods').insert(periodsToInsert);
    }
    setIsAddingYear(false);
    setNotification({ isOpen: true, type: 'SUCCESS', title: 'Financial Year Created', message: `Generated 12 monthly periods for ${newYear.year}.` });
    fetchSetupData();
  };

  const handleSaveYearBudget = async (yearId: string) => {
    const parsedBudget = parseFloat(editBudgetAmount) || 0;
    const { error } = await supabase.from('financial_years').update({ approved_budget: parsedBudget }).eq('id', yearId);
    if (error) { setNotification({ isOpen: true, type: 'ERROR', title: 'Update Failed', message: error.message }); return; }
    
    setEditingYearId(null);
    setNotification({ isOpen: true, type: 'SUCCESS', title: 'Budget Updated', message: 'The base approved budget for this year has been saved.' });
    fetchSetupData();
  };

  const handleSaveBudgetTargets = async () => {
    if (!selectedBudgetYear) return;
    setSavingTargets(true);
    try {
      const cleanTargets: Record<string, number> = {};
      Object.keys(categoryTargets).forEach(key => {
         if (categoryTargets[key] > 0) cleanTargets[key] = categoryTargets[key];
      });
      const { error } = await supabase.from('financial_years').update({ category_targets: cleanTargets }).eq('id', selectedBudgetYear);
      if (error) throw error;
      setNotification({ isOpen: true, type: 'SUCCESS', title: 'Targets Synced', message: 'Category budget targets successfully mapped!' });
    } catch (err: any) {
      setNotification({ isOpen: true, type: 'ERROR', title: 'Sync Failed', message: err.message });
    } finally {
      setSavingTargets(false);
    }
  };

  // Masking Implementation
  const handleTargetChange = (catId: string, val: string) => {
    const raw = val.replace(/[^0-9.]/g, '');
    const parts = raw.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    if (parts.length > 2) parts.pop();
    const masked = parts.join('.');
    
    setDisplayTargets(prev => ({...prev, [catId]: masked}));
    setCategoryTargets(prev => ({ ...prev, [catId]: parseFloat(raw) || 0 }));
  };

  const handleResetPeriod = async () => {
    if (resetConfirmation !== 'RESET') { setNotification({ isOpen: true, type: 'WARNING', title: 'Confirmation Required', message: "Type 'RESET' to confirm data wipe." }); return; }
    if (!selectedResetPeriod) return;
    setResetting(true);
    const { error } = await supabase.rpc('reset_period_transactions', { p_period_id: selectedResetPeriod, p_church_id: churchId });
    setResetting(false);
    
    if (error) setNotification({ isOpen: true, type: 'ERROR', title: 'Wipe Failed', message: error.message });
    else {
      setResetConfirmation('');
      setNotification({ isOpen: true, type: 'SUCCESS', title: 'Period Reset Complete', message: 'Transactions and reconciliation wiped.' });
    }
  };

  if (loading) return <div className="p-12 text-center text-slate-500 font-medium text-xs">Loading financial configuration...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-300 relative">
      
      {notification?.isOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#27272A] rounded-3xl p-8 shadow-2xl space-y-6 text-center animate-modal">
            {notification.type === 'SUCCESS' && <div className="mx-auto h-16 w-16 bg-emerald-100 dark:bg-emerald-950/60 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 animate-bounce"><CheckCircle2 className="h-8 w-8" /></div>}
            {notification.type === 'ERROR' && <div className="mx-auto h-16 w-16 bg-red-100 dark:bg-red-950/60 rounded-2xl flex items-center justify-center text-red-600 dark:text-red-400 animate-bounce"><X className="h-8 w-8" /></div>}
            {notification.type === 'WARNING' && <div className="mx-auto h-16 w-16 bg-amber-100 dark:bg-amber-950/60 rounded-2xl flex items-center justify-center text-amber-600 dark:text-amber-400 animate-bounce"><AlertTriangle className="h-8 w-8" /></div>}
            
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{notification.title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{notification.message}</p>
            </div>
            
            <button onClick={() => setNotification(null)} className={`w-full py-3 text-white rounded-xl text-xs font-bold shadow-md transition-all ${notification.type === 'SUCCESS' ? 'bg-brand dark:bg-emerald-700 hover:bg-brand-dark' : notification.type === 'ERROR' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}`}>Acknowledge</button>
          </div>
        </div>, document.body
      )}

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
          <ShieldCheck className="h-7 w-7 text-brand dark:text-emerald-500" /> Financial Setup
        </h1>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">Configure years, category target tracking, base budgets, and data maintenance.</p>
      </div>

      <div className="grid grid-cols-3 gap-1.5 p-1.5 bg-slate-200/70 dark:bg-slate-900/80 rounded-xl w-full max-w-lg border border-slate-300 dark:border-slate-800 shadow-inner">
        <button onClick={() => setActiveTab('YEARS')} className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] sm:text-xs font-bold transition-all truncate ${activeTab === 'YEARS' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'}`}><Calendar className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">System Years</span></button>
        <button onClick={() => setActiveTab('BUDGET')} className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] sm:text-xs font-bold transition-all truncate ${activeTab === 'BUDGET' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'}`}><Target className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">Budget Targets</span></button>
        <button onClick={() => setActiveTab('RESET')} className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] sm:text-xs font-bold transition-all truncate ${activeTab === 'RESET' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'}`}><Trash2 className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">Data Reset</span></button>
      </div>

      {activeTab === 'YEARS' && (
        <div className="bento-card space-y-6 bg-white dark:bg-[#121212]">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Financial Years Configuration</h3>
              <p className="text-xs text-slate-500 mt-0.5">Initializing a new year automatically provisions its 12 monthly reporting periods.</p>
            </div>
            {!isAddingYear && (
              <button onClick={() => setIsAddingYear(true)} className="flex items-center gap-2 bg-brand dark:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm"><Plus className="h-4 w-4" /> Initialize New Year</button>
            )}
          </div>

          {isAddingYear && (
            <form onSubmit={handleAddYear} className="bg-slate-50/50 dark:bg-[#1A1A1A] p-4 rounded-xl border border-slate-200 dark:border-[#27272A] flex flex-wrap items-end gap-4 animate-in fade-in">
              <div className="space-y-1.5 flex-1 min-w-[150px]">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">Year</label>
                <input type="number" required className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#121212] px-3.5 py-2.5 text-xs font-medium text-slate-900 dark:text-white focus:border-brand" value={newYear.year} onChange={e => setNewYear({...newYear, year: parseInt(e.target.value)})} />
              </div>
              <div className="space-y-1.5 flex-1 min-w-[150px]">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">Approved Base Budget</label>
                <input type="number" step="0.01" required className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#121212] px-3.5 py-2.5 text-xs font-medium text-slate-900 dark:text-white focus:border-brand" value={newYear.budget} onChange={e => setNewYear({...newYear, budget: e.target.value})} />
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <button type="button" onClick={() => setIsAddingYear(false)} className="px-4 py-2.5 text-xs font-bold text-slate-600 bg-white dark:bg-[#121212] border border-slate-200 dark:border-slate-700 rounded-xl">Cancel</button>
                <button type="submit" className="px-5 py-2.5 text-xs font-bold text-white bg-brand dark:bg-emerald-700 rounded-xl shadow-sm hover:bg-brand-dark transition-colors">Save Year</button>
              </div>
            </form>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-[#27272A] custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-transparent border-b border-slate-200 dark:border-[#27272A] text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="p-4">Financial Year</th>
                  <th className="p-4">Base Approved Budget</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#27272A]/50 bg-transparent">
                {years.map(y => (
                  <tr key={y.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="p-4 font-semibold text-slate-900 dark:text-white">{y.year}</td>
                    <td className="p-4 font-mono font-medium text-slate-700 dark:text-slate-300">
                      {editingYearId === y.id ? (
                        <input type="number" step="0.01" autoFocus className="w-full max-w-[150px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-900 dark:text-white focus:border-brand" value={editBudgetAmount} onChange={(e) => setEditBudgetAmount(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSaveYearBudget(y.id)} />
                      ) : (
                        `₱${Number(y.approved_budget).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                      )}
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide border border-slate-200 dark:border-[#27272A] bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 uppercase">
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${y.is_closed ? 'bg-slate-400' : 'bg-emerald-500'}`}></span>
                        {y.is_closed ? 'Closed' : 'Active'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {editingYearId === y.id ? (
                        <div className="inline-flex items-center justify-end gap-1">
                          <button onClick={() => setEditingYearId(null)} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-lg"><X className="h-4 w-4" /></button>
                          <button onClick={() => handleSaveYearBudget(y.id)} className="p-1.5 text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"><Check className="h-4 w-4" /></button>
                        </div>
                      ) : (
                        <button onClick={() => { setEditingYearId(y.id); setEditBudgetAmount(y.approved_budget.toString()); }} className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors" title="Edit Budget">
                          <Edit2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Edit Budget</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'BUDGET' && (
        <div className="bento-card space-y-6 bg-white dark:bg-[#121212]">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Category Budget Tracking</h3>
              <p className="text-xs text-slate-500 mt-0.5">Assign target amounts to categories. Tracked live on the Dashboard.</p>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <select 
                className="w-full sm:w-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-2.5 text-xs font-bold text-slate-900 dark:text-white shadow-sm focus:border-brand"
                value={selectedBudgetYear}
                onChange={(e) => {
                  setSelectedBudgetYear(e.target.value);
                  const yr = years.find(y => y.id === e.target.value);
                  const targets = yr?.category_targets || {};
                  setCategoryTargets(targets);
                  const disp: Record<string, string> = {};
                  Object.keys(targets).forEach(k => { if(targets[k]) disp[k] = targets[k].toLocaleString('en-US'); });
                  setDisplayTargets(disp);
                }}
              >
                {years.map(y => <option key={y.id} value={y.id}>Year {y.year}</option>)}
              </select>
              <button onClick={handleSaveBudgetTargets} disabled={savingTargets || !selectedBudgetYear} className="flex items-center justify-center gap-2 bg-brand dark:bg-emerald-700 hover:bg-brand-dark text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm shrink-0 transition-colors">
                {savingTargets ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Save Targets
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg w-full sm:w-fit border border-slate-200 dark:border-slate-800">
              <button onClick={() => setBudgetTab('INCOME')} className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-[10px] uppercase tracking-wider font-bold transition-all ${budgetTab === 'INCOME' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-800'}`}>Income</button>
              <button onClick={() => setBudgetTab('EXPENSE')} className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-[10px] uppercase tracking-wider font-bold transition-all ${budgetTab === 'EXPENSE' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-800'}`}>Expense</button>
            </div>
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
              <input type="text" placeholder="Search categories..." className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#1A1A1A] text-xs font-medium text-slate-900 dark:text-white focus:border-brand" value={budgetSearch} onChange={(e) => setBudgetSearch(e.target.value)} />
            </div>
          </div>

          <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-white dark:bg-[#121212] z-10 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-4 w-32">Account Code</th>
                  <th className="p-4">Category Name</th>
                  <th className="p-4 w-48 text-right">Target Amount (₱)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#27272A]/50">
                {categories.filter(c => c.type === budgetTab && (c.name.toLowerCase().includes(budgetSearch.toLowerCase()) || c.export_code.includes(budgetSearch))).map(c => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="p-4 font-mono font-medium text-slate-700 dark:text-slate-300">{c.export_code}</td>
                    <td className="p-4 font-semibold text-slate-900 dark:text-white">{c.name}</td>
                    <td className="p-4 text-right">
                      <input 
                        type="text" placeholder="0.00"
                        className="w-full text-right rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:border-brand"
                        value={displayTargets[c.id] || ''}
                        onChange={(e) => handleTargetChange(c.id, e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'RESET' && (
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
              <select className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#121212] px-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-white shadow-sm focus:border-red-500" value={selectedResetPeriod} onChange={(e) => setSelectedResetPeriod(e.target.value)}>
                {periods.map(p => <option key={p.id} value={p.id}>{p.period_name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">Type "RESET" to Confirm</label>
              <input type="text" placeholder="Type RESET here" className="w-full rounded-xl border border-red-200 dark:border-red-900/50 bg-white dark:bg-[#121212] px-3.5 py-2.5 text-xs font-bold text-red-900 dark:text-red-300 shadow-sm focus:border-red-500" value={resetConfirmation} onChange={(e) => setResetConfirmation(e.target.value)} />
            </div>
            <div className="flex items-end">
              <button onClick={handleResetPeriod} disabled={resetting || resetConfirmation !== 'RESET'} className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-all">
                <Trash2 className="h-4 w-4" /> {resetting ? 'Wiping Data...' : 'Reset Period Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}