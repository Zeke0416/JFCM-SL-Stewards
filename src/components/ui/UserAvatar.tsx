import { UserRound } from 'lucide-react';
export default function UserAvatar({ photoUrl, size = 32, className = '' }: { photoUrl?: string | null; size?: number; className?: string }) {
  return <span aria-hidden="true" className={`user-avatar ${className}`} style={{ width: size, height: size }}><UserRound size={Math.round(size * .53)}/>{photoUrl && <img src={photoUrl} alt="" onLoad={event => { event.currentTarget.hidden = false; }} onError={event => { event.currentTarget.hidden = true; }}/>}</span>;
}
