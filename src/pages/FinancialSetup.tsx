import { SetupIcon as Target, MissionIcon as ShieldCheck } from '../components/ui/StewardGlyph';
import DialogLayer from '../components/ui/DialogLayer';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, Trash2, Plus, CheckCircle2, AlertTriangle, Loader2, Edit2, Check, X, Search } from 'lucide-react';
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
        <DialogLayer label="Financial Setup" className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/75 dark:bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="dialog-surface w-full max-w-md bg-white dark:bg-dark-surface border border-slate-200 dark:border-dark-border rounded-2xl p-8 shadow-2xl space-y-6 text-center animate-in zoom-in-95 duration-300">
            {notification.type === 'SUCCESS' && <div className="mx-auto h-16 w-16 bg-sky-50 dark:bg-sky-500/15 border border-sky-200 dark:border-sky-500/20 rounded-2xl flex items-center justify-center editor-accent animate-bounce"><CheckCircle2 className="h-8 w-8" /></div>}
            {notification.type === 'ERROR' && <div className="mx-auto h-16 w-16 bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/20 rounded-2xl flex items-center justify-center text-rose-600 dark:text-rose-400 animate-bounce"><X className="h-8 w-8" /></div>}
            {notification.type === 'WARNING' && <div className="mx-auto h-16 w-16 bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/20 rounded-2xl flex items-center justify-center text-amber-600 dark:text-amber-400 animate-bounce"><AlertTriangle className="h-8 w-8" /></div>}
            
            <div className="space-y-1">
              <h3 className="text-base font-bold tracking-normal text-slate-900 dark:text-white">{notification.title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{notification.message}</p>
            </div>
            
            <button onClick={() => setNotification(null)} className={`w-full py-3 text-white rounded-xl text-xs font-bold shadow-md transition-all ${notification.type === 'SUCCESS' ? 'bg-brand hover:bg-brand-dark' : notification.type === 'ERROR' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-amber-600 hover:bg-amber-700'}`}>Acknowledge</button>
          </div>
        </DialogLayer>, document.body
      )}

      <div>
        <h1 className="system-page-title text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
          <ShieldCheck className="h-7 w-7 editor-accent" /> Financial Setup
        </h1>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">Configure years, category target tracking, base budgets, and data maintenance.</p>
      </div>

      <div className="switch-tabs system-switch-tabs">
        <button aria-pressed={activeTab === 'YEARS'} onClick={() => setActiveTab('YEARS')} className="switch-tab"><Calendar className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">Financial years</span></button>
        <button aria-pressed={activeTab === 'BUDGET'} onClick={() => setActiveTab('BUDGET')} className="switch-tab"><Target className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">Budget Targets</span></button>
        <button aria-pressed={activeTab === 'RESET'} onClick={() => setActiveTab('RESET')} className="switch-tab"><Trash2 className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">Data Reset</span></button>
      </div>

      {activeTab === 'YEARS' && (
        <div className="tab-panel setup-panel">
          <div className="setup-panel-heading">
            <div>
              <h3 className="text-sm font-bold tracking-normal text-slate-900 dark:text-white">Financial years</h3>
              <p className="text-xs text-slate-500 mt-0.5">Initializing a new year automatically provisions its 12 monthly reporting periods.</p>
            </div>
            {!isAddingYear && (
              <button onClick={() => setIsAddingYear(true)} className="flex items-center gap-2 bg-brand hover:bg-brand-dark text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-all"><Plus className="h-4 w-4" /> Initialize New Year</button>
            )}
          </div>

          {isAddingYear && (
            <form onSubmit={handleAddYear} className="bg-slate-50 dark:bg-dark-elevated p-4 rounded-xl border border-slate-200 dark:border-dark-border flex flex-wrap items-end gap-4 animate-in fade-in">
              <div className="space-y-1.5 flex-1 min-w-[150px]">
                <label className="block text-xs font-bold text-slate-500 tracking-normal">Year</label>
                <Input aria-label="Year" type="number" required className="w-full rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-surface px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:border-sky-500 outline-none" value={newYear.year} onChange={e => setNewYear({...newYear, year: parseInt(e.target.value)})} />
              </div>
              <div className="space-y-1.5 flex-1 min-w-[150px]">
                <label className="block text-xs font-bold text-slate-500 tracking-normal">Approved Base Budget</label>
                <Input aria-label="Approved Base Budget" type="number" step="0.01" required className="w-full rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-surface px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:border-sky-500 outline-none" value={newYear.budget} onChange={e => setNewYear({...newYear, budget: e.target.value})} />
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <button type="button" onClick={() => setIsAddingYear(false)} className="px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-dark-surface border border-slate-200 dark:border-dark-border rounded-xl">Cancel</button>
                <button type="submit" className="px-5 py-2.5 text-xs font-bold text-white bg-brand hover:bg-brand-dark rounded-xl shadow-sm transition-colors">Save Year</button>
              </div>
            </form>
          )}

          <div className="setup-table-scroll custom-scrollbar">
            <table className="ui-data-table setup-years-table">
              <caption className="sr-only">Financial years and approved base budgets</caption><thead>
                <tr className="bg-transparent border-b border-slate-200 dark:border-dark-border text-slate-500 font-semibold tracking-normal text-xs">
                  <th className="p-4">Financial Year</th>
                  <th className="p-4">Base Approved Budget</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-dark-border/50 bg-transparent">
                {years.map(y => (
                  <tr key={y.id} className="hover:bg-slate-50 dark:hover:bg-dark-elevated transition-colors">
                    <td data-label="Financial year" className="setup-year"><Calendar size={18}/><strong>{y.year}</strong></td>
                    <td data-label="Approved base budget" className="setup-base-budget">
                      {editingYearId === y.id ? (
                        <Input aria-label="Enter value" type="number" step="0.01" autoFocus className="w-full max-w-[150px] rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-surface px-3 py-1.5 text-xs font-bold text-slate-900 dark:text-white focus:border-sky-500 outline-none" value={editBudgetAmount} onChange={(e) => setEditBudgetAmount(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSaveYearBudget(y.id)} />
                      ) : (
                        y.approved_budget != null && Number.isFinite(Number(y.approved_budget)) ? new Intl.NumberFormat('en-PH', {style:'currency',currency:'PHP'}).format(Number(y.approved_budget)) : 'Not set'
                      )}
                    </td>
                    <td data-label="Status">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold tracking-wide border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-elevated text-slate-700 dark:text-slate-300 uppercase">
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${y.is_closed ? 'bg-slate-400' : 'bg-sky-500'}`}></span>
                        {y.is_closed ? 'Closed' : 'Active'}
                      </span>
                    </td>
                    <td className="setup-year-actions" data-label="Actions">
                      {editingYearId === y.id ? (
                        <div className="inline-flex items-center justify-end gap-1">
                          <button type="button" aria-label="Cancel budget edit" onClick={() => setEditingYearId(null)} className="icon-button p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-dark-floating rounded-lg border border-slate-200 dark:border-dark-borderStrong"><X className="h-4 w-4" /></button>
                          <button aria-label="Save base budget" onClick={() => handleSaveYearBudget(y.id)} className="p-1.5 text-white bg-brand hover:bg-brand-dark rounded-lg"><Check className="h-4 w-4" /></button>
                        </div>
                      ) : (
                        <button onClick={() => { setEditingYearId(y.id); setEditBudgetAmount((y.approved_budget ?? '').toString()); }} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold tracking-normal text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-floating hover:text-slate-900 dark:hover:text-white transition-colors" aria-label={`Edit budget for ${y.year}`} title="Edit Budget">
                          <Edit2 className="h-3.5 w-3.5" /> <span>Edit budget</span>
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
        <div className="tab-panel setup-panel">
          <div className="setup-panel-heading">
            <div>
              <h3 className="text-sm font-bold tracking-normal text-slate-900 dark:text-white">Category budget targets</h3>
              <p className="text-xs text-slate-500 mt-0.5">Set annual targets by account. Progress appears on the dashboard.</p>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Select aria-label="Financial year"
                className="w-full sm:w-auto rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-elevated px-4 py-2.5 text-xs font-bold text-slate-900 dark:text-white shadow-sm focus:border-sky-500 outline-none"
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
              </Select>
              <button onClick={handleSaveBudgetTargets} aria-busy={savingTargets} disabled={savingTargets || !selectedBudgetYear} className="flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm shrink-0 transition-colors">
                {savingTargets ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Save Targets
              </button>
            </div>
          </div>

          <div className="setup-budget-toolbar">
            <div className="switch-tabs setup-type-tabs">
              <button aria-pressed={budgetTab === 'INCOME'} onClick={() => setBudgetTab('INCOME')} className="switch-tab">Income</button>
              <button aria-pressed={budgetTab === 'EXPENSE'} onClick={() => setBudgetTab('EXPENSE')} className="switch-tab">Expense</button>
            </div>
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
              <Input aria-label="Search categories..." type="text" placeholder="Search categories..." className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-elevated text-xs font-medium text-slate-900 dark:text-white focus:border-sky-500 outline-none" value={budgetSearch} onChange={(e) => setBudgetSearch(e.target.value)} />
            </div>
          </div>

          <div className="setup-targets-scroll setup-table-scroll custom-scrollbar">
            <table className="ui-data-table setup-targets-table">
              <thead className="sticky top-0 bg-white dark:bg-dark-elevated z-10 border-b border-slate-200 dark:border-dark-border text-slate-500 font-semibold tracking-normal text-xs">
                <tr>
                  <th>Account number</th>
                  <th>Account name</th>
                  <th className="text-right">Annual target (PHP)</th>
                </tr>
              </thead>
              <tbody key={budgetTab} className="tab-panel">
                {categories.filter(c => c.type === budgetTab && (c.name.toLowerCase().includes(budgetSearch.toLowerCase()) || c.export_code.includes(budgetSearch))).map(c => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-dark-elevated transition-colors">
                    <td data-label="Account number"><span className="setup-account-code">{c.export_code}</span></td>
                    <td data-label="Account name" className="setup-account-name">{c.name}</td>
                    <td data-label="Annual target" className="setup-target-amount">
                      <Input aria-label={`Annual target for ${c.name}`}
                        type="text" placeholder="0.00"
                        className="w-full text-right rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-surface px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:border-sky-500 outline-none"
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
        <div className="tab-panel setup-panel setup-reset-panel">

          <div className="setup-reset-heading">
            <div className="p-2.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-normal text-slate-900 dark:text-white">Reset period transactions</h3>
              <p className="text-xs text-slate-500 mt-0.5">Permanently wipe transactions and reconciliation records for a specific month/year.</p>
            </div>
          </div>

          <div className="setup-reset-fields">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 tracking-normal">Select Period to Reset</label>
              <Select aria-label="Select Period to Reset" className="w-full rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-elevated px-4 py-3 text-xs font-bold text-slate-900 dark:text-white shadow-sm focus:border-rose-500 outline-none" value={selectedResetPeriod} onChange={(e) => setSelectedResetPeriod(e.target.value)}>
                {periods.map(p => <option key={p.id} value={p.id}>{p.period_name}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 tracking-normal">Type "RESET" to Confirm</label>
              <Input aria-label={'Type "RESET" to confirm'} type="text" placeholder="Type RESET here" className="w-full rounded-xl border border-rose-200 dark:border-rose-900/50 bg-white dark:bg-dark-elevated px-4 py-3 text-xs font-bold text-rose-900 dark:text-rose-300 shadow-sm focus:border-rose-500 outline-none" value={resetConfirmation} onChange={(e) => setResetConfirmation(e.target.value)} />
            </div>
            <div className="flex items-end">
              <button onClick={handleResetPeriod} disabled={resetting || resetConfirmation !== 'RESET'} className="w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-100 dark:disabled:bg-dark-elevated disabled:text-slate-400 text-white px-4 py-3 rounded-xl text-xs font-bold shadow-sm transition-all border border-transparent dark:border-dark-border">
                <Trash2 className="h-4 w-4" /> {resetting ? 'Wiping Data...' : 'Reset Period Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
