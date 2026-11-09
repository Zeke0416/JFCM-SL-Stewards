import { useState, useEffect } from 'react';
import { useSyncExternalStore } from 'react';
const media = '(prefers-reduced-motion: reduce)';
const subscribe = (notify: () => void) => { const query = matchMedia(media); query.addEventListener('change', notify); return () => query.removeEventListener('change', notify); };
export default function AnimatedNumber({ value, formatPHP }: { value: number; formatPHP?: boolean }) {
  const reduced = useSyncExternalStore(subscribe, () => matchMedia(media).matches, () => false);
  const [display, setDisplay] = useState({ target: value, amount: 0 });
  useEffect(() => {
    if (reduced) return;
    let frame = 0; let start: number | undefined;
    const step = (time: number) => {
      start ??= time;
      const progress = Math.min((time - start) / 1000, 1);
      setDisplay({ target: value, amount: progress === 1 ? value : value * (1 - (1 - progress) ** 3) });
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);
  const amount = reduced ? value : display.target === value ? display.amount : 0;
  const format = (number: number) => new Intl.NumberFormat('en-PH', { style: formatPHP ? 'currency' : 'decimal', currency: 'PHP', minimumFractionDigits: formatPHP ? 2 : 0, maximumFractionDigits: formatPHP ? 2 : 0 }).format(number);
  return <span className="animated-number" aria-label={format(value)}><span aria-hidden="true">{format(amount)}</span></span>;
}
