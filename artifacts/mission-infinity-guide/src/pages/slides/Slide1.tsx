const base = import.meta.env.BASE_URL;

export default function Slide1() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text">
      <img src={`${base}img/astronaut-space.png`} crossOrigin="anonymous" alt="Astronauta w kosmosie" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,transparent_45%,rgba(5,5,15,0.7)_60%,rgba(5,5,15,0.9)_100%)]" />
      <div className="absolute top-0 right-0 w-[48vw] h-screen flex flex-col px-[6vw] py-[8vh]">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-[1vh]">
            <span className="font-mono text-[1.5vw] tracking-[0.12em] text-muted">ASTERION AEROSPACE</span>
            <span className="font-mono text-[1.5vw] text-text">MISJA: LUNA</span>
          </div>
          <div className="w-[2.5vw] h-[2.5vw] rounded-full border border-muted flex items-center justify-center"><div className="w-[0.5vw] h-[0.5vw] rounded-full bg-accent" /></div>
        </div>
        <div className="my-auto">
          <h1 className="font-display text-[6.2vw] leading-none font-medium tracking-tight mb-[4vh]">Mission: Infinity</h1>
          <p className="font-body text-[2.1vw] leading-snug text-text/80 max-w-[34vw] [text-wrap:pretty]">Zbuduj rakietę. Poprowadź załogę. Przywieź próbki z Księżyca.</p>
        </div>
        <div className="flex justify-between items-end">
          <span className="font-mono text-[1.5vw] text-muted">ZIEMIA → KSIĘŻYC → ZIEMIA</span>
          <span className="font-serif italic text-[1.6vw] text-text">Ad astra</span>
        </div>
      </div>
    </div>
  );
}
