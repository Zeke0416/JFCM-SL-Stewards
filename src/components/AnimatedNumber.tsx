import { useState, useEffect } from 'react';

export default function AnimatedNumber({ value, formatPHP }: { value: number, formatPHP?: boolean }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = value;
    const duration = 1200; // Faster, sharper 1.2s animation
    let startTime: number | null = null;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setDisplayValue(start + (end - start) * easeOutQuart);
      
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setDisplayValue(end); 
      }
    };
    window.requestAnimationFrame(step);
  }, [value]);

  if (formatPHP) {
    return <>{new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(displayValue)}</>;
  }
  return <>{Math.round(displayValue)}</>;
}