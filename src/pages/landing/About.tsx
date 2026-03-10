import React from 'react';
import { Link } from 'react-router-dom';
import { Target, Shield, Heart } from 'lucide-react';

const About: React.FC = () => {
  return (
    <div className="pt-20 bg-white">
      {/* Hero Section */}
      <section className="bg-slate-50 py-32 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-40 pointer-events-none">
          <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-100 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-100 rounded-full blur-[120px]" />
        </div>

        <div className="max-w-5xl mx-auto px-4 relative z-10 text-center">
          <span className="inline-block py-1 px-3 rounded-full bg-blue-100 text-blue-600 text-xs font-bold uppercase tracking-widest mb-6 animate-fade-in">Our Mission</span>
          <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 mb-8 tracking-tight">
            Elevating <span className="text-blue-600">Healthcare</span> <br />Through Innovation.
          </h1>
          <p className="text-xl text-slate-600 leading-relaxed max-w-3xl mx-auto font-medium">
            Aarogya Nidhi is more than software—it's a clinical operating system designed to eliminate complexity,
            so providers can focus on what matters most: saving lives and improving outcomes.
          </p>
        </div>
      </section>

      {/* Story Section - Founder's Version */}
      <section className="py-24 relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute top-1/2 left-0 -translate-y-1/2 w-64 h-64 bg-blue-50/50 rounded-full blur-3xl -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
            <div className="relative">
              <div className="absolute -top-10 -left-6 text-blue-100 opacity-50 select-none">
                <svg width="120" height="120" viewBox="0 0 120 120" fill="currentColor">
                  <path d="M30 40c0-11 9-20 20-20h5v10h-5c-5.5 0-10 4.5-10 10v10h15v30H20V50c0-5.5 4.5-10 10-10zm45 0c0-11 9-20 20-20h5v10h-5c-5.5 0-10 4.5-10 10v10h15v30H65V50c0-5.5 4.5-10 10-10z" />
                </svg>
              </div>

              <div className="relative z-10 space-y-8">
                <div>
                  <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-6 tracking-tight leading-tight">
                    The Aarogya Nidhi <span className="text-blue-600 italic">Story</span>
                  </h2>
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-1 bg-blue-600 rounded-full" />
                    <span className="text-sm font-bold text-blue-600 uppercase tracking-widest">A Founder's Note</span>
                  </div>
                </div>

                <div className="space-y-6 text-lg text-slate-700 leading-relaxed italic font-serif">
                  <p className="border-l-4 border-blue-600/20 pl-6 py-2">
                    "Hi, I'm Saksham Goswami, the developer behind Aarogya Nidhi. I started this project with a simple realization: the software our doctors and clinic staff use every day shouldn't be harder to navigate than the medical problems they solve."
                  </p>
                  <p className="pl-6">
                    "I saw a massive gap between clunky legacy systems and the smooth technology we use everywhere else. I’m not a massive corporate entity; I’m a developer on a mission to bring real, tangible change to healthcare operations."
                  </p>
                  <p className="pl-6 font-semibold text-slate-900 not-italic">
                    "My goal is simple: give medical professionals their time back, so they can focus entirely on patient care."
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-10">
                  <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <Shield className="w-5 h-5" />
                    </div>
                    <h4 className="text-xl font-bold text-slate-900 mb-2">1 Unified Platform</h4>
                    <p className="text-slate-500 text-sm leading-snug">Connecting every tier of your hospital seamlessly.</p>
                  </div>
                  <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
                    <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                      <Heart className="w-5 h-5" />
                    </div>
                    <h4 className="text-xl font-bold text-slate-900 mb-2">Built with Purpose</h4>
                    <p className="text-slate-500 text-sm leading-snug">100% developer-driven, built for clinicians first.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative lg:block">
              <div className="absolute top-0 right-0 -mr-10 -mt-10 w-48 h-48 bg-emerald-50 rounded-full blur-3xl opacity-60" />
              <div className="relative group perspective-1000">
                <div className="absolute -inset-4 bg-gradient-to-tr from-blue-100 via-white to-emerald-50 rounded-[2.5rem] -z-10 animate-pulse-slow" />
                <div className="relative overflow-hidden rounded-[2rem] shadow-2xl border-8 border-white group-hover:rotate-1 transition-transform duration-700">
                  <img
                    src="/assets/about/aarogya_nidhi_story.png"
                    alt="The Aarogya Nidhi Journey"
                    className="w-full h-full object-cover scale-105 group-hover:scale-100 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-blue-900/5 mix-blend-multiply opacity-30 group-hover:opacity-0 transition-opacity duration-700" />
                </div>

                {/* Floating Founder's Signature Seal */}
                <div className="absolute -bottom-10 -right-6 lg:-right-12 bg-white/95 backdrop-blur-md p-6 rounded-[2.5rem] shadow-2xl border border-white/50 animate-float flex flex-col items-center justify-center group/seal hover:scale-105 transition-transform duration-500 min-w-[180px]">
                  <div className="relative mb-2">
                    <img
                      src="/assets/about/signature_clean.png"
                      alt="Saksham Signature"
                      className="h-16 md:h-20 w-auto object-contain brightness-105 group-hover:brightness-110 transition-all drop-shadow-sm"
                    />
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="h-px w-12 bg-blue-600/20 mb-3"></div>
                    <span className="text-[10px] font-bold text-slate-800 uppercase tracking-[0.2em] leading-none">
                      Lead Developer
                    </span>
                    <span className="text-[9px] font-medium text-blue-600 uppercase tracking-widest mt-1.5 opacity-80">
                      & Founder
                    </span>
                  </div>
                  {/* Subtle decorative touch */}
                  <div className="absolute -inset-2 border border-blue-600/5 rounded-[2rem] -z-10 animate-pulse-slow"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values Grid */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">Guided by Our Core Values</h2>
            <p className="text-slate-500 max-w-2xl mx-auto text-lg font-medium">We build for scale, security, and the clinicians who use our tools every day.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-10">
            {[
              {
                icon: <Target className="w-8 h-8" />,
                title: "Precision Engineering",
                desc: "I don't settle for 'it just works.' Every pixel and every API call is optimized to save those critical seconds that doctors need in high-pressure environments."
              },
              {
                icon: <Shield className="w-8 h-8" />,
                title: "Security Paradox",
                desc: "In healthcare, data trust is everything. I’ve built Aarogya Nidhi with an 'invisible security' approach—enterprise-grade protection that keeps patient data safe without getting in the way of your workflow."
              },
              {
                icon: <Heart className="w-8 h-8" />,
                title: "Built for the Frontline",
                desc: "Aarogya Nidhi wasn't built in a boardroom; it was built by looking at real hospital struggles. I design every interface to feel intuitive, so you can spend less time clicking and more time caring."
              }
            ].map((v, i) => (
              <div key={i} className="bg-white p-10 rounded-3xl shadow-sm border border-slate-100 hover:shadow-xl hover:border-blue-100 transition-all duration-300 group flex flex-col h-full">
                <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300 shrink-0">
                  {v.icon}
                </div>
                <h3 className="text-xl font-bold mb-4 text-slate-900">{v.title}</h3>
                <p className="text-slate-600 leading-relaxed font-medium flex-grow">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <div className="bg-blue-600 rounded-[3rem] p-12 md:p-20 shadow-2xl shadow-blue-200 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <div className="relative z-10 space-y-8">
              <h2 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
                Ready to join the <br />future of healthcare?
              </h2>
              <p className="text-blue-100 text-lg max-w-xl mx-auto font-medium">
                Join hundreds of forward-thinking facilities that are scaling efficiently with Aarogya Nidhi.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Link
                  to="/register"
                  className="bg-white text-blue-600 px-8 py-4 rounded-2xl text-lg font-extrabold hover:bg-slate-50 transition-colors shadow-lg shadow-blue-900/10"
                >
                  Get Started Now
                </Link>
                <Link
                  to="/contact"
                  className="bg-blue-700 text-white border border-blue-500 px-8 py-4 rounded-2xl text-lg font-extrabold hover:bg-blue-800 transition-colors text-center"
                >
                  Contact Sales
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;
