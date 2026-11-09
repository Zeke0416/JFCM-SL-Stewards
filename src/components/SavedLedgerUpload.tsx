import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { WorkBook } from 'xlsx';
import { FileSpreadsheet, Loader2, RefreshCw, UploadCloud } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { encodeLedger, MAX_LEDGER_BYTES, readLedger, readSavedLedger } from '../utils/savedLedger';
import type { SavedLedger } from '../utils/savedLedger';

type Metadata = Omit<SavedLedger, 'file_base64'>;
interface Props { churchId: string; financialYearId: string; onChange: (workbook: WorkBook | null, name: string | null) => void }
export default function SavedLedgerUpload({ churchId, financialYearId, onChange }: Props) {
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const mounted = useRef(false);
  const scopeReady = Boolean(churchId && financialYearId);
  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    onChange(null, null);
    if (!churchId || !financialYearId) return () => { cancelled = true; mounted.current = false; };
    void (async () => {
      try {
        const { data, error: loadError } = await supabase.from('reconciliation_workbooks').select('file_name,file_size,file_base64,uploaded_at,uploaded_by').eq('church_id', churchId).eq('financial_year_id', financialYearId).maybeSingle();
        if (loadError) throw loadError;
        if (cancelled) return;
        if (data) {
          const row = data as SavedLedger;
          const workbook = readSavedLedger(row);
          setMetadata({ file_name: row.file_name, file_size: row.file_size, uploaded_at: row.uploaded_at, uploaded_by: row.uploaded_by });
          onChange(workbook, row.file_name);
        } else { setMetadata(null); }
      } catch {
        if (!cancelled) setError('The saved ledger could not be loaded. Retry to retrieve it, or upload a newer workbook.');
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; mounted.current = false; };
  }, [churchId, financialYearId, onChange, retry]);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !churchId || !financialYearId || saving || loading) return;
    if (!/\.(xlsx|xls)$/i.test(file.name) || !file.size || file.size > MAX_LEDGER_BYTES) { setError('Choose an .xlsx or .xls ledger smaller than 10 MB.'); return; }
    setSaving(true); setError('');
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const workbook = readLedger(bytes);
      const { data, error: saveError } = await supabase.from('reconciliation_workbooks').upsert({ church_id: churchId, financial_year_id: financialYearId, file_name: file.name, file_size: bytes.length, file_base64: encodeLedger(bytes) }, { onConflict: 'church_id,financial_year_id' }).select('file_name,file_size,uploaded_at,uploaded_by').single();
      if (saveError || !data) throw saveError || new Error('No saved ledger returned.');
      if (!mounted.current) return;
      setMetadata(data as Metadata);
      onChange(workbook, file.name);
    } catch {
      if (mounted.current) setError('The save could not be confirmed. Your current preview is unchanged. Retry loading to check the saved ledger.');
    } finally { if (mounted.current) setSaving(false); }
  };
  return <section className="saved-ledger-panel" aria-label="Saved Excel ledger" aria-busy={(scopeReady && loading) || saving}>
    <div className="saved-ledger-summary"><span className="reference-icon">{loading || saving ? <Loader2 size={21} className="animate-spin"/> : <FileSpreadsheet size={21}/>}</span><div><strong>{!scopeReady ? 'Select a financial period' : loading ? 'Loading saved ledger…' : saving ? 'Saving ledger…' : metadata ? metadata.file_name : 'Upload Excel ledger'}</strong><p>{metadata ? <>Last uploaded <time dateTime={metadata.uploaded_at}>{new Date(metadata.uploaded_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' })}</time></> : 'Saved for this financial year and restored when you return.'}</p></div></div>
    <div className="saved-ledger-actions">{error && <button type="button" className="button-secondary" disabled={loading || saving} onClick={() => { setLoading(true); setError(''); setRetry(value => value + 1); }}><RefreshCw size={16}/>Retry loading</button>}<button type="button" className="button-primary" disabled={loading || saving || !churchId || !financialYearId} onClick={() => input.current?.click()}><UploadCloud size={17}/>{metadata ? 'Upload newer ledger' : 'Choose Excel file'}</button></div>
    <input ref={input} type="file" accept=".xlsx,.xls" aria-label="Upload Excel ledger" className="sr-only" tabIndex={-1} onChange={upload}/>
    {metadata && <p className="saved-ledger-hint">Uploading a newer workbook replaces the saved copy for this financial year. Transaction records stay unchanged.</p>}{error && <p className="saved-ledger-error" role="alert">{error}</p>}
  </section>;
}
