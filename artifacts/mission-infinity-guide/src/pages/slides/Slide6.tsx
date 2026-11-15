const base = import.meta.env.BASE_URL;

export default function Slide6() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text">
      <img src={`${base}img/lunar.png`} crossOrigin="anonymous" alt="" className="absolute inset-0 w-full h-full object-cover" style={{opacity:0.3}} />
      <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/90 to-bg/30" />
      <div className="absolute inset-0 px-[6vw] pt-[7vh] pb-[6vh] flex flex-col">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-[1vh]">
            <span className="font-mono text-[1.5vw] tracking-[0.12em] text-muted">MISJA</span>
            <h2 className="font-display text-[3.8vw] leading-[1.05] font-medium tracking-tight [text-wrap:balance] max-w-[70vw]">Misja LUNA — Lunar Sample Return</h2>
          </div>
          <div className="w-[2.5vw] h-[2.5vw] rounded-full border border-muted flex items-center justify-center"><div className="w-[0.5vw] h-[0.5vw] rounded-full bg-accent" /></div>
        </div>
        <div className="flex-1 grid grid-cols-[7fr_5fr] gap-[4vw] mt-[5vh] min-h-0">
          <div className="flex flex-col justify-center">
          <div className="flex gap-[1.6vw] items-baseline border-t border-[#6A8AAA]/30 py-[1.6vh]">
            <span className="font-mono text-[1.5vw] text-accent">01</span>
            <p className="font-body text-[2vw] leading-snug text-text [text-wrap:pretty]">Cel: pobierz próbki z Księżyca i sprowadź je na Ziemię</p>
          </div>
          <div className="flex gap-[1.6vw] items-baseline border-t border-[#6A8AAA]/30 py-[1.6vh]">
            <span className="font-mono text-[1.5vw] text-accent">02</span>
            <p className="font-body text-[2vw] leading-snug text-text [text-wrap:pretty]">Budżet początkowy: 400 mln USD</p>
          </div>
          <div className="flex gap-[1.6vw] items-baseline border-t border-[#6A8AAA]/30 py-[1.6vh]">
            <span className="font-mono text-[1.5vw] text-accent">03</span>
            <p className="font-body text-[2vw] leading-snug text-text [text-wrap:pretty]">Poziom: Easy</p>
          </div>
          <div className="flex gap-[1.6vw] items-baseline border-t border-[#6A8AAA]/30 py-[1.6vh]">
            <span className="font-mono text-[1.5vw] text-accent">04</span>
            <p className="font-body text-[2vw] leading-snug text-text [text-wrap:pretty]">Przygotowania: 36 miesięcy</p>
          </div>
          <div className="flex gap-[1.6vw] items-baseline border-t border-[#6A8AAA]/30 py-[1.6vh]">
            <span className="font-mono text-[1.5vw] text-accent">05</span>
            <p className="font-body text-[2vw] leading-snug text-text [text-wrap:pretty]">Planowany czas misji kosmicznej: 4 tygodnie</p>
          </div>
          </div>
          <div className="flex flex-col justify-center">
            <svg viewBox="0 0 400 260" className="w-full h-auto">
              <circle cx="60" cy="200" r="38" fill="#2E5A8A" />
              <circle cx="340" cy="60" r="22" fill="#C9CED6" />
              <path d="M95 185 Q 200 20 320 55" fill="none" stroke="#F2A65A" strokeWidth="3" strokeDasharray="8 6" />
              <path d="M325 82 Q 260 230 98 210" fill="none" stroke="#6A8AAA" strokeWidth="3" strokeDasharray="8 6" />
            </svg>
            <div className="flex justify-between font-mono text-[1.5vw] text-muted mt-[1vh]"><span>ZIEMIA</span><span className="text-accent">→ KSIĘŻYC →</span><span>ZIEMIA</span></div>
          </div>
        </div>
        <div className="mt-auto flex justify-between items-end font-mono text-[1.5vw] text-muted">
          <span>MISSION: INFINITY</span>
          <span className="text-text">06</span>
        </div>
      </div>
    </div>
  );
}
