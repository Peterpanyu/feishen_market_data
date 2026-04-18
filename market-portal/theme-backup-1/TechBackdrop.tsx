/** 全站背景光晕与网格（纯展示，pointer-events-none） */
export function TechBackdrop() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden>
      <div className="absolute inset-0 bg-[var(--bg-deep)]" />
      <div className="absolute inset-0 tech-bg-grid opacity-90" />
      <div
        className="absolute top-[-15%] right-[-10%] h-[min(70vw,520px)] w-[min(70vw,520px)] rounded-full bg-cyan-500/15 blur-[100px] animate-orb-1"
        style={{ animationDelay: "-3s" }}
      />
      <div
        className="absolute bottom-[-20%] left-[-15%] h-[min(80vw,600px)] w-[min(80vw,600px)] rounded-full bg-violet-600/12 blur-[110px] animate-orb-2"
        style={{ animationDelay: "-5s" }}
      />
      <div className="absolute top-1/2 left-1/2 h-[40vh] w-[90vw] max-w-4xl -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/5 blur-[80px]" />
    </div>
  );
}
