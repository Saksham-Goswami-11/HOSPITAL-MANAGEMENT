
import React from 'react';
import { Search, MapPin, Briefcase } from 'lucide-react';

const Careers: React.FC = () => {
  const jobs = [
    { title: "Senior Software Engineer", dept: "Engineering", type: "Remote", id: "001" },
    { title: "Clinical Product Manager", dept: "Product", type: "Hybrid", id: "002" },
    { title: "Healthcare Data Scientist", dept: "Data & AI", type: "On-site (NY)", id: "003" },
    { title: "Customer Success Lead", dept: "Operations", type: "Remote", id: "004" }
  ];

  return (
    <div className="pt-20">
      <section className="bg-slate-50 border-b border-slate-100 py-24 text-center">
        <div className="max-w-4xl mx-auto px-4">
          <span className="text-blue-600 font-bold tracking-widest uppercase text-sm">Join the Revolution</span>
          <h1 className="text-5xl md:text-7xl font-bold text-slate-900 mb-6 mt-4">Help us heal the <span className="text-blue-600">system</span>.</h1>
          <p className="text-xl text-slate-600 leading-relaxed">
            We're looking for builders, thinkers, and healers to build the operating system of healthcare.
          </p>
        </div>
      </section>

      <section className="py-24">
        <div className="max-w-5xl mx-auto px-4">
          <div className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <h2 className="text-3xl font-bold text-slate-900">Current Openings</h2>
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search roles..."
                className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="space-y-4">
            {jobs.map(job => (
              <div key={job.id} className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-blue-500 transition-all flex flex-col md:flex-row md:items-center justify-between group">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{job.title}</h3>
                  <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                    <span className="flex items-center gap-1"><Briefcase className="w-4 h-4" /> {job.dept}</span>
                    <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {job.type}</span>
                  </div>
                </div>
                <button className="mt-4 md:mt-0 bg-slate-900 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-600 transition-all">
                  Apply Now
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 bg-blue-600 text-white text-center rounded-[3rem] mx-4 mb-24 overflow-hidden relative">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
        <div className="relative z-10">
          <h2 className="text-4xl font-bold mb-6">Don't see a perfect fit?</h2>
          <p className="text-blue-100 text-lg mb-8 max-w-2xl mx-auto">
            We're always looking for exceptional talent. Send us your resume and tell us why you'd be a great addition to the team.
          </p>
          <button className="bg-white text-blue-600 px-10 py-4 rounded-full font-bold text-lg hover:bg-blue-50 transition-all shadow-xl">
            General Application
          </button>
        </div>
      </section>
    </div>
  );
};

export default Careers;
