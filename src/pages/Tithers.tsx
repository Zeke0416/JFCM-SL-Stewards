import { useFeedback } from '../components/ui/useFeedback';
import Select from '../components/ui/Select';
import Input from '../components/ui/Input';
import DialogLayer from '../components/ui/DialogLayer';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle2, AlertTriangle, Calendar, Search, Trash2, UserPlus, Loader2 } from 'lucide-react';
import type { Tither, FinancialPeriod } from '../types/database.types';

let tithersMemoryCache: any = null;

export default function Tithers() {
  const { notify } = useFeedback();
  const { user } = useAuth();
  const [churchId, setChurchId] = useState(tithersMemoryCache?.churchId || '');
  const [loading, setLoading] = useState(!tithersMemoryCache);
  
  const [tithers, setTithers] = useState<Tither[]>(tithersMemoryCache?.tithers || []);
  const [periods, setPeriods] = useState<FinancialPeriod[]>(tithersMemoryCache?.periods || []);
  const [selectedPeriod, setSelectedPeriod] = useState(tithersMemoryCache?.selectedPeriod || '');
  const [transactions, setTransactions] = useState<any[]>(tithersMemoryCache?.transactions || []);

  const [newTitherName, setNewTitherName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [deleteParams, setDeleteParams] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchInitialData();
  }, [user]);

  const fetchInitialData = async () => {
    if (!tithersMemoryCache) setLoading(true);
    try {
      const { data: profile } = await supabase.from('profiles').select('church_id').eq('id', user?.id).maybeSingle();
      if (profile) {
        setChurchId(profile.church_id);
        const [tithersRes, periodsRes] = await Promise.all([
          supabase.from('tithers').select('*').eq('church_id', profile.church_id).order('full_name'),
          supabase.from('financial_periods').select('*').eq('church_id', profile.church_id).order('month', { ascending: false })
        ]);

        if (tithersRes.data) setTithers(tithersRes.data);
        if (periodsRes.data && periodsRes.data.length > 0) {
          setPeriods(periodsRes.data);
          
          // Smart deadline rule
          const now = new Date();
          const currentMonthNum = now.getMonth() + 1;
          const todayDate = now.getDate();
          const deadlineDay = parseInt(localStorage.getItem('mpr_deadline_day') || '14', 10);
          
          let targetMonth = currentMonthNum;
          if (todayDate < deadlineDay) {
            targetMonth = currentMonthNum - 1;
            if (targetMonth === 0) targetMonth = 12;
          }

          const smartPeriod = periodsRes.data.find(p => p.month === targetMonth) || periodsRes.data.find(p => p.status === 'OPEN') || periodsRes.data[0];
          
          const defaultPeriod = selectedPeriod || smartPeriod.id;
          setSelectedPeriod(defaultPeriod);
          
          // Added explicit || [] fallback to prevent TypeScript null assignment errors
          await fetchTransactions(defaultPeriod, profile.church_id, tithersRes.data || [], periodsRes.data || []);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Added explicit types for currentTithers and currentPeriods to fix TS inference
  const fetchTransactions = async (periodId: string, cId: string, currentTithers: Tither[] = tithers, currentPeriods: FinancialPeriod[] = periods) => {
    const { data: catData } = await supabase.from('categories').select('id').eq('church_id', cId).in('export_code', ['5011', '5015']);
    const titheCatIds = (catData || []).map(c => c.id);
    
    let txsData: any[] = [];
    if (titheCatIds.length > 0) {
      const { data: txs } = await supabase.from('transactions').select('payee_name, remarks, amount').eq('financial_period_id', periodId).in('category_id', titheCatIds);
      if (txs) {
        setTransactions(txs);
        txsData = txs;
      }
    }

    tithersMemoryCache = {
      churchId: cId,
      tithers: currentTithers,
      periods: currentPeriods,
      selectedPeriod: periodId,
      transactions: txsData
    };
  };

  const handlePeriodChange = (val: string) => {
    setSelectedPeriod(val);
    localStorage.setItem('tither_period', val);
    fetchTransactions(val, churchId);
  };

  const toTitleCase = (str: string) => {
    return str.toLowerCase().replace(/(?:^|\s)\S/g, (char) => char.toUpperCase());
  };

  const handleAddTither = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitherName.trim()) return;
    setIsAdding(true);

    const formattedName = toTitleCase(newTitherName.trim());

    await supabase.from('tithers').insert({ church_id: churchId, full_name: formattedName });
    
    setNewTitherName('');
    setIsAdding(false);
    tithersMemoryCache = null; // invalidate cache
    showSuccess(`Successfully registered ${formattedName} to the directory.`);
    fetchInitialData();
  };

  const handleDeletePrompt = (id: string, name: string) => {
    setDeleteParams({ id, name });
  };

  const confirmDelete = async () => {
    if (!deleteParams) return;
    setIsDeleting(true);
    try {
      await supabase.from('tithers').delete().eq('id', deleteParams.id);
      tithersMemoryCache = null; // invalidate cache
      showSuccess(`Successfully removed ${deleteParams.name} from the directory.`);
      fetchInitialData();
    } catch (err: any) {
      notify("Failed to remove member: " + err.message);
    } finally {
      setIsDeleting(false);
      setDeleteParams(null);
    }
  };

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => {
      setSuccessMessage(null);
    }, 2000); 
  };

  const analysis = useMemo(() => {
    const fulfilled: {tither: Tither, txs: any[]}[] = [];
    const missing: Tither[] = [];
    const activeTithers = tithers.filter(t => t.is_active && t.full_name.toLowerCase().includes(searchQuery.toLowerCase()));

    activeTithers.forEach(tither => {
      const nameMatch = tither.full_name.toLowerCase();
      const matchingTxs = transactions.filter(tx => 
        (tx.payee_name && tx.payee_name.toLowerCase().includes(nameMatch)) || 
        (tx.remarks && tx.remarks.toLowerCase().includes(nameMatch))
      );

      if (matchingTxs.length > 0) fulfilled.push({ tither, txs: matchingTxs });
      else missing.push(tither);
    });

    return { fulfilled, missing };
  }, [tithers, transactions, searchQuery]);

  if (loading && !tithersMemoryCache) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-slate-200 dark:bg-dark-floating rounded-xl w-1/3 sm:w-1/4"></div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
           <div className="tither-directory lg:col-span-4 h-96 bg-slate-200 dark:bg-dark-elevated rounded-2xl border border-slate-200 dark:border-dark-border"></div>
           <div className="lg:col-span-8 h-96 bg-slate-200 dark:bg-dark-elevated rounded-2xl border border-slate-200 dark:border-dark-border"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 dark:border-dark-border pb-4">
        <div>
          <h1 className="system-page-title text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Church Tithers</h1>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">Review monthly contributions and organize member follow-up.</p>
        </div>
        <div className="flex items-center gap-2 bg-white dark:bg-dark-surface p-1.5 rounded-2xl border border-slate-200 dark:border-dark-border shadow-sm shrink-0 min-w-[220px] relative">
          <Calendar className="h-4 w-4 text-slate-400 ml-2 shrink-0" />
          <Select aria-label="Financial period"
            value={selectedPeriod} 
            onChange={(e) => handlePeriodChange(e.target.value)} 
            className="w-full bg-transparent dark:bg-dark-surface border-none text-xs font-bold focus:ring-0 text-slate-900 dark:text-white pr-8 py-1.5 cursor-pointer outline-none appearance-none"
          >
            {periods.map(p => (
              <option key={p.id} value={p.id} className="bg-white dark:bg-dark-surface text-slate-900 dark:text-white">
                {p.period_name}
              </option>
            ))}
          </Select>

        </div>
      </div>

      <div className="tithers-workspace">
        <section className="tither-panel tither-directory"><header><h3>Member directory</h3><p>Manage registered tithers.</p></header><div className="directory-controls"><form onSubmit={handleAddTither}><Input aria-label="Add new member..." placeholder="Add new member…" required value={newTitherName} onChange={e=>setNewTitherName(e.target.value)}/><button className="button-primary" aria-label="Add member" type="submit" aria-busy={isAdding} disabled={isAdding}>{isAdding?<Loader2 size={17} className="animate-spin"/>:<UserPlus size={17}/>}</button></form><div className="ledger-search"><Search size={16}/><Input aria-label="Search directory..." placeholder="Search directory…" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}/></div></div>
          <div className="tither-list">{tithers.filter(t=>t.full_name.toLowerCase().includes(searchQuery.toLowerCase())).map(tither=><div className="tither-member" key={tither.id}><span>{tither.full_name}</span><button className="icon-button danger" aria-label={`Remove ${tither.full_name} from directory`} onClick={()=>handleDeletePrompt(tither.id,tither.full_name)}><Trash2 size={15}/></button></div>)}{!tithers.length&&<div className="empty-panel">Add a member to start the directory.</div>}{!!tithers.length&&!tithers.some(t=>t.full_name.toLowerCase().includes(searchQuery.toLowerCase()))&&<div className="empty-panel">No members match this search.</div>}</div>
        </section>
        <div className="tither-review"><div className="tither-stats"><article><div><span>Members with records</span><strong>{analysis.fulfilled.length}</strong></div><CheckCircle2 size={23}/></article><article><div><span>For follow-up</span><strong>{analysis.missing.length}</strong></div><AlertTriangle size={23}/></article></div><div className="tither-status-columns">
          <section className="tither-panel"><header><CheckCircle2 size={17}/><h3>Recorded tithes</h3><span>{analysis.fulfilled.length}</span></header><div className="tither-list">{analysis.fulfilled.map(({tither,txs})=><div className="tither-member recorded" key={tither.id}><div><strong>{tither.full_name}</strong><p>{txs.length} {txs.length===1?'entry':'entries'} this month</p></div><CheckCircle2 size={16}/></div>)}{!analysis.fulfilled.length&&<div className="empty-panel">No matching tithe records for this period.</div>}</div></section>
          <section className="tither-panel"><header><AlertTriangle size={17}/><h3>For follow-up</h3><span>{analysis.missing.length}</span></header><div className="tither-list">{analysis.missing.map(tither=><div className="tither-member follow-up" key={tither.id}><span>{tither.full_name}</span><span className="follow-up-marker" aria-label="For follow-up"/></div>)}{!analysis.missing.length&&<div className="empty-panel">No members to follow up in this view.</div>}</div></section>
        </div></div>
      </div>

      {successMessage && (
        <DialogLayer label="Success" className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/75 dark:bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="dialog-surface bg-white dark:bg-dark-surface rounded-2xl shadow-2xl border border-slate-200 dark:border-dark-border w-full max-w-sm p-8 flex flex-col items-center text-center animate-in zoom-in-95 duration-300">
            <div className="p-4 bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/20 rounded-2xl mb-4 editor-accent animate-bounce">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="text-base font-bold tracking-normal text-slate-900 dark:text-white">Success</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              {successMessage}
            </p>
          </div>
        </DialogLayer>
      )}

      {deleteParams && (
        <DialogLayer label="Remove Member" className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/75 dark:bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="dialog-surface bg-white dark:bg-dark-surface rounded-2xl shadow-2xl border border-slate-200 dark:border-dark-border w-full max-w-md p-6 animate-in zoom-in-95 duration-300">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl text-rose-600 dark:text-rose-400 shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Remove Member</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                  Are you sure you want to permanently remove <strong className="text-slate-700 dark:text-slate-300">"{deleteParams.name}"</strong> from the official directory? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="dialog-footer flex justify-end gap-3 border-t border-slate-200 dark:border-dark-border pt-4">
              <button onClick={() => setDeleteParams(null)} disabled={isDeleting} className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-floating transition-colors border border-slate-200 dark:border-dark-border">
                Cancel
              </button>
              <button onClick={confirmDelete} aria-busy={isDeleting} disabled={isDeleting} className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center gap-2">
                {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isDeleting ? 'Removing...' : 'Yes, Remove'}
              </button>
            </div>
          </div>
        </DialogLayer>
      )}
    </div>
  );
}
