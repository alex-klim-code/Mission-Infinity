import falcon from '@assets/Rakieta_Falcon_Heavy_z_logo_NASA_1794665533122.png';
import sls from '@assets/Rakieta_SLS_z_kapsułą_Orion-1_1794665576898.png';
import blue from '@assets/Rakieta_Blue_Origin_z_silnikami-2_1794665581450.png';
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
        <div className="grid grid-cols-3 gap-[2vw] mt-[4vh]">
          <div className="flex flex-col items-center gap-[1.2vh] bg-[#0E1426] pt-[2vh] pb-[2vh]"><img src={falcon} crossOrigin="anonymous" alt="Falcon Shadow" className="h-[40vh] w-auto object-contain" /><span className="font-display text-[2.2vw] font-medium">Falcon Shadow</span><span className="font-mono text-[1.8vw] text-accent">50 mln USD</span></div>
          <div className="flex flex-col items-center gap-[1.2vh] bg-[#0E1426] pt-[2vh] pb-[2vh]"><img src={sls} crossOrigin="anonymous" alt="Titan Explorer" className="h-[40vh] w-auto object-contain" /><span className="font-display text-[2.2vw] font-medium">Titan Explorer</span><span className="font-mono text-[1.8vw] text-accent">60 mln USD</span></div>
          <div className="flex flex-col items-center gap-[1.2vh] bg-[#0E1426] pt-[2vh] pb-[2vh]"><img src={blue} crossOrigin="anonymous" alt="Nova Prime" className="h-[40vh] w-auto object-contain" /><span className="font-display text-[2.2vw] font-medium">Nova Prime</span><span className="font-mono text-[1.8vw] text-accent">90 mln USD</span></div>
        </div>
        <p className="font-body text-[2vw] text-text/80 mt-[2.4vh]">Zakup obudowy obciąża wspólny budżet misji</p>
        <div className="mt-auto flex justify-between items-end font-mono text-[1.5vw] text-muted">
          <span>MISSION: INFINITY</span>
          <span className="text-text">09</span>
        </div>
      </div>
    </div>
  );
}
