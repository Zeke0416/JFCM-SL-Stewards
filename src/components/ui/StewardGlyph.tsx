import type { SVGProps } from 'react';
export type GlyphName = 'overview' | 'ledger' | 'reconcile' | 'people' | 'export' | 'mission' | 'coop' | 'report' | 'setup' | 'admin';
interface Props extends SVGProps<SVGSVGElement> { name: GlyphName; size?: number }
export function StewardGlyph({ name, size = 22, ...props }: Props) {
  const drawings = {
    overview: <><path d="M3 4h7v7H3zM14 4h7v4h-7zM14 12h7v8h-7zM3 15h7v5H3z" /><path className="glyph-accent" d="M5.5 8h2M16.5 16h2" /></>,
    ledger: <><path d="M6 3h13v18H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3ZM6 3v18M10 7h5M10 11h5" /><path className="glyph-accent" d="m10 16 2 2 4-4" /></>,
    reconcile: <><path d="M3 6h12l-3-3M21 18H9l3 3M3 10v8h3M21 14V6h-3" /><path className="glyph-accent" d="m8 12 3 3 5-6" /></>,
    people: <><path d="M4 21V10l8-6 8 6v11M9 21v-6h6v6M2 21h20M12 2v5M10 4h4" /><path className="glyph-accent" d="M7 11h1M16 11h1" /></>,
    export: <><path d="M4 3h11l5 5v13H4ZM14 3v6h6M8 12h4M8 16h3" /><path className="glyph-accent" d="M15 12v6m-3-3 3 3 3-3" /></>,
    mission: <><path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Z" /><path className="glyph-accent" d="m8 12 3 3 5-6" /></>,
    coop: <><path d="M3 8h18L12 3ZM5 11v6M10 11v6M15 11v3M3 21h10M3 18h9" /><circle cx="18" cy="18" r="4" /><path className="glyph-accent" d="m16.5 18 1 1 2-2" /></>,
    report: <><path d="M5 3h14v18H5ZM9 7h6M9 11h6" /><path className="glyph-accent" d="M9 17v-2m3 2v-4m3 4v-1" /></>,
    setup: <><path d="M3 6h18M3 12h18M3 18h18" /><path className="glyph-accent" d="M7 3v6M16 9v6M9 15v6" /></>,
    admin: <><path d="M4 4h16v16H4ZM4 9h16M9 9v11" /><path className="glyph-accent" d="M13 13h4M13 16h2" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{drawings[name]}</svg>;
}
export function LedgerIcon(props:Omit<Props,'name'>) { return <StewardGlyph name="ledger" {...props}/>; }
export function CoopIcon(props:Omit<Props,'name'>) { return <StewardGlyph name="coop" {...props}/>; }
export function MissionIcon(props:Omit<Props,'name'>) { return <StewardGlyph name="mission" {...props}/>; }
export function ReportIcon(props:Omit<Props,'name'>) { return <StewardGlyph name="report" {...props}/>; }
export function SetupIcon(props:Omit<Props,'name'>) { return <StewardGlyph name="setup" {...props}/>; }
