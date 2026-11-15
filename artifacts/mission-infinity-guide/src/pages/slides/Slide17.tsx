const base = import.meta.env.BASE_URL;

export default function Slide17() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text">
      <img src={`${base}img/lunar.png`} crossOrigin="anonymous" alt="" className="absolute inset-0 w-full h-full object-cover" style={{opacity:0.3}} />
      <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/90 to-bg/30" />
      <div className="absolute inset-0 px-[6vw] pt-[7vh] pb-[6vh] flex flex-col">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-[1vh]">
            <span className="font-mono text-[1.5vw] tracking-[0.12em] text-muted">POWRÓT</span>
            <h2 className="font-display text-[3.8vw] leading-[1.05] font-medium tracking-tight [text-wrap:balance] max-w-[70vw]">Sprawdź, czy możesz wrócić</h2>
          </div>
          <div className="w-[2.5vw] h-[2.5vw] rounded-full border border-muted flex items-center justify-center"><div className="w-[0.5vw] h-[0.5vw] rounded-full bg-accent" /></div>
        </div>
        <div className="flex-1 grid grid-cols-[7fr_5fr] gap-[4vw] mt-[5vh] min-h-0">
          <div className="flex flex-col justify-center">
          <div className="flex gap-[1.6vw] items-baseline border-t border-[#6A8AAA]/30 py-[1.6vh]">
            <span className="font-mono text-[1.5vw] text-accent">01</span>
            <p className="font-body text-[2.1vw] leading-snug text-text [text-wrap:pretty]">Przed odlotem przeprowadź kontrolę sprzętu</p>
          </div>
          <div className="flex gap-[1.6vw] items-baseline border-t border-[#6A8AAA]/30 py-[1.6vh]">
            <span className="font-mono text-[1.5vw] text-accent">02</span>
            <p className="font-body text-[2.1vw] leading-snug text-text [text-wrap:pretty]">Uszkodzenie ważnego elementu może uniemożliwić powrót</p>
          </div>
          <div className="flex gap-[1.6vw] items-baseline border-t border-[#6A8AAA]/30 py-[1.6vh]">
            <span className="font-mono text-[1.5vw] text-accent">03</span>
            <p className="font-body text-[2.1vw] leading-snug text-text [text-wrap:pretty]">Sprawdź paliwo potrzebne do drogi na Ziemię</p>
          </div>
          <div className="flex gap-[1.6vw] items-baseline border-t border-[#6A8AAA]/30 py-[1.6vh]">
            <span className="font-mono text-[1.5vw] text-accent">04</span>
            <p className="font-body text-[2.1vw] leading-snug text-text [text-wrap:pretty]">Nie każda próba kończy się odzyskaniem próbek</p>
          </div>
          </div>
          <div className="flex flex-col justify-center">
            <svg viewBox="0 0 400 260" className="w-full h-auto">
              <circle cx="80" cy="60" r="30" fill="#C9CED6" />
              <circle cx="330" cy="200" r="50" fill="#2E5A8A" />
              <path d="M110 70 Q 300 60 300 160" fill="none" stroke="#6A8AAA" strokeWidth="4" strokeDasharray="10 7" />
              <circle cx="255" cy="85" r="8" fill="#F2A65A" />
            </svg>
            <span className="font-mono text-[1.5vw] text-muted mt-[1vh]">KSIĘŻYC → ZIEMIA</span>
          </div>
        </div>
        <div className="mt-auto flex justify-between items-end font-mono text-[1.5vw] text-muted">
          <span>MISSION: INFINITY</span>
          <span className="text-text">17</span>
        </div>
      </div>
    </div>
  );
}
