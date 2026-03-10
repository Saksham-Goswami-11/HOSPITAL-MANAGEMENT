
import React, { useState } from 'react';
import { Mail, Send, CheckCircle2, Loader2 } from 'lucide-react';

const Contact: React.FC = () => {
  const [formState, setFormState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    institutionName: '',
    message: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormState('loading');

    try {
      const response = await fetch("https://formsubmit.co/ajax/aarogyanidhi01@gmail.com", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          name: `${formData.firstName} ${formData.lastName}`,
          email: formData.email,
          phone: formData.phone,
          institution: formData.institutionName,
          message: formData.message,
          _subject: `New Contact Form Submission from ${formData.institutionName}`
        })
      });

      if (response.ok) {
        setFormState('success');
      } else {
        setFormState('error');
      }
    } catch (error) {
      console.error("Form submission error:", error);
      setFormState('error');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  if (formState === 'success') {
    return (
      <div className="pt-20 bg-slate-50 min-h-[80vh] flex items-center justify-center">
        <div className="max-w-md w-full mx-auto px-4 text-center animate-in fade-in zoom-in duration-500">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center text-green-600 mx-auto mb-8 shadow-lg shadow-green-200">
            <CheckCircle2 className="w-12 h-12" />
          </div>
          <h2 className="text-4xl font-bold text-slate-900 mb-4">Message Sent!</h2>
          <p className="text-slate-600 mb-8 text-lg">
            Thank you for reaching out. Our team will get back to you at the earliest.
          </p>
          <button
            onClick={() => {
              setFormState('idle');
              setFormData({ firstName: '', lastName: '', email: '', phone: '', institutionName: '', message: '' });
            }}
            className="text-blue-600 font-bold hover:underline"
          >
            Send another message
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-20 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="bg-white rounded-[2.5rem] md:rounded-[4rem] shadow-2xl shadow-slate-200/60 overflow-hidden grid lg:grid-cols-2 border border-slate-100/50">
          {/* Info Side */}
          <div className="bg-slate-900 p-10 lg:p-20 text-white flex flex-col justify-between relative overflow-hidden group">
            {/* Premium Decorative Elements */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-[100px] group-hover:bg-blue-600/15 transition-colors duration-700"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-[80px]"></div>

            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-widest mb-8">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                Support & Inquiries
              </div>

              <h1 className="text-4xl md:text-6xl font-extrabold mb-8 tracking-tight leading-[1.1] bg-gradient-to-br from-white via-white to-slate-400 bg-clip-text text-transparent">
                Let's simplify your <span className="text-blue-400">operations</span>.
              </h1>
              <p className="text-slate-400 text-lg md:text-xl mb-12 leading-relaxed max-w-sm">
                Ready to transform your clinic? Tell us about your facility and we'll help build your digital roadmap.
              </p>

              <div className="space-y-8">
                <div className="flex gap-6 items-center p-4 rounded-3xl bg-white/5 border border-white/10 hover:border-blue-500/30 hover:bg-white/10 transition-all duration-300 group/item">
                  <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center text-blue-400 group-hover/item:scale-110 transition-transform duration-500">
                    <Mail className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-slate-100 mb-0.5">Contact via Email</h4>
                    <p className="text-blue-400 font-semibold tracking-wide">aarogyanidhi01@gmail.com</p>
                  </div>
                </div>

                <div className="p-8 rounded-[2rem] bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/10">
                  <p className="text-slate-300 text-sm leading-relaxed italic">
                    "Our mission is to empower local clinics with state-of-the-art management tools, making healthcare more accessible and organized for everyone."
                  </p>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="w-8 h-1 bg-blue-500 rounded-full"></div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Aarogya Nidhi Team</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-16 pt-8 border-t border-white/5 relative z-10">
              <div className="flex items-center gap-3 text-slate-500">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <p className="text-sm font-medium">Committed to clinical data privacy & security</p>
              </div>
            </div>
          </div>

          {/* Form Side */}
          <div className="p-10 lg:p-20 bg-white">
            <div className="mb-12">
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Send us a message</h3>
              <p className="text-slate-500">We'll respond to your inquiry within 24 hours.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">First Name</label>
                  <input
                    required
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    type="text"
                    placeholder="e.g. Rahul"
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl p-4 focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 focus:outline-none transition-all placeholder:text-slate-300"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Last Name</label>
                  <input
                    required
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    type="text"
                    placeholder="e.g. Sharma"
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl p-4 focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 focus:outline-none transition-all placeholder:text-slate-300"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Email Address (Optional)</label>
                  <input
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    type="email"
                    placeholder="you@example.com"
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl p-4 focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 focus:outline-none transition-all placeholder:text-slate-300"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Phone Number (Optional)</label>
                  <input
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    type="tel"
                    placeholder="e.g. +91 00000 00000"
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl p-4 focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 focus:outline-none transition-all placeholder:text-slate-300"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Institution / Clinic Name</label>
                <input
                  required
                  name="institutionName"
                  value={formData.institutionName}
                  onChange={handleInputChange}
                  type="text"
                  placeholder="name of your medical facility"
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl p-4 focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 focus:outline-none transition-all placeholder:text-slate-300"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Detailed Requirements</label>
                <textarea
                  required
                  name="message"
                  value={formData.message}
                  onChange={handleInputChange}
                  rows={4}
                  placeholder="How can we help your facility grow?"
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl p-4 focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 focus:outline-none transition-all placeholder:text-slate-300 resize-none"
                ></textarea>
              </div>

              {formState === 'error' && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 rotate-180" />
                  Something went wrong. Please try emailing us directly.
                </div>
              )}

              <button
                disabled={formState === 'loading'}
                className="w-full bg-blue-600 text-white font-bold py-5 rounded-2xl hover:bg-blue-700 hover:shadow-2xl hover:shadow-blue-500/20 active:scale-[0.99] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-lg"
              >
                {formState === 'loading' ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Send Inquiry <Send className="w-5 h-5" />
                  </>
                )}
              </button>

              <p className="text-center text-slate-400 text-[10px] md:text-xs pt-4">
                We value your privacy. By sending this inquiry, you agree to our <a href="/#/privacy" className="text-slate-600 hover:underline font-medium">Privacy Policy</a>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;

