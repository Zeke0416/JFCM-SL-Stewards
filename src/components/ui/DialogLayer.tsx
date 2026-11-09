import { useEffect, useRef } from 'react';
import type { HTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
let order = 0;
interface Props extends HTMLAttributes<HTMLDivElement> { label: string; open?: boolean; active?: boolean; onDismiss?: () => void }
export default function DialogLayer({ label, open = true, active = true, onDismiss, className = '', children, ...props }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const layerOrder = useRef(0);
  const dismiss = useRef(onDismiss);
  useEffect(() => { dismiss.current = onDismiss; }, [onDismiss]);
  useEffect(() => {
    if (!open || !active || !ref.current) return;
    const root = ref.current;
    layerOrder.current = ++order;
    root.style.zIndex = String(100000 + layerOrder.current * 10);
    const previous = document.activeElement as HTMLElement | null;
    const bodyOverflow = document.body.style.overflow;
    const bodyPadding = document.body.style.paddingRight;
    const scrollbar = innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
    const focusables = () => Array.from(root.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled):not([type=hidden]), textarea:not(:disabled), [tabindex="0"]')).filter(element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden' && !element.closest('[inert]'));
    const frame = requestAnimationFrame(() => (focusables()[0] || root).focus());
    const isTop = () => Array.from(document.querySelectorAll<HTMLElement>('[data-dialog-layer][data-active=true]')).every(other => other === root || Number(other.style.zIndex) <= Number(root.style.zIndex));
    const keyboard = (event: KeyboardEvent) => {
      if (!isTop() || document.querySelector('[data-select-popup]')) return;
      if (event.key === 'Escape' && dismiss.current) { event.preventDefault(); event.stopPropagation(); dismiss.current(); }
      if (event.key === 'Tab') {
        const elements = focusables(); const first = elements[0]; const last = elements[elements.length - 1];
        if (!first) { event.preventDefault(); root.focus(); }
        else if (event.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', keyboard);
    return () => { document.body.style.overflow = bodyOverflow; document.body.style.paddingRight = bodyPadding; cancelAnimationFrame(frame); document.removeEventListener('keydown', keyboard); if (previous?.isConnected) previous.focus(); };
  }, [open, active]);
  if (!open) return null;
  return createPortal(<div {...props} ref={ref} role="dialog" aria-modal={active || undefined} aria-label={label} aria-hidden={!active || undefined} inert={!active} tabIndex={-1} data-dialog-layer data-active={active} className={`dialog-layer ${className}`} onPointerDown={event => { props.onPointerDown?.(event); if (event.target === event.currentTarget && active) onDismiss?.(); }}>{children}</div>, document.body);
}
