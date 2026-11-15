const base = import.meta.env.BASE_URL;

export default function Slide1() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(106,138,170,0.18)_0%,transparent_60%)]" />
      <figure className="absolute left-[5vw] top-[50%] -translate-y-1/2 w-[54vw] flex flex-col gap-[1.4vh]">
        <div className="border border-muted/40 bg-[#0E1426] shadow-2xl"><img src={`${base}screens/01-home-landing.jpg`} crossOrigin="anonymous" alt="Zrzut ekranu z gry: ekran startowy Mission: Infinity" className="block w-full h-auto" /></div>
        <figcaption className="font-mono text-[1.5vw] text-muted">Zrzut ekranu z gry · ekran startowy</figcaption>
      </figure>
      <div className="absolute top-0 right-0 w-[38vw] h-screen flex flex-col pl-[2vw] pr-[5vw] py-[8vh]">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-[1vh]">
            <span className="font-mono text-[1.5vw] tracking-[0.12em] text-muted">ASTERION AEROSPACE</span>
            <span className="font-mono text-[1.5vw] text-text">MISJA: LUNA</span>
          </div>
          <div className="w-[2.5vw] h-[2.5vw] rounded-full border border-muted flex items-center justify-center"><div className="w-[0.5vw] h-[0.5vw] rounded-full bg-accent" /></div>
        </div>
        <div className="my-auto">
          <h1 className="font-display text-[5.2vw] leading-none font-medium tracking-tight mb-[4vh]">Mission: Infinity</h1>
          <p className="font-body text-[2.1vw] leading-snug text-text/80 max-w-[31vw] [text-wrap:pretty]">Zbuduj rakietę. Poprowadź załogę. Przywieź próbki z Księżyca.</p>
        </div>
        <div className="flex flex-col gap-[2vh]">
          <div className="flex justify-between items-end">
            <span className="font-mono text-[1.5vw] text-muted">ZIEMIA → KSIĘŻYC → ZIEMIA</span>
            <span className="font-serif italic text-[1.6vw] text-text">Ad astra</span>
          </div>
        </div>
      </div>
    </div>
  );
}
