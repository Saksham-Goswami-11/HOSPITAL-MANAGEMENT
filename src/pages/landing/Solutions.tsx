
import React from 'react';
import { Activity, Shield, Users, Clock } from 'lucide-react';

const Solutions: React.FC = () => {
  return (
    <div className="pt-20">
      <section className="bg-slate-50 border-b border-slate-100 py-32 text-center relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 relative z-10">
          <h1 className="text-5xl font-bold mb-6 text-slate-900">Unified <span className="text-blue-600">Solutions</span></h1>
          <p className="text-xl text-slate-600">One ecosystem. Infinite clinical possibilities.</p>
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-gradient-to-r from-blue-600/5 to-transparent"></div>
      </section>

      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-24">
            <div className="space-y-8">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
                <Activity className="w-8 h-8" />
              </div>
              <h2 className="text-4xl font-bold text-slate-900">Clinic Interface</h2>
              <p className="text-slate-600 text-lg leading-relaxed">
                Designed for speed and patient experience. Our clinic interface reduces charting time by 40% using AI-assisted documentation and automated intake workflows.
              </p>
              <ul className="space-y-4">
                {["Smart Patient Scheduling", "Telehealth Pro", "Real-time Billing Insights"].map(item => (
                  <li key={item} className="flex items-center gap-3 text-slate-700 font-medium">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div> {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-slate-100 rounded-[3rem] p-12 flex items-center justify-center">
              <div className="text-center">
                <p className="text-slate-400 font-mono text-sm uppercase tracking-widest mb-4">Module Snapshot</p>
                <div className="w-64 h-80 bg-white rounded-2xl shadow-xl p-6 relative">
                  <div className="w-full h-4 bg-slate-100 rounded mb-4"></div>
                  <div className="w-3/4 h-4 bg-slate-100 rounded mb-4"></div>
                  <div className="w-full h-32 bg-blue-50 rounded-xl mb-4"></div>
                  <div className="flex gap-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-full"></div>
                    <div className="flex-grow h-8 bg-slate-50 rounded"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-24 items-center">
            <div className="order-2 md:order-1 bg-white border border-slate-100 shadow-xl shadow-slate-200/50 rounded-[3rem] p-12 text-slate-900">
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600"><Users className="w-6 h-6" /></div>
                  <span className="font-bold">Bed Management</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600"><Shield className="w-6 h-6" /></div>
                  <span className="font-bold">Compliance Engine</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600"><Clock className="w-6 h-6" /></div>
                  <span className="font-bold">ER Wait Prediction</span>
                </div>
              </div>
            </div>
            <div className="order-1 md:order-2 space-y-8">
              <h2 className="text-4xl font-bold text-slate-900">Hospital Interface</h2>
              <p className="text-slate-600 text-lg leading-relaxed">
                Enterprise-grade coordination for large-scale facilities. Manage thousands of assets, beds, and personnel through a single pane of glass.
              </p>
              <button className="bg-blue-600 text-white px-8 py-4 rounded-xl font-bold shadow-lg">Enterprise Deep Dive</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Solutions;
