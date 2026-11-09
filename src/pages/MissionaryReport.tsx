import { useFeedback } from '../components/ui/useFeedback';
import DialogLayer from '../components/ui/DialogLayer';
import Select from '../components/ui/Select';
import Input from '../components/ui/Input';
import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Save, CheckCircle2, Loader2, Calendar } from 'lucide-react';
import type { FinancialPeriod, WorshipServiceLog, ProjectLog } from '../types/database.types';

export default function MissionaryReport() {
  const { notify } = useFeedback();
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
      notify("Failed to save MPR: " + error.message);
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
        <div className="h-10 bg-slate-200 dark:bg-dark-floating rounded-xl w-1/3 sm:w-1/4"></div>
        <div className="h-32 bg-slate-200 dark:bg-dark-elevated rounded-2xl w-full"></div>
        <div className="h-96 bg-slate-200 dark:bg-dark-elevated rounded-2xl w-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300 relative">
      
      {showSuccess && createPortal(
        <DialogLayer label="Report Saved" className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/75 dark:bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-dark-surface border border-slate-200 dark:border-dark-border rounded-2xl p-8 shadow-2xl flex flex-col items-center text-center space-y-4 animate-in zoom-in-95 duration-300 min-w-[300px]">
            <div className="h-16 w-16 bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/20 rounded-2xl flex items-center justify-center editor-accent animate-bounce"><CheckCircle2 className="h-8 w-8" /></div>
            <div>
              <h3 className="text-base font-bold tracking-normal text-slate-900 dark:text-white">Report Saved</h3>
              <p className="text-xs text-slate-500 mt-1">MPR successfully updated and ready for export.</p>
            </div>
          </div>
        </DialogLayer>,
        document.body
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="system-page-title text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <FileText className="h-7 w-7 editor-accent shrink-0" />
            Monthly ministry report
          </h1>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">Missionary reporting for worship services and projects.</p>
        </div>
        <button onClick={handleSave} aria-busy={saving} disabled={saving} className="flex-none flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md w-full sm:w-auto">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Report
        </button>
      </div>

      <div className="bg-white dark:bg-dark-surface border border-slate-200 dark:border-dark-border rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-sm">
        <div className="flex items-center gap-3 w-full lg:w-auto shrink-0 relative">
          <Calendar className="h-5 w-5 text-slate-400 shrink-0" />
          <Select aria-label="Financial period" value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)} className="w-full lg:w-auto min-w-[220px] rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-elevated px-4 py-3 pr-10 text-xs font-bold text-slate-900 dark:text-white shadow-sm focus:border-sky-500 outline-none appearance-none cursor-pointer">
            {periods.map(p => <option key={p.id} value={p.id}>{p.period_name} {p.status === 'OPEN' ? '(OPEN)' : ''}</option>)}
          </Select>

        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full lg:max-w-[500px]">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 tracking-normal">P / M Name</label>
            <Input aria-label="P / M Name" type="text" className="w-full rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-elevated px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white shadow-sm focus:border-sky-500 outline-none" value={pmName} onChange={e => setPmName(e.target.value)} placeholder="e.g. Sis. Jessica Tolentino" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 tracking-normal">Overseer</label>
            <Input aria-label="Overseer" type="text" className="w-full rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-elevated px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white shadow-sm focus:border-sky-500 outline-none" value={overseerName} onChange={e => setOverseerName(e.target.value)} placeholder="e.g. Ptr. Ronald Gawad" />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-dark-surface border border-slate-200 dark:border-dark-border rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-elevated rounded-t-2xl">
          <h3 className="text-xs font-bold tracking-normal text-slate-900 dark:text-white">Worship service</h3>
        </div>
        <div className="service-editor">{worshipServices.map((ws,idx)=><section className="service-row" key={idx} aria-label={`Worship service ${/^\d+_\d+_po$/.test(ws.dateStr) ? `week ${ws.week}` : ws.dateStr}`}>
          <div className="service-date"><span>{/^\d+_\d+_po$/.test(ws.dateStr) ? 'Service week' : 'Service date'}</span><strong>{/^\d+_\d+_po$/.test(ws.dateStr) ? `Week ${ws.week}` : ws.dateStr}</strong></div>
          <div className="service-message"><label className="report-field"><span>Message title</span><textarea aria-label="Message Title" className="ui-textarea" rows={1} value={ws.title} onChange={e=>updateService(idx,'title',e.target.value)} placeholder="Message title"/></label><label className="report-field"><span>Preacher</span><Input aria-label="Preacher Name" value={ws.preacher} onChange={e=>updateService(idx,'preacher',e.target.value)} placeholder="Preacher name"/></label></div>
          <label className="report-field service-objective"><span>Objective</span><textarea aria-label="Worship service objective" className="ui-textarea" value={ws.objective} onChange={e=>updateService(idx,'objective',e.target.value)} placeholder="Upang matutunan…"/></label>
          <label className="report-field service-scripture"><span>Scripture</span><Input aria-label="e.g. John 3:16" value={ws.text} onChange={e=>updateService(idx,'text',e.target.value)} placeholder="e.g. John 3:16"/></label>
          <div className="service-attendance"><label className="report-field"><span>Adults / youth</span><Input aria-label="Adult attendance" type="number" value={ws.adults||''} onChange={e=>updateService(idx,'adults',parseInt(e.target.value)||0)}/></label><label className="report-field"><span>Children</span><Input aria-label="Children attendance" type="number" value={ws.children||''} onChange={e=>updateService(idx,'children',parseInt(e.target.value)||0)}/></label></div>
        </section>)}</div>
        <div className="service-averages"><strong>Average attendance</strong><span>Adults / youth <b>{averages.adults}</b></span><span>Children <b>{averages.children}</b></span></div>
      </div>

      <div className="bg-white dark:bg-dark-surface border border-slate-200 dark:border-dark-border rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-elevated rounded-t-2xl">
          <h3 className="text-xs font-bold tracking-normal text-slate-900 dark:text-white">Ministry projects</h3>
        </div>
        <div className="overflow-x-auto custom-scrollbar pb-2">
          <table className="ui-data-table w-full text-left border-collapse text-xs min-w-[850px]">
            <thead>
              <tr className="bg-transparent border-b border-slate-200 dark:border-dark-border text-slate-500 font-semibold tracking-normal text-xs">
                <th className="p-4 w-16 shrink-0">Code</th>
                <th className="p-4 min-w-[250px]">Project Name</th>
                <th className="p-4 min-w-[220px]">Schedule</th>
                <th className="p-4 min-w-[220px]">Actual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-dark-border/50 bg-transparent">
              {projects.map((proj, idx) => (
                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-dark-elevated transition-colors">
                  <td data-label="Project code" className="p-4 font-bold text-slate-600 dark:text-slate-400">{proj.type}</td>
                  <td data-label="Project name" className="p-4 font-semibold text-slate-900 dark:text-white">{proj.name}</td>
                  <td data-label="Schedule" className="p-4">
                    <Input aria-label="Target date/details" type="text" className="w-full rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-elevated px-3.5 py-2.5 text-xs font-medium text-slate-900 dark:text-white focus:border-sky-500 outline-none shadow-sm" value={proj.schedule} onChange={e => updateProject(idx, 'schedule', e.target.value)} placeholder="Target date/details" />
                  </td>
                  <td data-label="Actual outcome" className="p-4">
                    <Input aria-label="Actual outcome" type="text" className="w-full rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-elevated px-3.5 py-2.5 text-xs font-medium text-slate-900 dark:text-white focus:border-sky-500 outline-none shadow-sm" value={proj.actual} onChange={e => updateProject(idx, 'actual', e.target.value)} placeholder="Actual outcome" />
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
