import React from 'react';
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
            MedFlow is more than software—it's a clinical operating system designed to eliminate complexity,
            so providers can focus on what matters most: saving lives and improving outcomes.
          </p>
        </div>
      </section>

      {/* Story Section */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div className="space-y-8">
              <div>
                <h2 className="text-4xl font-extrabold text-slate-900 mb-6 tracking-tight">The MedFlow Foundation</h2>
                <div className="w-20 h-1.5 bg-blue-600 rounded-full mb-8"></div>
              </div>

              <div className="space-y-6 text-lg text-slate-600 leading-relaxed font-medium">
                <p>
                  MedFlow was founded in 2023 by a collective of frontline clinicians and senior software engineers
                  who shared a single vision: a world where healthcare technology feels like an ally, not an obstacle.
                </p>
                <p>
                  Today, we are bridging the critical gap between fragmented legacy systems and the modern requirements of high-performance medical facilities.
                  Our platform integrates everything from smart inventory to real-time clinical dashboards into one seamless experience.
                </p>
                <div className="grid grid-cols-2 gap-8 pt-6">
                  <div>
                    <h4 className="text-3xl font-bold text-slate-900 mb-1">500+</h4>
                    <p className="text-slate-500 font-bold uppercase tracking-wider text-xs">Clinics Empowered</p>
                  </div>
                  <div>
                    <h4 className="text-3xl font-bold text-slate-900 mb-1">24/7</h4>
                    <p className="text-slate-500 font-bold uppercase tracking-wider text-xs">Mission Critical Support</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative group">
              <div className="absolute -inset-4 bg-gradient-to-tr from-blue-100 to-transparent rounded-[2.5rem] -z-10 group-hover:scale-105 transition-transform duration-500"></div>
              <img
                src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&q=80&w=1200"
                alt="Modern Healthcare"
                className="rounded-[2rem] shadow-2xl border-4 border-white transition-all duration-500 group-hover:-translate-y-2 group-hover:shadow-blue-200/50"
              />
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
                desc: "We don't settle for 'it works'. We optimize every workflow to save critical seconds in clinical environments."
              },
              {
                icon: <Shield className="w-8 h-8" />,
                title: "Security Paradox",
                desc: "Enterprise-grade security that remains invisible to the user experience. Your data is protected by design."
              },
              {
                icon: <Heart className="w-8 h-8" />,
                title: "Clinical Centricity",
                desc: "Developed alongside doctors and nurses to ensure our interfaces feel intuitive during high-pressure moments."
              }
            ].map((v, i) => (
              <div key={i} className="bg-white p-10 rounded-3xl shadow-sm border border-slate-100 hover:shadow-xl hover:border-blue-100 transition-all duration-300 group">
                <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                  {v.icon}
                </div>
                <h3 className="text-xl font-bold mb-4 text-slate-900">{v.title}</h3>
                <p className="text-slate-600 leading-relaxed font-medium">{v.desc}</p>
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
                Join hundreds of forward-thinking facilities that are scaling efficiently with MedFlow.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <button className="bg-white text-blue-600 px-8 py-4 rounded-2xl text-lg font-extrabold hover:bg-slate-50 transition-colors shadow-lg shadow-blue-900/10">
                  Get Started Now
                </button>
                <button className="bg-blue-700 text-white border border-blue-500 px-8 py-4 rounded-2xl text-lg font-extrabold hover:bg-blue-800 transition-colors">
                  Contact Sales
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;
