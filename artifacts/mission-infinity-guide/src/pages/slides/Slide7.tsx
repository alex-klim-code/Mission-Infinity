import grad from '@assets/Graduacja_przed_Politechniką_Warszawską_1794662243160.png';
import offer from '@assets/Oficjalna_oferta_stażu_w_NASA_1794662575124.png';
import nasa from '@assets/NASA__Inżynieria_misji_kosmicznej_1794662658308.png';
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
        <div className="grid grid-cols-3 gap-[2vw] mt-[4vh]">
            <figure className="flex flex-col gap-[1.2vh] min-h-0"><img src={grad} crossOrigin="anonymous" alt="Graduation Day" className="w-full h-[30vh] object-cover" /><figcaption className="font-mono text-[1.5vw] text-muted">Graduation Day</figcaption></figure>
            <figure className="flex flex-col gap-[1.2vh] min-h-0"><img src={offer} crossOrigin="anonymous" alt="Oferta udziału" className="w-full h-[30vh] object-cover" /><figcaption className="font-mono text-[1.5vw] text-muted">Oferta udziału</figcaption></figure>
            <figure className="flex flex-col gap-[1.2vh] min-h-0"><img src={nasa} crossOrigin="anonymous" alt="Praca przy misji" className="w-full h-[30vh] object-cover" /><figcaption className="font-mono text-[1.5vw] text-muted">Praca przy misji</figcaption></figure>
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
