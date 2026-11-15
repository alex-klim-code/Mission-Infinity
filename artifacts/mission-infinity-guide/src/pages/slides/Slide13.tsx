import falcon from '@assets/Rakieta_Falcon_Heavy_z_logo_NASA_1794665533122.png';
const base = import.meta.env.BASE_URL;

export default function Slide13() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text">
      <div className="absolute inset-0 px-[6vw] pt-[7vh] pb-[6vh] flex flex-col">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-[1vh]">
            <span className="font-mono text-[1.5vw] tracking-[0.12em] text-muted">ETAP 3 · PALIWO</span>
            <h2 className="font-display text-[3.8vw] leading-[1.05] font-medium tracking-tight [text-wrap:balance] max-w-[70vw]">Etap 3: masa i paliwo mają znaczenie</h2>
          </div>
          <div className="w-[2.5vw] h-[2.5vw] rounded-full border border-muted flex items-center justify-center"><div className="w-[0.5vw] h-[0.5vw] rounded-full bg-accent" /></div>
        </div>
        <div className="flex-1 grid grid-cols-[7fr_5fr] gap-[4vw] mt-[5vh] min-h-0">
          <div className="flex flex-col justify-center">
          <div className="flex gap-[1.6vw] items-baseline border-t border-[#6A8AAA]/30 py-[1.6vh]">
            <span className="font-mono text-[1.5vw] text-accent">01</span>
            <p className="font-body text-[2.1vw] leading-snug text-text [text-wrap:pretty]">Pojemność ładunkowa zmienia się wraz z konfiguracją rakiety</p>
          </div>
          <div className="flex gap-[1.6vw] items-baseline border-t border-[#6A8AAA]/30 py-[1.6vh]">
            <span className="font-mono text-[1.5vw] text-accent">02</span>
            <p className="font-body text-[2.1vw] leading-snug text-text [text-wrap:pretty]">Sprawdzaj masę ładunku, zapas pojemności i parametry lotu</p>
          </div>
          <div className="flex gap-[1.6vw] items-baseline border-t border-[#6A8AAA]/30 py-[1.6vh]">
            <span className="font-mono text-[1.5vw] text-accent">03</span>
            <p className="font-body text-[2.1vw] leading-snug text-text [text-wrap:pretty]">W Fuel Loading Station wybierz i załaduj paliwo</p>
          </div>
          <div className="flex gap-[1.6vw] items-baseline border-t border-[#6A8AAA]/30 py-[1.6vh]">
            <span className="font-mono text-[1.5vw] text-accent">04</span>
            <p className="font-body text-[2.1vw] leading-snug text-text [text-wrap:pretty]">Zaplanuj zapas na lądowanie i powrót, nie tylko na start</p>
          </div>
          </div>
          <div className="flex items-end justify-center gap-[3vw] pb-[2vh]">
            <img src={falcon} crossOrigin="anonymous" alt="Rakieta przy tankowaniu" className="h-[52vh] w-auto object-contain" />
            <div className="flex flex-col items-center gap-[1vh]">
              <span className="font-display text-[4vw] font-bold text-accent">72%</span>
              <div className="w-[3.5vw] h-[38vh] border border-muted flex flex-col justify-end"><div className="h-[72%] bg-accent" /></div>
              <span className="font-mono text-[1.5vw] text-muted">PALIWO · przykład</span>
            </div>
          </div>
        </div>
        <div className="mt-auto flex justify-between items-end font-mono text-[1.5vw] text-muted">
          <span>MISSION: INFINITY</span>
          <span className="text-text">13</span>
        </div>
      </div>
    </div>
  );
}
