import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle2, AlertTriangle, Calendar, Search, Trash2, UserPlus, Loader2, ChevronDown } from 'lucide-react';
import type { Tither, FinancialPeriod } from '../types/database.types';

let tithersMemoryCache: any = null;

export default function Tithers() {
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
      alert("Failed to remove member: " + err.message);
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
        <div className="h-10 bg-slate-200 dark:bg-[#1a1a1a] rounded-xl w-1/3 sm:w-1/4"></div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
           <div className="lg:col-span-4 h-96 bg-slate-200 dark:bg-[#121212] rounded-2xl border border-slate-200 dark:border-[#27272A]"></div>
           <div className="lg:col-span-8 h-96 bg-slate-200 dark:bg-[#121212] rounded-2xl border border-slate-200 dark:border-[#27272A]"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 dark:border-[#27272A] pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Church Tithers</h1>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">Track monthly tithe compliance across your official church registry.</p>
        </div>
        <div className="flex items-center gap-2 bg-white dark:bg-[#0A0A0A] p-1.5 rounded-2xl border border-slate-200 dark:border-[#27272A] shadow-sm shrink-0 min-w-[220px] relative">
          <Calendar className="h-4 w-4 text-slate-400 ml-2 shrink-0" />
          <select 
            value={selectedPeriod} 
            onChange={(e) => handlePeriodChange(e.target.value)} 
            className="w-full bg-transparent dark:bg-[#0A0A0A] border-none text-xs font-bold focus:ring-0 text-slate-900 dark:text-white pr-8 py-1.5 cursor-pointer outline-none appearance-none"
          >
            {periods.map(p => (
              <option key={p.id} value={p.id} className="bg-white dark:bg-[#0A0A0A] text-slate-900 dark:text-white">
                {p.period_name}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none"><ChevronDown className="h-4 w-4 text-slate-400" /></div>
        </div>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 lg:h-[calc(100vh-180px)] lg:min-h-[600px]">
        
        <div className="lg:col-span-4 flex flex-col rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#0A0A0A] shadow-sm overflow-hidden lg:min-h-0 min-h-[400px]">
          <div className="p-5 border-b border-slate-200 dark:border-[#27272A] bg-slate-50 dark:bg-[#111111] rounded-t-2xl">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">Official Directory</h3>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">Manage registered tithers.</p>
          </div>
          
          <div className="p-4 space-y-4 border-b border-slate-200 dark:border-[#27272A]">
            <form onSubmit={handleAddTither} className="flex gap-2">
              <input 
                type="text" 
                placeholder="Add new member..." 
                required 
                className="flex-1 rounded-xl border border-slate-200 dark:border-[#27272A] bg-slate-50 dark:bg-[#121212] px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:border-emerald-500 outline-none transition-colors" 
                value={newTitherName} 
                onChange={e => setNewTitherName(e.target.value)} 
              />
              <button type="submit" disabled={isAdding} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center shrink-0">
                {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              </button>
            </form>

            <div className="relative">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input type="text" placeholder="Search directory..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#27272A] bg-slate-50 dark:bg-[#121212] text-xs font-bold text-slate-900 dark:text-white focus:border-emerald-500 outline-none" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1.5 bg-slate-50/30 dark:bg-transparent lg:min-h-0">
            {tithers.filter(t => t.full_name.toLowerCase().includes(searchQuery.toLowerCase())).map(tither => (
              <div key={tither.id} className="flex items-center justify-between px-4 py-3 bg-white dark:bg-[#121212] hover:bg-slate-50 dark:hover:bg-[#1A1A1A] rounded-xl border border-slate-200 dark:border-[#27272A] transition-all group">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-wide">{tither.full_name}</span>
                <button onClick={() => handleDeletePrompt(tither.id, tither.full_name)} className="text-slate-400 opacity-0 group-hover:opacity-100 hover:text-rose-500 transition-all p-1">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {tithers.length === 0 && <div className="p-8 text-center text-[11px] text-slate-500 font-medium">Directory is empty. Add a member above.</div>}
          </div>
        </div>

        <div className="lg:col-span-8 flex flex-col gap-6 lg:min-h-0">
          
          <div className="grid grid-cols-2 gap-4 shrink-0">
            <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#27272A] rounded-2xl flex items-center justify-between p-5 shadow-sm">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tithes Received</p>
                <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{analysis.fulfilled.length}</h3>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-6 w-6" />
              </div>
            </div>
            <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#27272A] rounded-2xl flex items-center justify-between p-5 shadow-sm">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pending / Missing</p>
                <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{analysis.missing.length}</h3>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-6 w-6" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 lg:min-h-0">
            
            <div className="flex flex-col bg-white dark:bg-[#0A0A0A] rounded-2xl border border-slate-200 dark:border-[#27272A] overflow-hidden shadow-sm min-h-[300px]">
              <div className="p-4 bg-slate-50 dark:bg-[#111111] border-b border-slate-200 dark:border-[#27272A] flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">Fulfilled Members</h3>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2.5 lg:min-h-0">
                {analysis.fulfilled.length > 0 ? analysis.fulfilled.map(({tither, txs}) => (
                  <div key={tither.id} className="px-4 py-3.5 bg-slate-50 dark:bg-[#121212] rounded-xl border border-slate-200 dark:border-[#27272A]">
                    <p className="text-xs font-bold text-slate-900 dark:text-white tracking-wide">{tither.full_name}</p>
                    <p className="text-[10px] text-slate-500 font-medium mt-1">Recorded <strong className="text-emerald-600 dark:text-emerald-400">{txs.length}</strong> time(s) this month.</p>
                  </div>
                )) : (
                  <div className="p-8 text-center text-[11px] text-slate-400 italic">No tithe matches found for this period.</div>
                )}
              </div>
            </div>

            <div className="flex flex-col bg-white dark:bg-[#0A0A0A] rounded-2xl border border-slate-200 dark:border-[#27272A] overflow-hidden shadow-sm min-h-[300px]">
              <div className="p-4 bg-slate-50 dark:bg-[#111111] border-b border-slate-200 dark:border-[#27272A] flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">Follow-Up Required</h3>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2.5 lg:min-h-0">
                {analysis.missing.length > 0 ? analysis.missing.map(tither => (
                  <div key={tither.id} className="px-4 py-3.5 bg-slate-50 dark:bg-[#121212] rounded-xl border border-slate-200 dark:border-[#27272A] flex justify-between items-center">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 tracking-wide">{tither.full_name}</p>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_#f59e0b]"></span>
                  </div>
                )) : (
                  <div className="p-8 text-center text-[11px] text-slate-400 italic">All members have fulfilled their tithes.</div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      {successMessage && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/75 dark:bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#0A0A0A] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#27272A] w-full max-w-sm p-8 flex flex-col items-center text-center animate-in zoom-in-95 duration-300">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl mb-4 text-emerald-600 dark:text-emerald-400 animate-bounce">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="text-base font-bold uppercase tracking-wider text-slate-900 dark:text-white">Success</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              {successMessage}
            </p>
          </div>
        </div>
      )}

      {deleteParams && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/75 dark:bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#0A0A0A] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#27272A] w-full max-w-md p-6 animate-in zoom-in-95 duration-300">
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
            <div className="flex justify-end gap-3 border-t border-slate-200 dark:border-[#27272A] pt-4">
              <button onClick={() => setDeleteParams(null)} disabled={isDeleting} className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1A1A1A] transition-colors border border-slate-200 dark:border-[#27272A]">
                Cancel
              </button>
              <button onClick={confirmDelete} disabled={isDeleting} className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center gap-2">
                {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isDeleting ? 'Removing...' : 'Yes, Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}