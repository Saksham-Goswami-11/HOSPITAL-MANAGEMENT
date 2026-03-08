
import React, { useState } from 'react';
import { Mail, Phone, MapPin, Send, CheckCircle2, Loader2 } from 'lucide-react';

const Contact: React.FC = () => {
  const [formState, setFormState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    institutionName: '',
    message: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormState('loading');

    try {
      const response = await fetch("https://formsubmit.co/ajax/sakshamgoswami0811@gmail.com", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          name: `${formData.firstName} ${formData.lastName}`,
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
              setFormData({ firstName: '', lastName: '', institutionName: '', message: '' });
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="bg-white rounded-[3rem] shadow-2xl shadow-slate-200/50 overflow-hidden grid lg:grid-cols-2 border border-slate-100">
          {/* Info Side */}
          <div className="bg-slate-900 p-12 lg:p-16 text-white flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
            <div className="relative z-10">
              <h1 className="text-5xl font-bold mb-6 tracking-tight">Let's talk scale.</h1>
              <p className="text-slate-400 text-lg mb-12 leading-relaxed max-w-sm">
                Ready to transform your facility? Our implementation specialists are standing by to build your custom roadmap.
              </p>

              <div className="space-y-10">
                <div className="flex gap-6 group">
                  <div className="w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-all duration-300">
                    <Mail className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg mb-1">Email us</h4>
                    <p className="text-slate-400 font-medium">hello@aarogyanidhi.in</p>
                  </div>
                </div>
                <div className="flex gap-6 group">
                  <div className="w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-all duration-300">
                    <Phone className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg mb-1">Call us</h4>
                    <p className="text-slate-400 font-medium">+1 (555) 000-0000</p>
                  </div>
                </div>
                <div className="flex gap-6 group">
                  <div className="w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-all duration-300">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg mb-1">Visit us</h4>
                    <p className="text-slate-400 font-medium leading-relaxed">
                      123 Innovation Drive, Suite 500<br />
                      Palo Alto, CA 94301
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-16 pt-8 border-t border-white/10 relative z-10">
              <p className="text-sm text-slate-500 italic">Trusted by over 500+ clinics worldwide for mission-critical operations.</p>
            </div>
          </div>

          {/* Form Side */}
          <div className="p-12 lg:p-16 bg-white">
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-2.5">
                  <label className="text-sm font-bold text-slate-800 tracking-wide uppercase">First Name</label>
                  <input
                    required
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    type="text"
                    placeholder="John"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:outline-none transition-all placeholder:text-slate-400"
                  />
                </div>
                <div className="space-y-2.5">
                  <label className="text-sm font-bold text-slate-800 tracking-wide uppercase">Last Name</label>
                  <input
                    required
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    type="text"
                    placeholder="Doe"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:outline-none transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>
              <div className="space-y-2.5">
                <label className="text-sm font-bold text-slate-800 tracking-wide uppercase">Institution Name</label>
                <input
                  required
                  name="institutionName"
                  value={formData.institutionName}
                  onChange={handleInputChange}
                  type="text"
                  placeholder="St. Mary's General Hospital"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:outline-none transition-all placeholder:text-slate-400"
                />
              </div>
              <div className="space-y-2.5">
                <label className="text-sm font-bold text-slate-800 tracking-wide uppercase">Your Message</label>
                <textarea
                  required
                  name="message"
                  value={formData.message}
                  onChange={handleInputChange}
                  rows={4}
                  placeholder="Tell us about your requirements..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:outline-none transition-all placeholder:text-slate-400 resize-none"
                ></textarea>
              </div>

              {formState === 'error' && (
                <p className="text-red-500 text-sm font-medium animate-pulse">
                  Something went wrong. Please try again or email us directly.
                </p>
              )}

              <button
                disabled={formState === 'loading'}
                className="w-full bg-blue-600 text-white font-bold py-5 rounded-2xl hover:bg-blue-700 hover:shadow-2xl hover:shadow-blue-200 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-lg"
              >
                {formState === 'loading' ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    Deploy Inquiry <Send className="w-5 h-5" />
                  </>
                )}
              </button>

              <p className="text-center text-slate-400 text-xs mt-4">
                By submitting, you agree to our <a href="/#/privacy" className="text-slate-600 hover:underline">Privacy Policy</a>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;

