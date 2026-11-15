const base = import.meta.env.BASE_URL;

export default function Slide12() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text">
      <div className="absolute inset-0 px-[6vw] pt-[7vh] pb-[6vh] flex flex-col">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-[1vh]">
            <span className="font-mono text-[1.5vw] tracking-[0.12em] text-muted">ETAP 2 · INSTRUMENTY</span>
            <h2 className="font-display text-[3.8vw] leading-[1.05] font-medium tracking-tight [text-wrap:balance] max-w-[70vw]">Etap 2: dobierz sprzęt naukowy</h2>
          </div>
          <div className="w-[2.5vw] h-[2.5vw] rounded-full border border-muted flex items-center justify-center"><div className="w-[0.5vw] h-[0.5vw] rounded-full bg-accent" /></div>
        </div>
        <div className="flex-1 grid grid-cols-[7fr_5fr] gap-[4vw] mt-[5vh] min-h-0">
          <div className="flex flex-col justify-center">
          <div className="flex gap-[1.6vw] items-baseline border-t border-[#6A8AAA]/30 py-[1.6vh]">
            <span className="font-mono text-[1.5vw] text-accent">01</span>
            <p className="font-body text-[2vw] leading-snug text-text [text-wrap:pretty]">Zapewnij kamerę, system pobierania próbek i pojemnik na próbki</p>
          </div>
          <div className="flex gap-[1.6vw] items-baseline border-t border-[#6A8AAA]/30 py-[1.6vh]">
            <span className="font-mono text-[1.5vw] text-accent">02</span>
            <p className="font-body text-[2vw] leading-snug text-text [text-wrap:pretty]">Odpowiedni sprzęt z Rocket Builder jest zaliczany bez ponownej opłaty</p>
          </div>
          <div className="flex gap-[1.6vw] items-baseline border-t border-[#6A8AAA]/30 py-[1.6vh]">
            <span className="font-mono text-[1.5vw] text-accent">03</span>
            <p className="font-body text-[2vw] leading-snug text-text [text-wrap:pretty]">Dodaj opcjonalne instrumenty do badań Księżyca</p>
          </div>
          <div className="flex gap-[1.6vw] items-baseline border-t border-[#6A8AAA]/30 py-[1.6vh]">
            <span className="font-mono text-[1.5vw] text-accent">04</span>
            <p className="font-body text-[2vw] leading-snug text-text [text-wrap:pretty]">Sprawdź zestaw i zatwierdź Purchase</p>
          </div>
          <div className="flex gap-[1.6vw] items-baseline border-t border-[#6A8AAA]/30 py-[1.6vh]">
            <span className="font-mono text-[1.5vw] text-accent">05</span>
            <p className="font-body text-[2vw] leading-snug text-text [text-wrap:pretty]">Więcej instrumentów oznacza większy koszt i masę</p>
          </div>
          </div>
          <div className="relative overflow-hidden"><img src={`${base}img/laboratory.png`} crossOrigin="anonymous" alt="Laboratorium misji" className="absolute inset-0 w-full h-full object-cover" /></div>
        </div>
        <div className="mt-auto flex justify-between items-end font-mono text-[1.5vw] text-muted">
          <span>MISSION: INFINITY</span>
          <span className="text-text">12</span>
        </div>
      </div>
    </div>
  );
}
