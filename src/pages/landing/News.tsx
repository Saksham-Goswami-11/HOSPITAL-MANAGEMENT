import React, { useState } from 'react';
import { Calendar, ArrowUpRight, Users, Clock, Lightbulb, Mail, Sparkles, X, ChevronRight } from 'lucide-react';

const News: React.FC = () => {
  const [selectedArticle, setSelectedArticle] = useState<any>(null);
  const [subEmail, setSubEmail] = useState('');
  const [subStatus, setSubStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subEmail) return;

    setSubStatus('loading');
    try {
      const response = await fetch('https://formsubmit.co/ajax/aarogyanidhi01@gmail.com', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          email: subEmail,
          _subject: 'New Collective Subscription',
          message: `New subscription from Aarogya Nidhi Collective: ${subEmail}`
        })
      });

      if (response.ok) {
        setSubStatus('success');
        setSubEmail('');
      } else {
        setSubStatus('error');
      }
    } catch (error) {
      setSubStatus('error');
    }
  };

  const articles = [
    {
      date: "March 01, 2026",
      tag: "CLINICAL SYNERGY",
      title: "Beyond Dashboards: How Aarogya Nidhi Serves the Medical Frontline.",
      image: "/assets/news/article-1.png",
      icon: <Users className="w-5 h-5 text-blue-600" />,
      desc: "High-performance healthcare starts with high-performance tools. We’ve optimized Aarogya Nidhi’s interface to connect hospital management directly with daily clinical workflows. By removing administrative friction, we’ve created a digital environment where the staff is empowered and the patient is always the priority.",
      fullContent: "The gap between administrative oversight and clinical reality is often where medical errors and burnout occur. Aarogya Nidhi 2.0 introduces a 'clinical-first' architecture. Instead of doctors adapting to the software, the software adapts to the patient journey. From real-time vitals integration to AI-assisted documentation, every feature is designed to keep the healer’s eyes on the patient, not the screen. We believe that when technology vanishes into the background, true care begins."
    },
    {
      date: "Feb 18, 2026",
      tag: "EFFICIENCY",
      title: "The 20-Hour Gift: Why we automated the Billing Engine.",
      image: "/assets/news/article-2.png",
      icon: <Clock className="w-5 h-5 text-indigo-600" />,
      desc: "Our community of doctors shared that they spend too much time on paperwork and not enough on patients. We listened. Aarogya Nidhi’s billing engine is a time-recovery tool designed to save practitioners 20+ hours of manual entry every week, turning tedious data entry into seamless patient care.",
      fullContent: "Billing is the most stressful non-clinical task for any practitioner. Our new Autonomous Billing Engine uses machine learning to categorize procedures, verify insurance codes, and generate invoices in sub-seconds. In a pilot study across 50 clinics, we observed a 45% reduction in billing errors and an average time-saving of 22 hours per week for administrative staff. This isn't just about money; it's about reclaiming the energy needed for high-quality healthcare."
    },
    {
      date: "Jan 30, 2026",
      tag: "COMMUNITY VISION",
      title: "Student-Led Innovation: Why we’re tackling fragmented Healthcare together.",
      image: "/assets/news/article-3.png",
      icon: <Lightbulb className="w-5 h-5 text-amber-600" />,
      desc: "The biggest challenge in healthcare tech today is fragmentation. As a student developer community, we see this as an opportunity to build bridges. We’re not just building a SaaS platform; we’re creating a standard for how modern clinics should operate—simple, unified, and always human-centric.",
      fullContent: "Legacy healthcare systems are built in silos. Our mission as a developer-led collective is to treat interoperability as a human right. Aarogya Nidhi is built on open standards, allowing for seamless data exchange between labs, pharmacies, and primary care providers. By involving medical students and young doctors in our design process, we ensure that Aarogya Nidhi is built for the future of medicine, not just solving the problems of the past."
    }
  ];

  return (
    <div className="pt-20 bg-white">
      {/* Header Section */}
      <section className="relative overflow-hidden bg-[#fafbfc] py-24 border-b border-slate-100">
        <div className="absolute inset-0 opacity-40">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl animate-pulse-slow"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-100 rounded-full mix-blend-multiply filter blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-slate-100 mb-8 animate-float">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-bold text-slate-800 uppercase tracking-widest">Community Insights</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 mb-8 tracking-tight">
            The Aarogya Nidhi <span className="italic text-blue-600 font-medium">Notebook</span>
          </h1>
          <p className="text-slate-500 text-xl max-w-2xl mx-auto font-medium leading-relaxed">
            Real stories, progress reports, and deep dives into the future of healthcare operations.
          </p>
        </div>
      </section>

      {/* Main Grid */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-12">
            {articles.map((article, idx) => (
              <div key={idx} className="flex flex-col group h-full cursor-pointer" onClick={() => setSelectedArticle(article)}>
                <div className="relative aspect-[4/3] rounded-3xl overflow-hidden mb-8 shadow-md border border-slate-100 transition-all duration-500 group-hover:shadow-xl group-hover:shadow-blue-100/50">
                  <div className="absolute inset-0 bg-slate-900/5 group-hover:bg-transparent transition-colors duration-500 z-10"></div>
                  <img
                    src={article.image}
                    alt={article.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000 ease-out"
                  />
                  <div className="absolute top-6 left-6 z-20">
                    <div className="flex items-center gap-2 bg-white/95 backdrop-blur-sm px-4 py-2 rounded-2xl shadow-xl border border-white/50">
                      {article.icon}
                      <span className="text-slate-900 text-[10px] font-bold uppercase tracking-widest leading-none">
                        {article.tag}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col flex-grow px-2">
                  <div className="flex items-center gap-2 text-slate-400 text-[11px] mb-4 font-bold uppercase tracking-widest">
                    <Calendar className="w-4 h-4" /> {article.date}
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-5 leading-snug group-hover:text-blue-600 transition-colors duration-300 tracking-tight">
                    {article.title}
                  </h3>
                  <p className="text-slate-600 font-medium mb-8 leading-relaxed line-clamp-4">
                    {article.desc}
                  </p>
                  <div className="mt-auto pt-6 border-t border-slate-50">
                    <button className="text-blue-600 font-bold flex items-center gap-2 group/btn hover:text-blue-700 transition-colors">
                      Read Full Article
                      <ArrowUpRight className="w-5 h-5 group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-transform" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter - The Aarogya Nidhi Collective */}
      <section className="py-24 relative overflow-hidden bg-[#f8fafc]">
        {/* Subtle Decorative Elements */}
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>

        <div className="max-w-4xl mx-auto px-4 relative z-10">
          <div className="bg-white rounded-[3rem] p-8 md:p-16 shadow-2xl shadow-slate-200/50 flex flex-col md:flex-row items-center gap-12 border border-slate-100">
            <div className="flex-1 text-center md:text-left">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-8 mx-auto md:mx-0 shadow-inner">
                <Mail className="w-8 h-8" />
              </div>
              <h2 className="text-4xl font-bold text-slate-900 mb-6 tracking-tight">Join the <span className="italic text-blue-600 font-medium tracking-normal">Aarogya Nidhi Collective</span></h2>
              <p className="text-slate-500 text-lg font-medium leading-relaxed mb-0">
                We’re building this for you. Join a community of healthcare professionals and tech enthusiasts who believe that better systems lead to better care. No corporate spam—just real progress and insights.
              </p>
            </div>

            <div className="w-full md:w-auto flex-shrink-0">
              <div className="bg-slate-50 p-2 rounded-[2rem] border border-slate-100 w-full max-w-sm shadow-inner">
                {subStatus === 'success' ? (
                  <div className="py-8 px-4 text-center animate-scale-in">
                    <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">Welcome to the Collective!</h3>
                    <p className="text-slate-500 text-sm font-medium">You're now on the list for our latest insights.</p>
                    <button
                      onClick={() => setSubStatus('idle')}
                      className="mt-6 text-blue-600 text-xs font-bold uppercase tracking-widest hover:text-blue-700 transition-colors"
                    >
                      Subscribe another email
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubscribe} className="flex flex-col gap-3">
                    <input
                      type="email"
                      value={subEmail}
                      onChange={(e) => setSubEmail(e.target.value)}
                      placeholder="Enter your email"
                      required
                      className="w-full px-6 py-4 rounded-2xl border-none focus:ring-2 focus:ring-blue-500/20 bg-white text-slate-900 font-medium shadow-sm transition-all text-center md:text-left disabled:opacity-50"
                      disabled={subStatus === 'loading'}
                    />
                    <button
                      type="submit"
                      disabled={subStatus === 'loading'}
                      className="w-full bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {subStatus === 'loading' ? (
                        <>
                          <Clock className="w-5 h-5 animate-spin" />
                          Subscribing...
                        </>
                      ) : (
                        'Subscribe'
                      )}
                    </button>
                    {subStatus === 'error' && (
                      <p className="text-red-500 text-[10px] text-center font-bold uppercase tracking-widest mt-2">
                        Something went wrong. Please try again.
                      </p>
                    )}
                  </form>
                )}
                <p className="text-[10px] text-slate-400 mt-4 text-center font-bold uppercase tracking-widest italic">
                  Secure / No Spam / Opt-out any time
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Article Modal */}
      {selectedArticle && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md animate-fade-in"
            onClick={() => setSelectedArticle(null)}
          ></div>

          <div className="bg-white w-full max-w-3xl rounded-[2.5rem] overflow-hidden shadow-2xl relative z-10 animate-scale-in">
            <button
              onClick={() => setSelectedArticle(null)}
              className="absolute top-6 right-6 p-3 bg-white/80 backdrop-blur-md hover:bg-white text-slate-500 hover:text-slate-900 rounded-full transition-all border border-slate-100 shadow-sm z-20"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="max-h-[85vh] overflow-y-auto no-scrollbar">
              <div className="relative h-72 md:h-96">
                <img
                  src={selectedArticle.image}
                  alt={selectedArticle.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-white via-white/20 to-transparent"></div>
              </div>

              <div className="p-8 md:p-12 -mt-20 relative bg-white rounded-t-[3rem]">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-2xl border border-blue-100">
                    {selectedArticle.icon}
                    <span className="text-[10px] font-bold text-blue-700 uppercase tracking-widest leading-none">
                      {selectedArticle.tag}
                    </span>
                  </div>
                  <div className="text-slate-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> {selectedArticle.date}
                  </div>
                </div>

                <h2 className="text-3xl md:text-5xl font-extrabold text-slate-900 mb-8 tracking-tight leading-tight">
                  {selectedArticle.title}
                </h2>

                <div className="space-y-6 text-slate-600 font-medium text-lg leading-relaxed">
                  <p className="text-slate-900 font-bold text-xl italic border-l-4 border-blue-600 pl-6 py-2">
                    {selectedArticle.desc}
                  </p>
                  <p>{selectedArticle.fullContent}</p>
                </div>

                <div className="mt-12 pt-8 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">M</div>
                      <div>
                        <p className="text-slate-900 font-bold">Aarogya Nidhi Team</p>
                        <p className="text-slate-400 text-xs font-medium">Core Development Collective</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedArticle(null)}
                      className="hidden md:flex items-center gap-2 text-blue-600 font-bold hover:gap-3 transition-all"
                    >
                      Close Article <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export default News;
