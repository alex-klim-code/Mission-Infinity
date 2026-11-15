const base = import.meta.env.BASE_URL;

export default function Slide7() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text">
      <div className="absolute inset-0 px-[6vw] pt-[7vh] pb-[6vh] flex flex-col">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-[1vh]">
            <span className="font-mono text-[1.5vw] tracking-[0.12em] text-muted">WPROWADZENIE</span>
            <h2 className="font-display text-[3.8vw] leading-[1.05] font-medium tracking-tight [text-wrap:balance] max-w-[70vw]">Od Graduation Day do Start Mission</h2>
          </div>
          <div className="w-[2.5vw] h-[2.5vw] rounded-full border border-muted flex items-center justify-center"><div className="w-[0.5vw] h-[0.5vw] rounded-full bg-accent" /></div>
        </div>
        <div className="grid grid-cols-2 gap-[3vw] mt-[3vh]">
            <figure className="flex flex-col gap-[1vh] min-h-0"><div className="border border-muted/40 bg-[#0E1426] shadow-2xl"><img src={`${base}screens/17-graduation-day.jpg`} crossOrigin="anonymous" alt="Zrzut ekranu z gry: Graduation Day" className="block w-full h-[33vh] object-cover object-top" /></div><figcaption className="font-mono text-[1.5vw] text-muted">Zrzut ekranu z gry · Graduation Day</figcaption></figure>
            <figure className="flex flex-col gap-[1vh] min-h-0"><div className="border border-muted/40 bg-[#0E1426] shadow-2xl"><img src={`${base}screens/18-start-mission.jpg`} crossOrigin="anonymous" alt="Zrzut ekranu z gry: Start Mission" className="block w-full h-[33vh] object-cover object-top" /></div><figcaption className="font-mono text-[1.5vw] text-muted">Zrzut ekranu z gry · Start Mission</figcaption></figure>
        </div>
        <div className="grid grid-cols-2 gap-x-[4vw] mt-[2vh]">
          <div className="flex gap-[1.6vw] items-baseline border-t border-[#6A8AAA]/30 py-[1.2vh]">
            <span className="font-mono text-[1.5vw] text-accent">01</span>
            <p className="font-body text-[2vw] leading-snug text-text [text-wrap:pretty]">Poznaj historię bohatera i ofertę udziału w programie</p>
          </div>
          <div className="flex gap-[1.6vw] items-baseline border-t border-[#6A8AAA]/30 py-[1.2vh]">
            <span className="font-mono text-[1.5vw] text-accent">02</span>
            <p className="font-body text-[2vw] leading-snug text-text [text-wrap:pretty]">Zapoznaj się z opisem misji i swoją załogą</p>
          </div>
          <div className="flex gap-[1.6vw] items-baseline border-t border-[#6A8AAA]/30 py-[1.2vh]">
            <span className="font-mono text-[1.5vw] text-accent">03</span>
            <p className="font-body text-[2vw] leading-snug text-text [text-wrap:pretty]">Skip Introduction przenosi lidera prosto do Start Mission</p>
          </div>
          <div className="flex gap-[1.6vw] items-baseline border-t border-[#6A8AAA]/30 py-[1.2vh]">
            <span className="font-mono text-[1.5vw] text-accent">04</span>
            <p className="font-body text-[2vw] leading-snug text-text [text-wrap:pretty]">Załoga zgłasza gotowość; lider rozpoczyna misję</p>
          </div>
        </div>
        <div className="mt-auto flex justify-between items-end font-mono text-[1.5vw] text-muted">
          <span>MISSION: INFINITY</span>
          <span className="text-text">07</span>
        </div>
      </div>
    </div>
  );
}
