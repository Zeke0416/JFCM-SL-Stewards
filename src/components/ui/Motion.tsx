import { MotionContext, useMotion } from './useMotion';
import churchLogo from '../../assets/jfcm-sl_logo.png';
import { useEffect, useState } from 'react';
import { Pause, Play } from 'lucide-react';
export function MotionProvider({ children }: { children: React.ReactNode }) {
  const [paused, setPaused] = useState(() => localStorage.getItem('jfcm_motion_paused') === 'true');
  useEffect(() => { document.documentElement.dataset.motion = paused ? 'paused' : 'running'; localStorage.setItem('jfcm_motion_paused', String(paused)); }, [paused]);
  return <MotionContext.Provider value={{ paused, toggle: () => setPaused(value => !value) }}>{children}</MotionContext.Provider>;
}
export function MotionToggle({ compact = false }: { compact?: boolean }) {
  const { paused, toggle } = useMotion();
  return <button type="button" className="motion-toggle" onClick={toggle} aria-pressed={paused} aria-label={paused ? 'Play motion' : 'Pause motion'} title={paused ? 'Play motion' : 'Pause motion'}>{paused ? <Play size={15} /> : <Pause size={15} />}{!compact && <span>{paused ? 'Play motion' : 'Pause motion'}</span>}</button>;
}
export function LedgerMotion({ variant = 'login' }: { variant?: 'login' | 'dashboard' | 'transition' }) {
  return <div className={`ledger-motion ledger-motion--${variant}`} aria-hidden="true">
    <div className="motion-halo" /><div className="motion-plane plane-one" /><div className="motion-plane plane-two" />
    <svg viewBox="0 0 500 400" className="motion-orbits"><g className="orbit-system"><ellipse cx="250" cy="200" rx="205" ry="105" /><ellipse cx="250" cy="200" rx="170" ry="145" transform="rotate(-28 250 200)" /><ellipse className="orbit-dashed" cx="250" cy="200" rx="145" ry="170" transform="rotate(32 250 200)" /></g><g className="orbital-traveler"><circle cx="250" cy="200" r="149" stroke="none" fill="none" /><circle className="orbit-node" cx="399" cy="200" r="5" /><circle className="orbit-node bronze" cx="101" cy="200" r="4" /></g><path className="orbit-crosshair" d="M235 24h30M250 10v28M235 376h30M250 362v28M20 185v30M6 200h28M480 185v30M466 200h28" /></svg>
    <div className="motion-coin"><div className="coin-rim"><img className="motion-church-logo" src={churchLogo} alt="" /></div></div>
    <div className="motion-ticket ticket-record"><span className="ticket-symbol">+</span><div><strong>Record</strong><span>With honesty</span></div><i /></div>
    <div className="motion-ticket ticket-review"><span className="ticket-symbol">✓</span><div><strong>Review</strong><span>With integrity</span></div><i /></div>
    <div className="motion-ticket ticket-report"><span className="ticket-symbol">↗</span><div><strong>Report</strong><span>With accountability</span></div><i /></div>
  </div>;
}
