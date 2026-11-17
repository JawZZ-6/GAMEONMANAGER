import { useEffect, useState, type ReactNode } from 'react';
import { ArrowUpRight, Dices, Gamepad2, Heart, Pause, Play, Radio, ScrollText } from 'lucide-react';

export function Brand({ href = '/register' }: { href?: string }) {
  return <a href={href} className="brand" aria-label="GameON home"><span className="brand-icon"><Dices size={27} aria-hidden="true" /></span><span>GAME<span className="orange-text">ON</span><small>RETRO & CYBER · CISI</small></span></a>;
}

export function MotionToggle() {
  const [paused, setPaused] = useState(() => { try { return localStorage.getItem('gameon-motion') === 'paused'; } catch { return false; } });
  const [reduced, setReduced] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.motion = paused || reduced ? 'paused' : 'on';
    try { localStorage.setItem('gameon-motion', paused ? 'paused' : 'on'); } catch { /* Preference is optional when storage is unavailable. */ }
  }, [paused, reduced]);
  const stopped = paused || reduced;
  return <button type="button" className="icon-button motion-toggle" aria-label={reduced ? 'Motion reduced by your device' : paused ? 'Enable animations' : 'Pause animations'} title={reduced ? 'Reduced motion follows your device preference' : paused ? 'Enable animations' : 'Pause animations'} aria-pressed={stopped} disabled={reduced} onClick={() => setPaused(v => !v)}>{stopped ? <Play size={17} aria-hidden="true" /> : <Pause size={17} aria-hidden="true" />}</button>;
}

export function PublicHeader({ active, children }: { active: 'register' | 'live' | 'rules'; children?: ReactNode }) {
  return <header className="live-header site-header">
    <Brand />
    <nav className="public-nav" aria-label="Event navigation">
      <a href="/register" aria-current={active === 'register' ? 'page' : undefined}><Gamepad2 size={16} aria-hidden="true" />Play</a>
      <a href="/live" aria-current={active === 'live' ? 'page' : undefined}><Radio size={16} aria-hidden="true" />Live board</a>
      <a href="/live/rules" aria-current={active === 'rules' ? 'page' : undefined}><ScrollText size={16} aria-hidden="true" />Game rules</a>
    </nav>
    <div className="header-actions"><MotionToggle />{children || <span className="header-purpose"><Heart size={15} aria-hidden="true" />Play for a purpose</span>}</div>
  </header>;
}

export function PublicFooter({ organiser = false }: { organiser?: boolean }) {
  return <footer className="live-footer"><div><strong>GOOD GAMES. <span className="orange-text">GREATER IMPACT.</span></strong><span>Retro & Cyber GameON · For charity by CISI</span></div><div className="footer-links"><a href="/banner.jpg" target="_blank" rel="noreferrer">Event poster <ArrowUpRight size={15} aria-hidden="true" /></a>{organiser && <a href="/admin">Organiser area <ArrowUpRight size={15} aria-hidden="true" /></a>}<span>All times · Asia/Colombo</span></div></footer>;
}

export function eventDate(value: string, year = false) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}), timeZone: 'Asia/Colombo' }).format(new Date(`${value}T12:00:00+05:30`));
}
