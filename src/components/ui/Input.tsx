import { useId } from 'react';
import type { InputHTMLAttributes, Ref } from 'react';
type Props = InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> };
export default function Input({ className = '', id, ...props }: Props) {
  const generatedId = useId();
  return <input id={id || generatedId} className={`ui-input ${className}`} {...props} />;
}
