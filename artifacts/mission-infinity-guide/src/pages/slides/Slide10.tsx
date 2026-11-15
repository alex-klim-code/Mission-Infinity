const base = import.meta.env.BASE_URL;

export default function Slide10() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text">
      <div className="absolute inset-0 px-[6vw] pt-[7vh] pb-[6vh] flex flex-col">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-[1vh]">
            <span className="font-mono text-[1.5vw] tracking-[0.12em] text-muted">ETAP 1 · RYZYKO</span>
            <h2 className="font-display text-[3.8vw] leading-[1.05] font-medium tracking-tight [text-wrap:balance] max-w-[70vw]">Jakość, zgodność i ryzyko</h2>
          </div>
          <div className="w-[2.5vw] h-[2.5vw] rounded-full border border-muted flex items-center justify-center"><div className="w-[0.5vw] h-[0.5vw] rounded-full bg-accent" /></div>
        </div>
        <div className="flex-1 grid grid-cols-[7fr_5fr] gap-[4vw] mt-[5vh] min-h-0">
          <div className="flex flex-col justify-center">
          <div className="flex gap-[1.6vw] items-baseline border-t border-[#6A8AAA]/30 py-[1.6vh]">
            <span className="font-mono text-[1.5vw] text-accent">01</span>
            <p className="font-body text-[2.1vw] leading-snug text-text [text-wrap:pretty]">Porównuj cenę, masę i jakość części</p>
          </div>
          <div className="flex gap-[1.6vw] items-baseline border-t border-[#6A8AAA]/30 py-[1.6vh]">
            <span className="font-mono text-[1.5vw] text-accent">02</span>
            <p className="font-body text-[2.1vw] leading-snug text-text [text-wrap:pretty]">Przed ryzykownym zakupem przeczytaj ostrzeżenie o niezgodności</p>
          </div>
          <div className="flex gap-[1.6vw] items-baseline border-t border-[#6A8AAA]/30 py-[1.6vh]">
            <span className="font-mono text-[1.5vw] text-accent">03</span>
            <p className="font-body text-[2.1vw] leading-snug text-text [text-wrap:pretty]">Wyższa jakość zmniejsza ryzyko uszkodzenia, ale nie usuwa go całkowicie</p>
          </div>
          <div className="flex gap-[1.6vw] items-baseline border-t border-[#6A8AAA]/30 py-[1.6vh]">
            <span className="font-mono text-[1.5vw] text-accent">04</span>
            <p className="font-body text-[2.1vw] leading-snug text-text [text-wrap:pretty]">Sprawdzaj powiadomienia i zostaw rezerwę na dalsze etapy</p>
          </div>
          </div>
          <div className="flex flex-col justify-center gap-[3vh]">
            <div className="flex flex-col gap-[1vh]"><span className="font-mono text-[1.5vw] text-muted">CENA</span><div className="h-[2vh] w-[80%] bg-muted/60" /></div>
            <div className="flex flex-col gap-[1vh]"><span className="font-mono text-[1.5vw] text-muted">MASA</span><div className="h-[2vh] w-[55%] bg-muted/60" /></div>
            <div className="flex flex-col gap-[1vh]"><span className="font-mono text-[1.5vw] text-muted">JAKOŚĆ</span><div className="h-[2vh] w-[90%] bg-accent" /></div>
            <div className="flex flex-col gap-[1vh]"><span className="font-mono text-[1.5vw] text-muted">RYZYKO</span><div className="h-[2vh] w-[18%] bg-[#E0675A]" /></div>
            <span className="font-mono text-[1.5vw] text-muted/80">Schemat poglądowy</span>
          </div>
        </div>
        <div className="mt-auto flex justify-between items-end font-mono text-[1.5vw] text-muted">
          <span>MISSION: INFINITY</span>
          <span className="text-text">10</span>
        </div>
      </div>
    </div>
  );
}
