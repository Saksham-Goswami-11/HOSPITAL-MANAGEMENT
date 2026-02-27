
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

const Offers: React.FC = () => {
  const offerings = [
    {
      title: "Clinic & Pharmacy Operations",
      description: "A high-speed Point-of-Sale interface designed for front-desk and pharmacy staff. Handle consults, generate beautiful PDF receipts, and automatically deplete inventory in real-time.",
      image: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&q=80&w=800",
      bullets: ["Lightning-Fast POS", "Automated Stock Depletion", "Thermal & A4 PDF Receipts", "Shift Attendance Tracking"],
      link: "/clinic-operations"
    },
    {
      title: "Hospital Command Center",
      description: "The ultimate bird's-eye view for Hospital Admins and Owners. Monitor cross-clinic revenue, track total inventory valuation, manage staff roles, and generate comprehensive PDF ledger reports.",
      image: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&q=80&w=800",
      bullets: ["Multi-Clinic Revenue Tracking", "Global Inventory Control", "Staff Role Management", "Detailed Audit Logs"],
      link: "/hospital-command-center"
    }
  ];

  return (
    <section id="offers" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl md:text-5xl font-extrabold text-center mb-16 text-slate-900 tracking-tight">Tailored Interfaces</h2>
        <div className="grid md:grid-cols-2 gap-8 md:gap-12">
          {offerings.map((offer, idx) => (
            <div key={idx} className="bg-white border text-center border-slate-200 rounded-[2.5rem] overflow-hidden shadow-lg shadow-slate-200/50 hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-2 hover:border-primary/30 transition-all duration-500 group flex flex-col h-full">
              <div className="h-64 overflow-hidden">
                <img
                  src={offer.image}
                  alt={offer.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
              </div>
              <div className="p-6 sm:p-8 flex flex-col flex-grow">
                <h3 className="text-2xl font-bold text-slate-900 mb-4">{offer.title}</h3>
                <p className="text-slate-600 mb-6 line-clamp-3">
                  {offer.description}
                </p>
                <ul className="space-y-3 mb-8 flex-grow">
                  {offer.bullets.map((bullet, bIdx) => (
                    <li key={bIdx} className="flex items-center text-slate-600 font-medium bg-slate-50 rounded-lg p-2 px-4 shadow-sm">
                      <CheckCircle2 className="w-5 h-5 text-primary mr-3" />
                      {bullet}
                    </li>
                  ))}
                </ul>
                <Link to={offer.link} className="w-full border-2 border-primary text-primary py-3 rounded-xl font-bold hover:bg-primary hover:border-primary hover:text-white hover:shadow-lg hover:shadow-primary/40 transition-all duration-300 flex items-center justify-center group/btn">
                  Learn More <ArrowRight className="ml-2 w-5 h-5 transition-transform group-hover/btn:translate-x-1" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Offers;
