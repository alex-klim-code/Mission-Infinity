const base = import.meta.env.BASE_URL;

export default function Slide2() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text">
      <img src={`${base}img/earth-orbit.png`} crossOrigin="anonymous" alt="" className="absolute inset-0 w-full h-full object-cover" style={{opacity:0.25}} />
      <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/90 to-bg/30" />
      <div className="absolute inset-0 px-[6vw] pt-[7vh] pb-[6vh] flex flex-col">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-[1vh]">
            <span className="font-mono text-[1.5vw] tracking-[0.12em] text-muted">O GRZE</span>
            <h2 className="font-display text-[3.8vw] leading-[1.05] font-medium tracking-tight [text-wrap:balance] max-w-[70vw]">Twoje decyzje tworzą misję</h2>
          </div>
          <div className="w-[2.5vw] h-[2.5vw] rounded-full border border-muted flex items-center justify-center"><div className="w-[0.5vw] h-[0.5vw] rounded-full bg-accent" /></div>
        </div>
        <div className="flex-1 grid grid-cols-[7fr_5fr] gap-[4vw] mt-[5vh] min-h-0">
          <div className="flex flex-col justify-center">
          <div className="flex gap-[1.6vw] items-baseline border-t border-[#6A8AAA]/30 py-[1.6vh]">
            <span className="font-mono text-[1.5vw] text-accent">01</span>
            <p className="font-body text-[2.1vw] leading-snug text-text [text-wrap:pretty]">Edukacyjna gra kosmiczna w przeglądarce</p>
          </div>
          <div className="flex gap-[1.6vw] items-baseline border-t border-[#6A8AAA]/30 py-[1.6vh]">
            <span className="font-mono text-[1.5vw] text-accent">02</span>
            <p className="font-body text-[2.1vw] leading-snug text-text [text-wrap:pretty]">Graj solo lub w załodze do czterech osób</p>
          </div>
          <div className="flex gap-[1.6vw] items-baseline border-t border-[#6A8AAA]/30 py-[1.6vh]">
            <span className="font-mono text-[1.5vw] text-accent">03</span>
            <p className="font-body text-[2.1vw] leading-snug text-text [text-wrap:pretty]">Łącz budowę, zarządzanie budżetem i eksplorację</p>
          </div>
          <div className="flex gap-[1.6vw] items-baseline border-t border-[#6A8AAA]/30 py-[1.6vh]">
            <span className="font-mono text-[1.5vw] text-accent">04</span>
            <p className="font-body text-[2.1vw] leading-snug text-text [text-wrap:pretty]">Celem jest nie tylko dolecieć, ale też bezpiecznie wrócić</p>
          </div>
          </div>
          <div className="flex flex-col justify-center items-start bg-accent text-bg px-[4vw]">
            <span className="font-display text-[14vw] leading-none font-bold tracking-tighter">1–4</span>
            <span className="font-mono text-[1.8vw] tracking-[0.1em] mt-[2vh]">GRACZY W JEDNEJ ZAŁODZE</span>
          </div>
        </div>
        <div className="mt-auto flex justify-between items-end font-mono text-[1.5vw] text-muted">
          <span>MISSION: INFINITY</span>
          <span className="text-text">02</span>
        </div>
      </div>
    </div>
  );
}
