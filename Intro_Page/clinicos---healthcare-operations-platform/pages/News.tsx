
import React from 'react';
import { Calendar, ArrowUpRight } from 'lucide-react';

const News: React.FC = () => {
  const articles = [
    {
      date: "Feb 15, 2024",
      tag: "Company",
      title: "ClinicOS Ranked #1 in KLAS Clinical Operations Report",
      image: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&q=80&w=800"
    },
    {
      date: "Jan 28, 2024",
      tag: "Product",
      title: "Introducing ClinicOS GenAI: Predictive Patient Outcomes",
      image: "https://images.unsplash.com/photo-1504639725590-34d0984388bd?auto=format&fit=crop&q=80&w=800"
    },
    {
      date: "Jan 12, 2024",
      tag: "Event",
      title: "ClinicOS to Keynote at Global Health Summit 2024",
      image: "https://images.unsplash.com/photo-1475721027187-402ad2989a38?auto=format&fit=crop&q=80&w=800"
    }
  ];

  return (
    <div className="pt-20">
      <section className="bg-slate-50 py-24">
        <div className="max-w-7xl mx-auto px-4 text-center mb-16">
          <h1 className="text-5xl font-bold text-slate-900 mb-6">News & Press</h1>
          <p className="text-slate-600 text-lg max-w-2xl mx-auto">
            The latest updates, insights, and announcements from the world of ClinicOS.
          </p>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            {articles.map((article, idx) => (
              <div key={idx} className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all border border-slate-200 flex flex-col">
                <div className="h-48 overflow-hidden relative">
                  <img src={article.image} alt={article.title} className="w-full h-full object-cover" />
                  <span className="absolute top-4 left-4 bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">{article.tag}</span>
                </div>
                <div className="p-6 flex-grow flex flex-col">
                  <div className="flex items-center gap-2 text-slate-400 text-xs mb-4">
                    <Calendar className="w-4 h-4" /> {article.date}
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-6 line-clamp-2">{article.title}</h3>
                  <div className="mt-auto">
                    <button className="text-blue-600 font-bold flex items-center gap-1 hover:gap-2 transition-all">
                      Read Full Article <ArrowUpRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default News;
