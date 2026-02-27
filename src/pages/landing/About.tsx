
import React from 'react';

const About: React.FC = () => {
  return (
    <div className="pt-20">
      <section className="bg-slate-900 py-24 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-blue-600/5 filter blur-[100px]"></div>
        <div className="max-w-4xl mx-auto px-4 relative z-10">
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">Our Mission</h1>
          <p className="text-xl text-slate-400 leading-relaxed">
            At ClinicOS, we are bridging the gap between clinical excellence and operational efficiency. 
            We believe that better technology leads to better care, and better care saves lives.
          </p>
        </div>
      </section>

      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-6">The ClinicOS Story</h2>
              <div className="space-y-4 text-slate-600 leading-relaxed">
                <p>
                  Founded by a team of physicians and software architects, ClinicOS was born out of 
                  frustration with fragmented healthcare systems. We saw clinicians spending more time 
                  fighting software than treating patients.
                </p>
                <p>
                  In 2020, we launched our first unified interface, proving that hospital and clinic 
                  operations don't have to exist in silos. Today, we support thousands of providers 
                  across three continents.
                </p>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 gradient-border rounded-3xl"></div>
              <img 
                src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&q=80&w=800" 
                alt="Our Team" 
                className="rounded-3xl shadow-2xl relative z-10"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-16">Core Values</h2>
          <div className="grid md:grid-cols-3 gap-12">
            {[
              { title: "Patient-First", desc: "Every line of code is written with the patient outcome in mind." },
              { title: "Radical Simplicity", desc: "Complex problems require elegant, simple solutions." },
              { title: "Security by Design", desc: "Trust is our most valuable asset. We protect it fiercely." }
            ].map((v, i) => (
              <div key={i} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-xl font-bold mb-4 text-blue-600">{v.title}</h3>
                <p className="text-slate-600">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;
