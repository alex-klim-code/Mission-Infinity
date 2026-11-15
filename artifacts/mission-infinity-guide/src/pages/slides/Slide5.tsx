const base = import.meta.env.BASE_URL;

export default function Slide5() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text">
      <div className="absolute inset-0 px-[6vw] pt-[7vh] pb-[6vh] flex flex-col">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-[1vh]">
            <span className="font-mono text-[1.5vw] tracking-[0.12em] text-muted">INTERFEJS</span>
            <h2 className="font-display text-[3.8vw] leading-[1.05] font-medium tracking-tight [text-wrap:balance] max-w-[70vw]">Poznaj centrum dowodzenia</h2>
          </div>
          <div className="w-[2.5vw] h-[2.5vw] rounded-full border border-muted flex items-center justify-center"><div className="w-[0.5vw] h-[0.5vw] rounded-full bg-accent" /></div>
        </div>
        <div className="flex-1 grid grid-cols-[1fr_1fr] gap-[4vw] mt-[5vh] min-h-0">
          <div className="flex flex-col justify-center">
          <div className="flex gap-[1.6vw] items-baseline border-t border-[#6A8AAA]/30 py-[1.6vh]">
            <span className="font-mono text-[1.5vw] text-accent">01</span>
            <p className="font-body text-[2vw] leading-snug text-text [text-wrap:pretty]">U góry: etap, nazwa misji, budżet i czas</p>
          </div>
          <div className="flex gap-[1.6vw] items-baseline border-t border-[#6A8AAA]/30 py-[1.6vh]">
            <span className="font-mono text-[1.5vw] text-accent">02</span>
            <p className="font-body text-[2vw] leading-snug text-text [text-wrap:pretty]">Po lewej: wybory i działania bieżącego etapu</p>
          </div>
          <div className="flex gap-[1.6vw] items-baseline border-t border-[#6A8AAA]/30 py-[1.6vh]">
            <span className="font-mono text-[1.5vw] text-accent">03</span>
            <p className="font-body text-[2vw] leading-snug text-text [text-wrap:pretty]">Po prawej: rakieta, koszty i parametry</p>
          </div>
          <div className="flex gap-[1.6vw] items-baseline border-t border-[#6A8AAA]/30 py-[1.6vh]">
            <span className="font-mono text-[1.5vw] text-accent">04</span>
            <p className="font-body text-[2vw] leading-snug text-text [text-wrap:pretty]">Na dole: załoga, czat, powiadomienia i wniosek o środki</p>
          </div>
          </div>
          <div className="grid grid-cols-[1fr_1fr] grid-rows-[auto_1fr_auto] gap-[0.8vw] py-[2vh]">
            <div className="col-span-2 border border-muted/50 bg-[#0E1426] p-[1.4vw] flex flex-col gap-[0.6vh]"><span className="font-mono text-[1.5vw] text-accent">GÓRA</span><span className="font-body text-[1.6vw] text-text/80">Etap · misja · budżet · czas</span></div>
            <div className=" border border-muted/50 bg-[#0E1426] p-[1.4vw] flex flex-col gap-[0.6vh]"><span className="font-mono text-[1.5vw] text-accent">LEWO</span><span className="font-body text-[1.6vw] text-text/80">Wybory etapu</span></div>
            <div className=" border border-muted/50 bg-[#0E1426] p-[1.4vw] flex flex-col gap-[0.6vh]"><span className="font-mono text-[1.5vw] text-accent">PRAWO</span><span className="font-body text-[1.6vw] text-text/80">Rakieta i parametry</span></div>
            <div className="col-span-2 border border-muted/50 bg-[#0E1426] p-[1.4vw] flex flex-col gap-[0.6vh]"><span className="font-mono text-[1.5vw] text-accent">DÓŁ</span><span className="font-body text-[1.6vw] text-text/80">Załoga · czat · środki</span></div>
            <span className="col-span-2 font-mono text-[1.5vw] text-muted">Schemat poglądowy, nie zrzut ekranu</span>
          </div>
        </div>
        <div className="mt-auto flex justify-between items-end font-mono text-[1.5vw] text-muted">
          <span>MISSION: INFINITY</span>
          <span className="text-text">05</span>
        </div>
      </div>
    </div>
  );
}
