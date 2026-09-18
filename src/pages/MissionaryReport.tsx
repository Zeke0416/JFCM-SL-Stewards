// ==========================================
// MISSIONARY REPORT PAGE COMPONENT
// Purpose: Handles MPR inputs with dynamic textareas, split fields, and averages.
// ==========================================

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Save, CheckCircle2, Loader2, Calendar } from 'lucide-react';
import type { FinancialPeriod, MPRReport, WorshipServiceLog, ProjectLog } from '../types/database.types';

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
        const active = periodData.find(p => p.status === 'OPEN') || periodData[0];
        setSelectedPeriod(active.id);
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

    // Standardized format: 1_1_po (monthIndex_week_po)
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
      // Pre-fill default names if they are empty
      setPmName(data.pm_name || 'Sis. Jessica Tolentino');
      setOverseerName(data.overseer_name || 'Ptr. Ronald Gawad');
      
      // Migration fallback for old data if needed
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

  // Helper to dynamically auto-resize textareas to fit their content perfectly
  const handleAutoResize = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    target.style.height = 'auto';
    target.style.height = `${target.scrollHeight}px`;
  };

  // Compute Averages
  const averages = useMemo(() => {
    let totalA = 0;
    let totalC = 0;
    let count = 0;
    worshipServices.forEach(ws => {
      // Only count services that actually have data inputted
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

  if (loading) return <div className="p-12 text-center text-slate-500 font-medium text-xs">Loading MPR interface...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-300 relative">
      
      {showSuccess && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#27272A] rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center space-y-4 animate-modal min-w-[300px]">
            <div className="h-16 w-16 bg-emerald-100 dark:bg-emerald-950/60 rounded-2xl flex items-center justify-center text-emerald-600 animate-bounce"><CheckCircle2 className="h-8 w-8" /></div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Report Saved</h3>
              <p className="text-xs text-slate-500 mt-1">MPR successfully updated and ready for export.</p>
            </div>
          </div>
        </div>,
        document.body
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <FileText className="h-7 w-7 text-brand dark:text-emerald-500 shrink-0" />
            Monthly Progress Report (MPR)
          </h1>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">Missionary reporting for worship services and projects.</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="flex-none flex items-center justify-center gap-2 bg-brand dark:bg-emerald-700 hover:bg-brand-dark dark:hover:bg-emerald-800 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md w-full sm:w-auto">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Report
        </button>
      </div>

      {/* FIX: Replaced Flexbox with CSS Grid to enforce identical 50/50 sizing on the Name inputs */}
      <div className="bento-card p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white dark:bg-[#121212]">
        <div className="flex items-center gap-3 w-full lg:w-auto shrink-0">
          <Calendar className="h-5 w-5 text-slate-400 shrink-0" />
          <select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)} className="w-full lg:w-auto min-w-[220px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-2.5 text-xs font-bold text-slate-900 dark:text-white shadow-sm focus:border-brand">
            {periods.map(p => <option key={p.id} value={p.id}>{p.period_name} {p.status === 'OPEN' ? '(OPEN)' : ''}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full lg:max-w-[500px]">
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">P / M Name</label>
            <input type="text" className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white shadow-sm focus:border-brand" value={pmName} onChange={e => setPmName(e.target.value)} placeholder="e.g. Sis. Jessica Tolentino" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Overseer</label>
            <input type="text" className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white shadow-sm focus:border-brand" value={overseerName} onChange={e => setOverseerName(e.target.value)} placeholder="e.g. Ptr. Ronald Gawad" />
          </div>
        </div>
      </div>

      <div className="bento-card overflow-hidden p-0 border border-slate-200 dark:border-[#27272A] shadow-sm rounded-2xl bg-white dark:bg-[#121212]">
        <div className="p-4 border-b border-slate-200 dark:border-[#27272A] bg-slate-50 dark:bg-[#0A0A0A]">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">1.0 WORSHIP SERVICE</h3>
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
                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                  <td className="p-4 font-mono text-slate-600 dark:text-slate-400 font-bold align-top pt-6">{ws.dateStr}</td>
                  
                  <td className="p-4 align-top">
                    <div className="space-y-2">
                      <textarea 
                        rows={1} 
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-900 dark:text-white focus:border-brand resize-none shadow-sm overflow-hidden" 
                        value={ws.title} 
                        onInput={handleAutoResize}
                        onChange={e => updateService(idx, 'title', e.target.value)} 
                        placeholder="Message Title" 
                      />
                      <input 
                        type="text" 
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#1A1A1A] px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 focus:border-brand shadow-sm" 
                        value={ws.preacher} 
                        onChange={e => updateService(idx, 'preacher', e.target.value)} 
                        placeholder="Preacher Name" 
                      />
                    </div>
                  </td>

                  <td className="p-4 align-top">
                    <textarea 
                      rows={2} 
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-900 dark:text-white focus:border-brand resize-none shadow-sm overflow-hidden" 
                      value={ws.objective} 
                      onInput={handleAutoResize}
                      onChange={e => updateService(idx, 'objective', e.target.value)} 
                      placeholder="Upang matutunan..." 
                    />
                  </td>

                  <td className="p-4 align-top">
                    <input 
                      type="text" 
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-900 dark:text-white focus:border-brand shadow-sm" 
                      value={ws.text} 
                      onChange={e => updateService(idx, 'text', e.target.value)} 
                      placeholder="e.g. John 3:16" 
                    />
                  </td>

                  <td className="p-4 align-top">
                    <div className="flex flex-col gap-3">
                      <div className="text-center">
                        <span className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Adults & Youth</span>
                        <input 
                          type="number" 
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-1.5 text-xs font-bold text-slate-900 dark:text-white text-center focus:border-brand shadow-sm" 
                          value={ws.adults || ''} 
                          onChange={e => updateService(idx, 'adults', parseInt(e.target.value) || 0)} 
                        />
                      </div>
                      <div className="text-center">
                        <span className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Children</span>
                        <input 
                          type="number" 
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-1.5 text-xs font-bold text-slate-900 dark:text-white text-center focus:border-brand shadow-sm" 
                          value={ws.children || ''} 
                          onChange={e => updateService(idx, 'children', parseInt(e.target.value) || 0)} 
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}

              <tr className="bg-slate-50 dark:bg-[#0A0A0A] border-t-2 border-slate-200 dark:border-slate-800">
                <td colSpan={4} className="p-4 text-right font-black uppercase text-slate-600 dark:text-slate-400 text-[10px] tracking-wider align-middle">
                  Average Attendance
                </td>
                <td className="p-4">
                  <div className="flex flex-col gap-2">
                    <div className="text-center bg-white dark:bg-slate-900 py-1.5 rounded border border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white shadow-sm">
                      {averages.adults}
                    </div>
                    <div className="text-center bg-white dark:bg-slate-900 py-1.5 rounded border border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white shadow-sm">
                      {averages.children}
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="bento-card overflow-hidden p-0 border border-slate-200 dark:border-[#27272A] shadow-sm rounded-2xl bg-white dark:bg-[#121212]">
        <div className="p-4 border-b border-slate-200 dark:border-[#27272A] bg-slate-50 dark:bg-[#0A0A0A]">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">2.0 PROJECTS</h3>
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
                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                  <td className="p-4 font-bold text-slate-600 dark:text-slate-400">{proj.type}</td>
                  <td className="p-4 font-semibold text-slate-900 dark:text-white">{proj.name}</td>
                  <td className="p-4">
                    <input type="text" className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-900 dark:text-white focus:border-brand shadow-sm" value={proj.schedule} onChange={e => updateProject(idx, 'schedule', e.target.value)} placeholder="Target date/details" />
                  </td>
                  <td className="p-4">
                    <input type="text" className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-900 dark:text-white focus:border-brand shadow-sm" value={proj.actual} onChange={e => updateProject(idx, 'actual', e.target.value)} placeholder="Actual outcome" />
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