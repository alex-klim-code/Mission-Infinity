const base = import.meta.env.BASE_URL;

export default function Slide15() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text">
      <img src={`${base}img/earth-orbit.png`} crossOrigin="anonymous" alt="" className="absolute inset-0 w-full h-full object-cover" style={{opacity:0.4}} />
      <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/90 to-bg/30" />
      <div className="absolute inset-0 px-[6vw] pt-[7vh] pb-[6vh] flex flex-col">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-[1vh]">
            <span className="font-mono text-[1.5vw] tracking-[0.12em] text-muted">LOT</span>
            <h2 className="font-display text-[3.8vw] leading-[1.05] font-medium tracking-tight [text-wrap:balance] max-w-[70vw]">Start następuje na Twoją komendę</h2>
          </div>
          <div className="w-[2.5vw] h-[2.5vw] rounded-full border border-muted flex items-center justify-center"><div className="w-[0.5vw] h-[0.5vw] rounded-full bg-accent" /></div>
        </div>
        <div className="flex-1 grid grid-cols-[7fr_5fr] gap-[4vw] mt-[5vh] min-h-0">
          <div className="flex flex-col justify-center">
          <div className="flex gap-[1.6vw] items-baseline border-t border-[#6A8AAA]/30 py-[1.6vh]">
            <span className="font-mono text-[1.5vw] text-accent">01</span>
            <p className="font-body text-[2.1vw] leading-snug text-text [text-wrap:pretty]">Rakieta czeka na świadome rozpoczęcie startu</p>
          </div>
          <div className="flex gap-[1.6vw] items-baseline border-t border-[#6A8AAA]/30 py-[1.6vh]">
            <span className="font-mono text-[1.5vw] text-accent">02</span>
            <p className="font-body text-[2.1vw] leading-snug text-text [text-wrap:pretty]">Obserwuj przebieg lotu i bieżące parametry</p>
          </div>
          <div className="flex gap-[1.6vw] items-baseline border-t border-[#6A8AAA]/30 py-[1.6vh]">
            <span className="font-mono text-[1.5vw] text-accent">03</span>
            <p className="font-body text-[2.1vw] leading-snug text-text [text-wrap:pretty]">Reaguj na alarmy o uszkodzeniach</p>
          </div>
          <div className="flex gap-[1.6vw] items-baseline border-t border-[#6A8AAA]/30 py-[1.6vh]">
            <span className="font-mono text-[1.5vw] text-accent">04</span>
            <p className="font-body text-[2.1vw] leading-snug text-text [text-wrap:pretty]">Kontroluj paliwo podczas drogi w stronę Księżyca</p>
          </div>
          </div>
          <div className="flex flex-col justify-center">
            <svg viewBox="0 0 400 300" className="w-full h-auto">
              <circle cx="70" cy="250" r="60" fill="#2E5A8A" />
              <circle cx="350" cy="50" r="24" fill="#C9CED6" />
              <path d="M90 195 C 120 80, 250 40, 325 55" fill="none" stroke="#F2A65A" strokeWidth="4" strokeDasharray="10 7" />
              <circle cx="190" cy="85" r="7" fill="#E0E8F0" />
            </svg>
            <span className="font-mono text-[1.5vw] text-muted mt-[1vh]">START → TRANSFER → KSIĘŻYC</span>
          </div>
        </div>
        <div className="mt-auto flex justify-between items-end font-mono text-[1.5vw] text-muted">
          <span>MISSION: INFINITY</span>
          <span className="text-text">15</span>
        </div>
      </div>
    </div>
  );
}
