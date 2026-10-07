import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Save, CheckCircle2, Loader2, Calendar, ChevronDown } from 'lucide-react';
import type { FinancialPeriod, WorshipServiceLog, ProjectLog } from '../types/database.types';

export default function MissionaryReport() {
  const { user } = useAuth();
  const [churchId, setChurchId] = useState('');
  const [periods, setPeriods] = useState<FinancialPeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Form State
  const [pmName, setPmName] = useState('');
  const [overseerName, setOverseerName] = useState('');
  const [worshipServices, setWorshipServices] = useState<WorshipServiceLog[]>([]);
  const [projects, setProjects] = useState<ProjectLog[]>([]);

  useEffect(() => {
    if (user) fetchInitialData();
  }, [user]);

  const fetchInitialData = async () => {
    setLoading(true);
    const { data: profile } = await supabase.from('profiles').select('church_id').eq('id', user?.id).single();
    if (profile) {
      setChurchId(profile.church_id);
      const { data: periodData } = await supabase.from('financial_periods').select('*').eq('church_id', profile.church_id).order('month', { ascending: true });
      if (periodData && periodData.length > 0) {
        setPeriods(periodData);
        
        // Smart deadline rule
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const todayDate = now.getDate();
        const deadlineDay = parseInt(localStorage.getItem('mpr_deadline_day') || '14', 10);
        
        let targetMonth = currentMonth;
        if (todayDate < deadlineDay) {
          targetMonth = currentMonth - 1;
          if (targetMonth === 0) targetMonth = 12;
        }

        const smartPeriod = periodData.find(p => p.month === targetMonth) || periodData.find(p => p.status === 'OPEN') || periodData[0];
        setSelectedPeriod(smartPeriod.id);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    if (selectedPeriod) loadMPRData(selectedPeriod);
  }, [selectedPeriod]);

  const loadMPRData = async (periodId: string) => {
    const period = periods.find(p => p.id === periodId);
    const monthIndex = period ? period.month : 1;

    const blankServices: WorshipServiceLog[] = Array.from({ length: 5 }, (_, i) => ({
      week: i + 1,
      dateStr: `${monthIndex}_${i + 1}_po`,
      title: '',
      preacher: '',
      objective: '',
      text: '',
      adults: 0,
      children: 0
    }));

    const blankProjects: ProjectLog[] = [
      { id: 'd1', type: 'D.1', name: 'Acquisition / Construction', schedule: '', actual: '' },
      { id: 'd2', type: 'D.2', name: 'Seminars/Conferences & Education', schedule: '', actual: '' },
      { id: 'd3', type: 'D.3', name: 'Special Events', schedule: '', actual: '' }
    ];

    const { data } = await supabase.from('mpr_reports').select('*').eq('financial_period_id', periodId).single();
    
    if (data) {
      setPmName(data.pm_name || 'Sis. Jessica Tolentino');
      setOverseerName(data.overseer_name || 'Ptr. Ronald Gawad');
      
      const mappedServices = (data.worship_services || blankServices).map((ws: any) => ({
         ...ws,
         title: ws.title !== undefined ? ws.title : (ws.titlePreacher || ''),
         preacher: ws.preacher !== undefined ? ws.preacher : ''
      }));

      setWorshipServices(mappedServices);
      setProjects(data.projects?.length ? data.projects : blankProjects);
    } else {
      setPmName('Sis. Jessica Tolentino');
      setOverseerName('Ptr. Ronald Gawad');
      setWorshipServices(blankServices);
      setProjects(blankProjects);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      church_id: churchId,
      financial_period_id: selectedPeriod,
      pm_name: pmName,
      overseer_name: overseerName,
      worship_services: worshipServices,
      projects: projects
    };

    const { error } = await supabase.from('mpr_reports').upsert(payload, { onConflict: 'church_id,financial_period_id' });
    
    setSaving(false);
    if (error) {
      alert("Failed to save MPR: " + error.message);
    } else {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    }
  };

  const updateService = (index: number, field: keyof WorshipServiceLog, value: any) => {
    const updated = [...worshipServices];
    updated[index] = { ...updated[index], [field]: value };
    setWorshipServices(updated);
  };

  const updateProject = (index: number, field: keyof ProjectLog, value: any) => {
    const updated = [...projects];
    updated[index] = { ...updated[index], [field]: value };
    setProjects(updated);
  };

  const handleAutoResize = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    target.style.height = 'auto';
    target.style.height = `${target.scrollHeight}px`;
  };

  const autoResizeRef = (el: HTMLTextAreaElement | null) => {
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  };

  const averages = useMemo(() => {
    let totalA = 0;
    let totalC = 0;
    let count = 0;
    worshipServices.forEach(ws => {
      if (ws.adults > 0 || ws.children > 0 || ws.title.trim() !== '' || ws.preacher.trim() !== '') {
        totalA += ws.adults;
        totalC += ws.children;
        count++;
      }
    });
    return {
      adults: count > 0 ? Math.round(totalA / count) : 0,
      children: count > 0 ? Math.round(totalC / count) : 0,
    };
  }, [worshipServices]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-slate-200 dark:bg-[#1a1a1a] rounded-xl w-1/3 sm:w-1/4"></div>
        <div className="h-32 bg-slate-200 dark:bg-[#121212] rounded-2xl w-full"></div>
        <div className="h-96 bg-slate-200 dark:bg-[#121212] rounded-2xl w-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300 relative">
      
      {showSuccess && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/75 dark:bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#27272A] rounded-2xl p-8 shadow-2xl flex flex-col items-center text-center space-y-4 animate-in zoom-in-95 duration-300 min-w-[300px]">
            <div className="h-16 w-16 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 animate-bounce"><CheckCircle2 className="h-8 w-8" /></div>
            <div>
              <h3 className="text-base font-bold uppercase tracking-wider text-slate-900 dark:text-white">Report Saved</h3>
              <p className="text-xs text-slate-500 mt-1">MPR successfully updated and ready for export.</p>
            </div>
          </div>
        </div>,
        document.body
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <FileText className="h-7 w-7 text-emerald-600 dark:text-emerald-400 shrink-0" />
            Monthly Progress Report (MPR)
          </h1>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">Missionary reporting for worship services and projects.</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="flex-none flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md w-full sm:w-auto">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Report
        </button>
      </div>

      <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#27272A] rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-sm">
        <div className="flex items-center gap-3 w-full lg:w-auto shrink-0 relative">
          <Calendar className="h-5 w-5 text-slate-400 shrink-0" />
          <select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)} className="w-full lg:w-auto min-w-[220px] rounded-xl border border-slate-200 dark:border-[#27272A] bg-slate-50 dark:bg-[#121212] px-4 py-3 pr-10 text-xs font-bold text-slate-900 dark:text-white shadow-sm focus:border-emerald-500 outline-none appearance-none cursor-pointer">
            {periods.map(p => <option key={p.id} value={p.id}>{p.period_name} {p.status === 'OPEN' ? '(OPEN)' : ''}</option>)}
          </select>
          <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none"><ChevronDown className="h-4 w-4 text-slate-400" /></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full lg:max-w-[500px]">
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">P / M Name</label>
            <input type="text" className="w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-slate-50 dark:bg-[#121212] px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white shadow-sm focus:border-emerald-500 outline-none" value={pmName} onChange={e => setPmName(e.target.value)} placeholder="e.g. Sis. Jessica Tolentino" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Overseer</label>
            <input type="text" className="w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-slate-50 dark:bg-[#121212] px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white shadow-sm focus:border-emerald-500 outline-none" value={overseerName} onChange={e => setOverseerName(e.target.value)} placeholder="e.g. Ptr. Ronald Gawad" />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#27272A] rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-[#27272A] bg-slate-50 dark:bg-[#111111] rounded-t-2xl">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">1.0 WORSHIP SERVICE</h3>
        </div>
        <div className="overflow-x-auto custom-scrollbar pb-2">
          <table className="w-full text-left border-collapse text-xs min-w-[1050px]">
            <thead>
              <tr className="bg-transparent border-b border-slate-200 dark:border-[#27272A] text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="p-4 w-24 shrink-0">Date</th>
                <th className="p-4 min-w-[260px]">Title & Preacher</th>
                <th className="p-4 min-w-[260px]">Objective</th>
                <th className="p-4 min-w-[180px]">Scripture</th>
                <th className="p-4 w-32 text-center shrink-0">Attendance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#27272A]/50 bg-transparent">
              {worshipServices.map((ws, idx) => (
                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-[#121212] transition-colors">
                  <td className="p-4 font-mono text-slate-600 dark:text-slate-400 font-bold align-top pt-6">{ws.dateStr}</td>
                  
                  <td className="p-4 align-top">
                    <div className="space-y-2">
                      <textarea 
                        rows={1} 
                        ref={autoResizeRef}
                        className="w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-slate-50 dark:bg-[#121212] px-3 py-2 text-xs font-medium text-slate-900 dark:text-white focus:border-emerald-500 outline-none resize-none shadow-sm overflow-hidden" 
                        value={ws.title} 
                        onInput={handleAutoResize}
                        onChange={e => updateService(idx, 'title', e.target.value)} 
                        placeholder="Message Title" 
                      />
                      <input 
                        type="text" 
                        className="w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-slate-50 dark:bg-[#121212] px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 focus:border-emerald-500 outline-none shadow-sm" 
                        value={ws.preacher} 
                        onChange={e => updateService(idx, 'preacher', e.target.value)} 
                        placeholder="Preacher Name" 
                      />
                    </div>
                  </td>

                  <td className="p-4 align-top">
                    <textarea 
                      rows={2} 
                      ref={autoResizeRef}
                      className="w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-slate-50 dark:bg-[#121212] px-3 py-2 text-xs font-medium text-slate-900 dark:text-white focus:border-emerald-500 outline-none resize-none shadow-sm overflow-hidden" 
                      value={ws.objective} 
                      onInput={handleAutoResize}
                      onChange={e => updateService(idx, 'objective', e.target.value)} 
                      placeholder="Upang matutunan..." 
                    />
                  </td>

                  <td className="p-4 align-top">
                    <input 
                      type="text" 
                      className="w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-slate-50 dark:bg-[#121212] px-3 py-2 text-xs font-medium text-slate-900 dark:text-white focus:border-emerald-500 outline-none shadow-sm" 
                      value={ws.text} 
                      onChange={e => updateService(idx, 'text', e.target.value)} 
                      placeholder="e.g. John 3:16" 
                    />
                  </td>

                  <td className="p-4 align-top">
                    <div className="flex flex-col gap-3">
                      <div className="text-center">
                        <span className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Adults & Youth</span>
                        <input 
                          type="number" 
                          className="w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-slate-50 dark:bg-[#121212] py-1.5 text-xs font-bold text-slate-900 dark:text-white text-center focus:border-emerald-500 outline-none shadow-sm" 
                          value={ws.adults || ''} 
                          onChange={e => updateService(idx, 'adults', parseInt(e.target.value) || 0)} 
                        />
                      </div>
                      <div className="text-center">
                        <span className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Children</span>
                        <input 
                          type="number" 
                          className="w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-slate-50 dark:bg-[#121212] py-1.5 text-xs font-bold text-slate-900 dark:text-white text-center focus:border-emerald-500 outline-none shadow-sm" 
                          value={ws.children || ''} 
                          onChange={e => updateService(idx, 'children', parseInt(e.target.value) || 0)} 
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}

              <tr className="bg-slate-50 dark:bg-[#111111] border-t-2 border-slate-200 dark:border-[#27272A]">
                <td colSpan={4} className="p-4 text-right font-black uppercase text-slate-600 dark:text-slate-400 text-[10px] tracking-wider align-middle">
                  Average Attendance
                </td>
                <td className="p-4">
                  <div className="flex flex-col gap-2">
                    <div className="text-center bg-white dark:bg-[#0A0A0A] py-1.5 rounded-xl border border-slate-200 dark:border-[#27272A] font-bold text-slate-900 dark:text-white shadow-sm">
                      {averages.adults}
                    </div>
                    <div className="text-center bg-white dark:bg-[#0A0A0A] py-1.5 rounded-xl border border-slate-200 dark:border-[#27272A] font-bold text-slate-900 dark:text-white shadow-sm">
                      {averages.children}
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#27272A] rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-[#27272A] bg-slate-50 dark:bg-[#111111] rounded-t-2xl">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">2.0 PROJECTS</h3>
        </div>
        <div className="overflow-x-auto custom-scrollbar pb-2">
          <table className="w-full text-left border-collapse text-xs min-w-[850px]">
            <thead>
              <tr className="bg-transparent border-b border-slate-200 dark:border-[#27272A] text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="p-4 w-16 shrink-0">Code</th>
                <th className="p-4 min-w-[250px]">Project Name</th>
                <th className="p-4 min-w-[220px]">Schedule</th>
                <th className="p-4 min-w-[220px]">Actual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#27272A]/50 bg-transparent">
              {projects.map((proj, idx) => (
                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-[#121212] transition-colors">
                  <td className="p-4 font-bold text-slate-600 dark:text-slate-400">{proj.type}</td>
                  <td className="p-4 font-semibold text-slate-900 dark:text-white">{proj.name}</td>
                  <td className="p-4">
                    <input type="text" className="w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-slate-50 dark:bg-[#121212] px-3.5 py-2.5 text-xs font-medium text-slate-900 dark:text-white focus:border-emerald-500 outline-none shadow-sm" value={proj.schedule} onChange={e => updateProject(idx, 'schedule', e.target.value)} placeholder="Target date/details" />
                  </td>
                  <td className="p-4">
                    <input type="text" className="w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-slate-50 dark:bg-[#121212] px-3.5 py-2.5 text-xs font-medium text-slate-900 dark:text-white focus:border-emerald-500 outline-none shadow-sm" value={proj.actual} onChange={e => updateProject(idx, 'actual', e.target.value)} placeholder="Actual outcome" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}