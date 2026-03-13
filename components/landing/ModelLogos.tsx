export function ModelLogos() {
  return (
    <div className="py-20 border-y border-white/5 bg-[#0B1121]/50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 text-center">
        <p className="text-sm font-semibold tracking-widest text-slate-500 uppercase mb-10">
          Works with Industry Leading Models
        </p>
        <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
          {/* OpenAI */}
          <div className="flex items-center gap-2 group hover:opacity-100 transition-opacity">
            <span className="font-sans font-bold text-xl text-white">OpenAI</span>
          </div>

          {/* Anthropic */}
          <div className="flex items-center gap-2 group hover:opacity-100 transition-opacity">
            <span className="font-serif font-semibold text-xl text-white">Anthropic</span>
          </div>

          {/* Mistral AI */}
          <div className="flex items-center gap-2 group hover:opacity-100 transition-opacity">
            <span className="font-mono font-bold text-xl text-white">Mistral AI</span>
          </div>

          {/* Meta Llama */}
          <div className="flex items-center gap-2 group hover:opacity-100 transition-opacity">
            <span className="font-sans font-black text-xl text-white italic">Meta Llama</span>
          </div>
        </div>
      </div>
    </div>
  );
}
