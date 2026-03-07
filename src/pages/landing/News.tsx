
import React from 'react';
import { Calendar, ArrowUpRight, Newspaper, Cpu, Zap, Globe } from 'lucide-react';

const News: React.FC = () => {
  const articles = [
    {
      date: "March 01, 2026",
      tag: "Product Update",
      title: "MedFlow ERP 2.0: Introducing Advanced Clinic Intelligence",
      image: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&q=80&w=800",
      icon: <Cpu className="w-5 h-5" />,
      desc: "Our biggest update yet brings predictive stock analytics and unified multi-tenant hospital oversight."
    },
    {
      date: "Feb 18, 2026",
      tag: "Innovation",
      title: "How MedFlow's Smart Billing is Saving Clinics 20+ Hours Weekly",
      image: "https://images.unsplash.com/photo-1504639725590-34d0984388bd?auto=format&fit=crop&q=80&w=800",
      icon: <Zap className="w-5 h-5" />,
      desc: "Case study: Analyzing the impact of automated ledgers and seamless pharmacy-to-patient billing."
    },
    {
      date: "Jan 30, 2026",
      tag: "Global Expansion",
      title: "MedFlow Surpasses 500+ Active Healthcare Facilities Worldwide",
      image: "https://images.unsplash.com/photo-1475721027187-402ad2989a38?auto=format&fit=crop&q=80&w=800",
      icon: <Globe className="w-5 h-5" />,
      desc: "We celebrate a milestone in our mission to democratize enterprise-grade healthcare operations."
    }
  ];

  return (
    <div className="pt-20 bg-white">
      {/* Header Section */}
      <section className="bg-slate-50 py-24 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-sm">
            <Newspaper className="w-8 h-8" />
          </div>
          <h1 className="text-5xl font-extrabold text-slate-900 mb-6 tracking-tight">News & <span className="text-blue-600">Insights</span></h1>
          <p className="text-slate-500 text-xl max-w-2xl mx-auto font-medium leading-relaxed">
            The latest breakthroughs in clinical efficiency and operational excellence from the MedFlow team.
          </p>
        </div>
      </section>

      {/* Main Grid */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-10">
            {articles.map((article, idx) => (
              <div key={idx} className="bg-white rounded-[2rem] overflow-hidden border border-slate-200 shadow-sm hover:shadow-2xl hover:shadow-blue-200/20 hover:border-blue-100 transition-all duration-500 group flex flex-col">
                <div className="h-56 overflow-hidden relative">
                  <div className="absolute inset-0 bg-blue-900/10 group-hover:bg-transparent transition-colors duration-500 z-10"></div>
                  <img src={article.image} alt={article.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                  <div className="absolute top-5 left-5 z-20 flex items-center gap-2 bg-white px-4 py-1.5 rounded-full shadow-lg">
                    <span className="text-blue-600">{article.icon}</span>
                    <span className="text-slate-900 text-[10px] font-extrabold uppercase tracking-widest leading-none">{article.tag}</span>
                  </div>
                </div>

                <div className="p-8 flex-grow flex flex-col">
                  <div className="flex items-center gap-2 text-slate-400 text-xs mb-4 font-bold uppercase tracking-widest">
                    <Calendar className="w-4 h-4" /> {article.date}
                  </div>
                  <h3 className="text-2xl font-extrabold text-slate-900 mb-4 tracking-tight leading-snug group-hover:text-blue-600 transition-colors">
                    {article.title}
                  </h3>
                  <p className="text-slate-600 font-medium mb-8 leading-relaxed">
                    {article.desc}
                  </p>
                  <div className="mt-auto">
                    <button className="text-blue-600 font-extrabold flex items-center gap-2 group/btn">
                      Read Report <ArrowUpRight className="w-5 h-5 group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-transform" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="py-24 bg-slate-50 border-t border-slate-100">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-extrabold text-slate-900 mb-6 tracking-tight">Stay ahead of the curve</h2>
          <p className="text-slate-500 mb-10 text-lg font-medium">Join 2,000+ clinicians receiving our bi-weekly intelligence report.</p>
          <div className="flex flex-col sm:flex-row gap-4">
            <input type="email" placeholder="professional@healthcare.org" className="flex-grow px-6 py-4 rounded-2xl border-2 border-slate-200 focus:border-blue-500 focus:outline-none bg-white text-lg font-medium shadow-sm" />
            <button className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-extrabold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200">
              Subscribe
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default News;
