import React, { useEffect } from 'react';
import { Activity, Clock, FileText, CheckCircle2 } from 'lucide-react';

const ClinicOperations: React.FC = () => {
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="pt-24 pb-16 lg:pt-32 lg:pb-24 bg-slate-50 min-h-screen">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center max-w-3xl mx-auto mb-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-slate-900 mb-6 tracking-tight">
                        Clinic & Pharmacy <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-cyan-400">Operations</span>
                    </h1>
                    <p className="text-lg text-slate-600 font-medium">
                        Streamline your front-desk and pharmacy workflows with our high-speed Point-of-Sale interface. Designed specifically for healthcare providers to reduce administrative burden and focus on patient care.
                    </p>
                </div>

                <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/40 p-8 md:p-12 mb-16 border border-slate-100 flex flex-col-reverse md:flex-row gap-12 items-center animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150">
                    <div className="md:w-1/2">
                        <h2 className="text-3xl font-bold text-slate-900 mb-6">Lightning-Fast POS System</h2>
                        <p className="text-slate-600 mb-8 text-lg">
                            Process consults, generate beautiful PDF receipts, and handle payments in seconds. Our intuitive interface minimizes clicks and speeds up patient checkout times.
                        </p>
                        <ul className="space-y-5">
                            {[
                                'Split payment handling (Cash, Card, UPI)',
                                'Real-time cart and automated subtotal calculation',
                                'Direct integration with inventory for instant stock validation'
                            ].map((item, i) => (
                                <li key={i} className="flex items-start">
                                    <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0 mr-4 mt-0.5" />
                                    <span className="text-slate-700 font-medium text-lg">{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="md:w-1/2 rounded-2xl overflow-hidden shadow-2xl border-4 border-white/50 bg-slate-100 relative group">
                        <div className="absolute inset-0 bg-primary/5 mix-blend-overlay group-hover:bg-transparent transition-colors duration-500 z-10 pointer-events-none"></div>
                        <img
                            src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&q=80&w=800"
                            alt="Clinic Operations"
                            className="w-full h-auto object-cover transform group-hover:scale-105 transition-transform duration-700"
                        />
                    </div>
                </div>

                <div className="grid md:grid-cols-3 gap-8">
                    {[
                        {
                            icon: <Activity className="w-8 h-8 text-primary" />,
                            title: "Automated Stock Depletion",
                            desc: "Inventory levels are automatically depleted as items are billed, with built-in alerts for low stock and expiring batches."
                        },
                        {
                            icon: <FileText className="w-8 h-8 text-cyan-500" />,
                            title: "Smart Receipt Generation",
                            desc: "Print professional thermal or A4 PDF receipts customized with your clinic's branding."
                        },
                        {
                            icon: <Clock className="w-8 h-8 text-blue-500" />,
                            title: "Shift Management",
                            desc: "Clock-in/Clock-out tracking, comprehensive staff attendance records, and verifiable shift hours."
                        }
                    ].map((feature, idx) => (
                        <div
                            key={idx}
                            className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-2 transition-all duration-300 animate-in fade-in slide-in-from-bottom-8"
                            style={{ animationDelay: `${(idx + 3) * 150}ms` }}
                        >
                            <div className="w-16 h-16 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                                {feature.icon}
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                            <p className="text-slate-600 font-medium">{feature.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ClinicOperations;
