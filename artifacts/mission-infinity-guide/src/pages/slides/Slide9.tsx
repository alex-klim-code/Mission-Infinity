const base = import.meta.env.BASE_URL;

export default function Slide9() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text">
      <div className="absolute inset-0 px-[6vw] pt-[7vh] pb-[6vh] flex flex-col">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-[1vh]">
            <span className="font-mono text-[1.5vw] tracking-[0.12em] text-muted">ETAP 1 · OBUDOWA</span>
            <h2 className="font-display text-[3.8vw] leading-[1.05] font-medium tracking-tight [text-wrap:balance] max-w-[70vw]">Wybierz obudowę</h2>
          </div>
          <div className="w-[2.5vw] h-[2.5vw] rounded-full border border-muted flex items-center justify-center"><div className="w-[0.5vw] h-[0.5vw] rounded-full bg-accent" /></div>
        </div>
        <figure className="flex-1 flex flex-col items-center justify-center gap-[1.2vh] mt-[3vh] min-h-0">
          <div className="border border-muted/40 bg-[#0E1426] shadow-2xl h-[47vh]"><img src={`${base}screens/35-rocket-body-three-hulls.jpg`} crossOrigin="anonymous" alt="Zrzut ekranu z gry: wybór obudowy rakiety" className="block h-full w-auto" /></div>
          <figcaption className="font-mono text-[1.5vw] text-muted">Zrzut ekranu z gry · wybór obudowy rakiety</figcaption>
        </figure>
        <p className="font-body text-[2vw] text-text/80 mt-[2vh] text-center">Zakup obudowy obciąża wspólny budżet misji</p>
        <div className="mt-auto flex justify-between items-end font-mono text-[1.5vw] text-muted">
          <span>MISSION: INFINITY</span>
          <span className="text-text">09</span>
        </div>
      </div>
    </div>
  );
}
