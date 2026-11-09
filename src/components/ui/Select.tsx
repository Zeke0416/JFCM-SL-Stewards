import { Children, Fragment, isValidElement, useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, ReactNode, SelectHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';
interface Choice { value: string; label: string; disabled: boolean }
function textOf(node: ReactNode): string { return Children.toArray(node).map(child => isValidElement<{ children?: ReactNode }>(child) ? textOf(child.props.children) : String(child)).join(''); }
function choicesOf(children: ReactNode, disabled = false): Choice[] {
  const options: Choice[] = [];
  Children.forEach(children, child => {
    if (!isValidElement<{ children?: ReactNode; value?: string | number; disabled?: boolean }>(child)) return;
    if (child.type === 'option') options.push({ value: String(child.props.value ?? textOf(child.props.children)), label: textOf(child.props.children), disabled: disabled || !!child.props.disabled });
    else if (child.type === Fragment || child.type === 'optgroup') options.push(...choicesOf(child.props.children, disabled || !!child.props.disabled));
  });
  return options;
}
export default function Select({ children, className = '', value, defaultValue, disabled, onChange, onInvalid, style, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  const options = choicesOf(children);
  const [internal, setInternal] = useState(String(defaultValue ?? options[0]?.value ?? ''));
  const selected = String(value ?? internal);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);
  const [position, setPosition] = useState<CSSProperties>({});
  const trigger = useRef<HTMLButtonElement>(null);
  const native = useRef<HTMLSelectElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const id = useId();
  const filtered = options.filter(option => option.label.toLowerCase().includes(query.toLowerCase()));
  const label = options.find(option => option.value === selected)?.label || 'Choose an option';
  const close = () => { setOpen(false); setQuery(''); };
  const show = () => {
    if (disabled || !trigger.current) return;
    const rect = trigger.current.getBoundingClientRect();
    const spaceBelow = innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const below = spaceBelow >= 260 || spaceBelow >= spaceAbove;
    const height = Math.max(90, Math.min(340, (below ? spaceBelow : spaceAbove) - 20));
    setPosition({ left: Math.max(12, Math.min(rect.left, innerWidth - Math.max(rect.width, 240) - 12)), width: Math.min(Math.max(rect.width, 240), innerWidth - 24), maxHeight: height, ...(below ? { top: rect.bottom + 8 } : { bottom: innerHeight - rect.top + 8 }) });
    setQuery(''); setActive(Math.max(0, options.findIndex(option => option.value === selected))); setOpen(true);
  };
  const choose = (option: Choice) => {
    if (option.disabled || !native.current) return;
    setInternal(option.value);
    native.current.value = option.value;
    native.current.dispatchEvent(new Event('change', { bubbles: true }));
    close(); trigger.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    if (options.length > 7) search.current?.focus();
    const outside = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) close(); };
    const reposition = (event: Event) => { if (!menu.current?.contains(event.target as Node)) close(); };
    document.addEventListener('pointerdown', outside); window.addEventListener('resize', close); window.addEventListener('scroll', reposition, true);
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', close); window.removeEventListener('scroll', reposition, true); };
  }, [open, options.length]);
  useEffect(() => {
    if (!open) return;
    const option = menu.current?.querySelector<HTMLElement>('[data-active=true]');
    const list = option?.parentElement;
    if (option && list) { const top = option.offsetTop - list.offsetTop; if (top < list.scrollTop) list.scrollTop = top; else if (top + option.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = top + option.offsetHeight - list.clientHeight; }
  }, [active, open]);
  const keyboard = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); trigger.current?.focus(); return; }
    if (event.key === 'Tab') { close(); trigger.current?.focus(); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      if (!open) { show(); return; }
      const direction = event.key === 'ArrowUp' ? -1 : 1;
      let next = event.key === 'Home' ? 0 : event.key === 'End' ? filtered.length - 1 : (active + direction + filtered.length) % Math.max(filtered.length, 1);
      for (let i = 0; i < filtered.length && filtered[next]?.disabled; i++) next = (next + direction + filtered.length) % filtered.length;
      setActive(next);
    } else if (event.key === 'Enter' || (event.key === ' ' && event.target === trigger.current)) {
      event.preventDefault(); if (!open) show(); else if (filtered[active]) choose(filtered[active]);
    } else if (!open && event.key.length === 1 && !event.ctrlKey && !event.metaKey) { event.preventDefault(); show(); setQuery(event.key); setActive(0); }
  };
  return <span className={`ui-select ${className} ${disabled ? 'is-disabled' : ''}`} style={style}>
    <select {...props} ref={native} value={selected} disabled={disabled} onChange={onChange} tabIndex={-1} aria-hidden="true" className="ui-select-native" onInvalid={event => { event.preventDefault(); trigger.current?.focus(); onInvalid?.(event); }}>{children}</select>
    <button ref={trigger} type="button" role="combobox" className="ui-select-trigger" disabled={disabled} aria-label={props['aria-label'] || 'Choose an option'} aria-labelledby={props['aria-labelledby']} aria-expanded={open} aria-controls={open ? id : undefined} aria-activedescendant={open && active >= 0 ? `${id}-${active}` : undefined} aria-required={props.required} onClick={() => open ? close() : show()} onKeyDown={keyboard}><span>{label}</span><ChevronDown size={16} className={open ? 'select-chevron is-open' : 'select-chevron'} /></button>
    {open && createPortal(<div ref={menu} data-select-popup className="ui-select-popup" style={position} onKeyDown={keyboard}>
      <div className="select-menu-caption">{props['aria-label'] || 'Choose an option'}<span>{options.length}</span></div>
      {options.length > 7 && <div className="select-search"><Search size={16} /><input ref={search} value={query} aria-label="Filter options" placeholder="Type to find…" onChange={event => { setQuery(event.target.value); setActive(0); }} aria-controls={id} aria-activedescendant={active >= 0 ? `${id}-${active}` : undefined} /></div>}
      <div id={id} role="listbox" aria-label={props['aria-label'] || 'Options'} className="select-options">{filtered.map((option, index) => <button key={`${option.value}-${index}`} id={`${id}-${index}`} type="button" role="option" aria-selected={option.value === selected} aria-disabled={option.disabled} disabled={option.disabled} tabIndex={-1} data-active={index === active} onPointerMove={() => setActive(index)} onClick={() => choose(option)}><span>{option.label}</span>{option.value === selected && <Check size={16} />}</button>)}{!filtered.length && <p className="select-no-results">No matching options</p>}</div>
    </div>, document.body)}
  </span>;
}
