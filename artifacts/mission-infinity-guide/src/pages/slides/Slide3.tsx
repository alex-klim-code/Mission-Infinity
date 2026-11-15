const base = import.meta.env.BASE_URL;

export default function Slide3() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text">
      <div className="absolute inset-0 px-[6vw] pt-[7vh] pb-[6vh] flex flex-col">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-[1vh]">
            <span className="font-mono text-[1.5vw] tracking-[0.12em] text-muted">KROK 0 · POSTAĆ</span>
            <h2 className="font-display text-[3.8vw] leading-[1.05] font-medium tracking-tight [text-wrap:balance] max-w-[70vw]">Zacznij od swojej postaci</h2>
          </div>
          <div className="w-[2.5vw] h-[2.5vw] rounded-full border border-muted flex items-center justify-center"><div className="w-[0.5vw] h-[0.5vw] rounded-full bg-accent" /></div>
        </div>
        <div className="flex-1 grid grid-cols-[7fr_5fr] gap-[4vw] mt-[5vh] min-h-0">
          <div className="flex flex-col justify-center">
          <div className="flex gap-[1.6vw] items-baseline border-t border-[#6A8AAA]/30 py-[1.6vh]">
            <span className="font-mono text-[1.5vw] text-accent">01</span>
            <p className="font-body text-[2.1vw] leading-snug text-text [text-wrap:pretty]">Zaloguj się przez dostępnego dostawcę na ekranie logowania</p>
          </div>
          <div className="flex gap-[1.6vw] items-baseline border-t border-[#6A8AAA]/30 py-[1.6vh]">
            <span className="font-mono text-[1.5vw] text-accent">02</span>
            <p className="font-body text-[2.1vw] leading-snug text-text [text-wrap:pretty]">Wybierz wygląd postaci, wiek i kraj</p>
          </div>
          <div className="flex gap-[1.6vw] items-baseline border-t border-[#6A8AAA]/30 py-[1.6vh]">
            <span className="font-mono text-[1.5vw] text-accent">03</span>
            <p className="font-body text-[2.1vw] leading-snug text-text [text-wrap:pretty]">Dostosuj twarz, skórę i włosy w kreatorze wewnątrz gry</p>
          </div>
          <div className="flex gap-[1.6vw] items-baseline border-t border-[#6A8AAA]/30 py-[1.6vh]">
            <span className="font-mono text-[1.5vw] text-accent">04</span>
            <p className="font-body text-[2.1vw] leading-snug text-text [text-wrap:pretty]">Otrzymaj identyfikator Asterion Aerospace</p>
          </div>
          </div>
          <div className="flex items-center justify-center">
            <div className="w-[26vw] bg-[#0E1426] border border-muted/40 shadow-2xl">
              <div className="bg-accent text-bg font-mono text-[1.5vw] tracking-[0.12em] px-[1.6vw] py-[1.2vh]">ASTERION AEROSPACE · ID</div>
              <div className="flex gap-[1.6vw] p-[1.6vw]">
                <img src={`${base}img/portrait-03.png`} crossOrigin="anonymous" alt="Przykładowy awatar postaci" className="w-[10vw] h-[13vw] object-cover" />
                <div className="flex flex-col gap-[1.2vh] font-mono text-[1.5vw] text-muted">
                  <span>ROLA</span><span className="text-text">Inżynier misji</span>
                  <span>MISJA</span><span className="text-text">LUNA</span>
                </div>
              </div>
              <div className="px-[1.6vw] pb-[1.6vh] font-mono text-[1.5vw] text-muted/80">Ilustracja poglądowa</div>
            </div>
          </div>
        </div>
        <div className="mt-auto flex justify-between items-end font-mono text-[1.5vw] text-muted">
          <span>MISSION: INFINITY</span>
          <span className="text-text">03</span>
        </div>
      </div>
    </div>
  );
}
