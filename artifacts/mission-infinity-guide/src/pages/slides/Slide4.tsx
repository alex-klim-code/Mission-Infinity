const base = import.meta.env.BASE_URL;

export default function Slide4() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text">
      <div className="absolute inset-0 px-[6vw] pt-[7vh] pb-[6vh] flex flex-col">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-[1vh]">
            <span className="font-mono text-[1.5vw] tracking-[0.12em] text-muted">ZAŁOGA</span>
            <h2 className="font-display text-[3.8vw] leading-[1.05] font-medium tracking-tight [text-wrap:balance] max-w-[70vw]">Jedna załoga. Wspólne decyzje.</h2>
          </div>
          <div className="w-[2.5vw] h-[2.5vw] rounded-full border border-muted flex items-center justify-center"><div className="w-[0.5vw] h-[0.5vw] rounded-full bg-accent" /></div>
        </div>
        <div className="flex-1 grid grid-cols-[7fr_5fr] gap-[4vw] mt-[5vh] min-h-0">
          <div className="flex flex-col justify-center">
          <div className="flex gap-[1.6vw] items-baseline border-t border-[#6A8AAA]/30 py-[1.6vh]">
            <span className="font-mono text-[1.5vw] text-accent">01</span>
            <p className="font-body text-[2.1vw] leading-snug text-text [text-wrap:pretty]">Założyciel sesji zostaje liderem</p>
          </div>
          <div className="flex gap-[1.6vw] items-baseline border-t border-[#6A8AAA]/30 py-[1.6vh]">
            <span className="font-mono text-[1.5vw] text-accent">02</span>
            <p className="font-body text-[2.1vw] leading-snug text-text [text-wrap:pretty]">Członkowie załogi proponują części i wybory</p>
          </div>
          <div className="flex gap-[1.6vw] items-baseline border-t border-[#6A8AAA]/30 py-[1.6vh]">
            <span className="font-mono text-[1.5vw] text-accent">03</span>
            <p className="font-body text-[2.1vw] leading-snug text-text [text-wrap:pretty]">Lider zatwierdza zakupy i przejścia etapów</p>
          </div>
          <div className="flex gap-[1.6vw] items-baseline border-t border-[#6A8AAA]/30 py-[1.6vh]">
            <span className="font-mono text-[1.5vw] text-accent">04</span>
            <p className="font-body text-[2.1vw] leading-snug text-text [text-wrap:pretty]">Czat pozwala uzgodnić plan; historia wiadomości pozostaje zapisana</p>
          </div>
          </div>
          <div className="flex flex-col items-center justify-center gap-[3vh]">
              <div className="flex flex-col items-center gap-[1vh]"><div className="w-[7vw] h-[7vw] rounded-full bg-accent text-bg flex items-center justify-center font-display text-[2.4vw] font-bold">L</div><span className="font-mono text-[1.5vw] text-muted">LIDER · ZATWIERDZA</span></div>
            <div className="w-[22vw] h-[4vh] border-t border-x border-muted/50" />
            <div className="flex gap-[3vw]">
              <div className="flex flex-col items-center gap-[1vh]"><div className="w-[7vw] h-[7vw] rounded-full border border-muted text-text flex items-center justify-center font-display text-[2.4vw] font-bold">2</div><span className="font-mono text-[1.5vw] text-muted">PROPONUJE</span></div>
              <div className="flex flex-col items-center gap-[1vh]"><div className="w-[7vw] h-[7vw] rounded-full border border-muted text-text flex items-center justify-center font-display text-[2.4vw] font-bold">3</div><span className="font-mono text-[1.5vw] text-muted">PROPONUJE</span></div>
              <div className="flex flex-col items-center gap-[1vh]"><div className="w-[7vw] h-[7vw] rounded-full border border-muted text-text flex items-center justify-center font-display text-[2.4vw] font-bold">4</div><span className="font-mono text-[1.5vw] text-muted">PROPONUJE</span></div>
            </div>
          </div>
        </div>
        <div className="mt-auto flex justify-between items-end font-mono text-[1.5vw] text-muted">
          <span>MISSION: INFINITY</span>
          <span className="text-text">04</span>
        </div>
      </div>
    </div>
  );
}
