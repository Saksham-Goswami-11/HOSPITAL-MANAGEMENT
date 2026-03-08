
import React from 'react';
import { Database, Brain, ShieldCheck, Cpu } from 'lucide-react';

const FeaturesGrid: React.FC = () => {
  const features = [
    {
      title: "Smart Billing & POS",
      description: "Lightning-fast billing workflows for clinics and hospitals with automated invoicing, discounts, and comprehensive transaction ledgers.",
      icon: <Database className="w-8 h-8 text-blue-600 relative z-10" />,
      bgClass: "bg-blue-100",
      glowClass: "bg-blue-400"
    },
    {
      title: "Pharmacy & Inventory",
      description: "Real-time stock tracking, expiration alerts, and one-click quick entry to keep your pharmacy fully stocked and compliant.",
      icon: <Brain className="w-8 h-8 text-indigo-600 relative z-10" />,
      bgClass: "bg-indigo-100",
      glowClass: "bg-indigo-400"
    },
    {
      title: "Role-Based Security",
      description: "Enterprise-grade access control for Super Admins, Hospital Managers, Clinic Admins, and Staff. Complete with audit trails.",
      icon: <ShieldCheck className="w-8 h-8 text-teal-600 relative z-10" />,
      bgClass: "bg-teal-100",
      glowClass: "bg-teal-400"
    },
    {
      title: "Multi-Tenant Architecture",
      description: "Manage multiple connected hospitals and branch clinics from a single, unified Command Center with centralized reporting.",
      icon: <Cpu className="w-8 h-8 text-amber-600 relative z-10" />,
      bgClass: "bg-amber-100",
      glowClass: "bg-amber-400"
    }
  ];

  return (
    <section className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-extrabold text-slate-900 mb-4 tracking-tight">The Aarogya Nidhi Ecosystem</h2>
          <p className="text-slate-600 max-w-2xl mx-auto text-lg font-medium">
            A comprehensive, multi-tenant suite of tools built to conquer the daily operational chaos of modern healthcare facilities.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12">
          {features.map((feature, idx) => (
            <div key={idx} className="flex flex-col items-center text-center p-6 sm:p-8 bg-white rounded-3xl border-2 border-slate-200 shadow-md hover:shadow-2xl hover:shadow-primary/10 hover:border-primary/40 hover:-translate-y-2 transition-all duration-300 group">
              <div className="relative mb-8 flex items-center justify-center">
                <div className={`absolute inset-0 ${feature.glowClass} opacity-20 blur-xl rounded-full group-hover:opacity-40 transition-opacity duration-300`}></div>
                <div className={`w-16 h-16 rounded-2xl ${feature.bgClass} flex items-center justify-center shadow-inner border border-white/50 relative transform group-hover:rotate-6 transition-transform duration-300`}>
                  {feature.icon}
                </div>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
              <p className="text-slate-600 leading-relaxed font-medium">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesGrid;
