/** A shared game table: every kind of play gets the same space. */
export default function ArenaArt({ compact = false }: { compact?: boolean }) {
  return <div className={`arena-art play-art ${compact ? 'compact' : ''}`} role="group" aria-label="Four ways to play at GameON">
    <div className="play-art-grid">
      <div className="play-tile play-retro">
        <svg viewBox="0 0 200 130" fill="none" aria-hidden="true" focusable="false">
          <g transform="translate(44 5) rotate(-7 57 57)">
            <rect width="114" height="114" rx="12" fill="#855039"/>
            <rect x="7" y="7" width="100" height="100" rx="7" fill="#f9dfa1"/>
            <rect x="21" y="21" width="72" height="72" rx="6" stroke="#855039" strokeWidth="2"/>
            <circle cx="57" cy="57" r="17" stroke="#bb7050" strokeWidth="2"/>
            {[[14,14],[100,14],[14,100],[100,100]].map(([cx,cy])=><circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="6" fill="#43362f"/>)}
            <circle cx="56" cy="57" r="6" fill="#c55749"/><circle cx="68" cy="64" r="6" fill="#43362f"/><circle cx="47" cy="68" r="6" fill="#fff8e5" stroke="#d1b174"/>
            <circle cx="70" cy="84" r="8" fill="#fff8e5" stroke="#bb7050" strokeWidth="2"/>
          </g>
          <path d="m27 30 4-9m-11 4 9 3m144 66 7 4m-6-12 1 9" stroke="#855039" strokeWidth="3" strokeLinecap="round"/>
        </svg>
        <strong>Retro classics</strong><span>Old-school favourites</span>
      </div>
      <div className="play-tile play-social">
        <svg viewBox="0 0 200 130" fill="none" aria-hidden="true" focusable="false">
          <g transform="translate(41 19) rotate(-17 35 47)"><rect width="65" height="93" rx="10" fill="#fbf4e7" stroke="#654e89" strokeWidth="3"/><rect x="8" y="8" width="49" height="77" rx="6" fill="#a58cca"/><path d="m32 29 16 19-16 19-16-19Z" fill="#f9e9c3"/></g>
          <g transform="translate(97 16) rotate(13 32 47)"><rect width="65" height="93" rx="10" fill="#fbf4e7" stroke="#654e89" strokeWidth="3"/><rect x="8" y="8" width="49" height="77" rx="6" fill="#db826d"/><path d="M32 66 16 49C3 34 25 24 32 38 40 24 61 34 48 49Z" fill="#fff3da"/></g>
          <path d="m166 25 6-8m-1 16 10-2m-158 65 7 5" stroke="#654e89" strokeWidth="3" strokeLinecap="round"/>
        </svg>
        <strong>Social games</strong><span>Bring your people</span>
      </div>
      <div className="play-tile play-board">
        <svg viewBox="0 0 200 130" fill="none" aria-hidden="true" focusable="false">
          <g transform="translate(42 67) rotate(-6 60 25)"><rect width="120" height="48" rx="6" fill="#f9f1d9" stroke="#477365" strokeWidth="3"/>{Array.from({length:12},(_,i)=>{const x=i%6,y=Math.floor(i/6);return (x+y)%2===0?<rect key={i} x={x*20+2} y={y*23+2} width="19" height="22" fill="#83b19b"/>:null;})}</g>
          <path d="M80 80h43l-4-10h-5l-7-27H96l-7 27h-5Z" fill="#fff7df" stroke="#477365" strokeWidth="3" strokeLinejoin="round"/>
          <circle cx="101" cy="30" r="15" fill="#fff7df" stroke="#477365" strokeWidth="3"/>
          <path d="M64 96h33l-4-8h-4l-5-22H75l-5 22h-3Z" fill="#477365" stroke="#315548" strokeWidth="2"/>
          <circle cx="79" cy="57" r="11" fill="#477365" stroke="#315548" strokeWidth="2"/>
          <path d="m147 29 4 8 9 1-6 6 1 9-8-4-8 4 1-9-6-6 9-1Z" fill="#477365"/>
        </svg>
        <strong>Board games</strong><span>Think a move ahead</span>
      </div>
      <div className="play-tile play-cyber">
        <svg viewBox="0 0 200 130" fill="none" aria-hidden="true" focusable="false">
          <g transform="rotate(9 100 65)">
            <path d="M80 36v-9q0-12 18-12h9" stroke="#775441" strokeWidth="4" strokeLinecap="round"/>
            <path d="M55 36h90q18 0 23 22l9 39q3 18-11 19-8 1-17-12l-11-14H63l-12 14q-10 13-19 11-13-3-9-18l10-39q4-22 22-22Z" fill="#fff4df" stroke="#775441" strokeWidth="3"/>
            <path d="M53 51h12v12h12v12H65v12H53V75H41V63h12Z" fill="#775441"/>
            <circle cx="139" cy="58" r="7" fill="#b493cc" stroke="#775441" strokeWidth="2"/><circle cx="154" cy="75" r="7" fill="#db826d" stroke="#775441" strokeWidth="2"/>
            <rect x="87" y="76" width="13" height="5" rx="2.5" fill="#775441"/><rect x="106" y="76" width="13" height="5" rx="2.5" fill="#775441"/>
          </g>
          <path d="m28 28 6 6m130-9 5-7m4 16 8-1" stroke="#775441" strokeWidth="3" strokeLinecap="round"/>
        </svg>
        <strong>Cyber games</strong><span>A little friendly rivalry</span>
      </div>
    </div>
  </div>;
}
