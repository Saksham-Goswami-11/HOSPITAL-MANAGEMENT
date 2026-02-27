
import React from 'react';
import { HelpCircle, FileText, Code, MessageCircle } from 'lucide-react';

const Support: React.FC = () => {
  const resources = [
    { title: "Help Center", icon: <HelpCircle />, desc: "Detailed guides for every feature." },
    { title: "Developer API", icon: <Code />, desc: "Integrate ClinicOS into your existing apps." },
    { title: "User Manuals", icon: <FileText />, desc: "PDF documentation for off-line training." },
    { title: "Community Forum", icon: <MessageCircle />, desc: "Connect with other ClinicOS users." }
  ];

  return (
    <div className="pt-20">
      <section className="bg-slate-900 py-24 text-center">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="text-5xl font-bold text-white mb-6">Support & Resources</h1>
          <p className="text-xl text-slate-400">Everything you need to master ClinicOS.</p>
        </div>
      </section>

      <section className="py-24 max-w-7xl mx-auto px-4">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {resources.map(res => (
            <div key={res.title} className="bg-white p-8 rounded-2xl border border-slate-200 hover:shadow-xl transition-all cursor-pointer">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mb-6">
                {res.icon}
              </div>
              <h3 className="text-xl font-bold mb-2">{res.title}</h3>
              <p className="text-slate-500 text-sm">{res.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-24 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 bg-white p-12 rounded-[2rem] shadow-sm border border-slate-200 text-center">
          <h2 className="text-2xl font-bold mb-4">Stay Informed</h2>
          <p className="text-slate-600 mb-8">Join our newsletter for monthly clinical operation tips and product updates.</p>
          <div className="flex flex-col sm:flex-row gap-4">
            <input 
              type="email" 
              placeholder="Enter your email" 
              className="flex-grow p-4 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-blue-500"
            />
            <button className="bg-slate-900 text-white px-8 py-4 rounded-xl font-bold hover:bg-blue-600 transition-all">
              Subscribe
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Support;
