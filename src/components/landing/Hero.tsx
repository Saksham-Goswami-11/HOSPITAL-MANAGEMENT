
import React from 'react';
import ReactGA from "react-ga4";

const Hero: React.FC = () => {
  return (
    <div className="relative bg-white pt-24 pb-16 lg:pt-32 lg:pb-24 overflow-hidden border-b border-slate-100">
      {/* Background patterns */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-1/4 w-72 md:w-96 h-72 md:h-96 bg-primary/15 rounded-full filter blur-[100px] animate-pulse duration-[4000ms]"></div>
        <div className="absolute bottom-0 right-1/4 w-72 md:w-96 h-72 md:h-96 bg-cyan-400/15 rounded-full filter blur-[100px] animate-pulse duration-[5000ms]"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="text-left z-10 relative">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-slate-900 leading-tight mb-4 md:mb-6 tracking-tight">
              Welcome to MedFlow:<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-blue-500 to-cyan-400 pb-2 inline-block">
                Healthcare Operations, Reimagined.
              </span>
            </h1>
            <p className="text-lg md:text-xl text-slate-600 mb-8 max-w-xl font-medium">
              Seamlessly Integrating Clinic and Hospital Management for Better Patient Outcomes. Empowering providers with data-driven workflows and real-time operational visibility.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button
                onClick={() => ReactGA.event({
                  category: "Lead Generation",
                  action: "Clicked Request Demo",
                })}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl text-lg font-bold shadow-lg shadow-blue-600/30 transition-all hover:-translate-y-1 w-full sm:w-auto text-center"
              >
                Request a Demo
              </button>
              <button
                onClick={() => {
                  const el = document.getElementById('offers');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="bg-white hover:bg-slate-50 border-2 border-slate-200 text-slate-700 hover:text-primary hover:border-primary/50 px-8 py-4 rounded-2xl text-lg font-bold shadow-sm transition-all hover:-translate-y-1 w-full sm:w-auto text-center"
              >
                Learn More
              </button>
            </div>
          </div>

          <div className="relative group flex justify-center lg:justify-end mt-16 lg:mt-0 z-10 transition-transform duration-700 hover:-translate-y-2">
            <div className="relative w-full max-w-xl aspect-[16/10] rounded-3xl overflow-hidden shadow-2xl shadow-primary/20 border-4 border-white/50 bg-white">
              <div className="absolute inset-0 pointer-events-none"></div>

              {/* Dashboard Preview Image */}
              <img
                src="https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=1200"
                alt="MedFlow Dashboard Preview"
                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110 opacity-90"
              />

              {/* Light Overlays */}
              <div className="absolute inset-0 bg-gradient-to-tr from-white/40 via-transparent to-primary/5 z-10 mix-blend-overlay"></div>

              <div className="absolute top-6 right-6 z-20">
                <div className="bg-white px-4 py-2 rounded-lg border border-slate-100 shadow-sm flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                  <span className="text-slate-800 text-[10px] font-bold tracking-widest uppercase">System Live</span>
                </div>
              </div>

              <div className="absolute bottom-6 left-6 right-6 z-20">
                <div className="bg-white p-4 sm:p-6 rounded-xl border border-slate-100 shadow-xl">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-slate-900 font-bold">Operational Efficiency</p>
                    <span className="text-primary font-mono font-bold text-sm">+24.8%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className="w-3/4 h-full bg-gradient-to-r from-primary to-blue-400 rounded-full"></div>
                  </div>
                  <div className="mt-4 flex justify-between items-center">
                    <div className="flex -space-x-2">
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-blue-100 flex items-center justify-center text-xs text-blue-700 font-bold">
                          {String.fromCharCode(64 + i)}
                        </div>
                      ))}
                    </div>
                    <p className="text-slate-500 font-medium text-[11px]">MedFlow Unified Dashboard</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;
