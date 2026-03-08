
import React from 'react';
import { Link } from 'react-router-dom';
import { Linkedin, Twitter, Facebook, Instagram } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-50 border-t border-slate-200 text-slate-600 py-16 pb-24 md:pb-16 relative z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-8 md:gap-12 mb-16">
          <div className="lg:col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-white rounded-sm transform rotate-45"></div>
              </div>
              <span className="text-2xl font-bold tracking-tight text-slate-900">Aarogya Nidhi</span>
            </Link>
            <p className="text-slate-600 max-w-xs mb-8 leading-relaxed">
              Revolutionizing healthcare management through integrated technology. Empowering providers, improving lives.
            </p>
            <div className="flex space-x-5 text-slate-400">
              <a href="#" className="hover:text-primary transition-colors"><Linkedin className="w-6 h-6" /></a>
              <a href="#" className="hover:text-primary transition-colors"><Twitter className="w-6 h-6" /></a>
              <a href="#" className="hover:text-primary transition-colors"><Facebook className="w-6 h-6" /></a>
              <a href="#" className="hover:text-primary transition-colors"><Instagram className="w-6 h-6" /></a>
            </div>
          </div>

          <div>
            <h4 className="text-slate-900 font-bold mb-6">Solutions</h4>
            <ul className="space-y-4 text-sm">
              <li><Link to="/clinic-operations" className="text-slate-600 hover:text-primary transition-colors">Clinic Interface</Link></li>
              <li><Link to="/hospital-command-center" className="text-slate-600 hover:text-primary transition-colors">Hospital Interface</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-slate-900 font-bold mb-6">Company</h4>
            <ul className="space-y-4 text-sm">
              <li><Link to="/about" className="text-slate-600 hover:text-primary transition-colors">About Us</Link></li>
              <li><Link to="/careers" className="text-slate-600 hover:text-primary transition-colors">Careers</Link></li>
              <li><Link to="/news" className="text-slate-600 hover:text-primary transition-colors">News & Press</Link></li>
              <li><Link to="/contact" className="text-slate-600 hover:text-primary transition-colors">Contact</Link></li>
              <li><Link to="/privacy" className="text-slate-600 hover:text-primary transition-colors">Privacy Policy</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-slate-900 font-bold mb-6">Connect</h4>
            <ul className="space-y-4 text-sm">
              <li><Link to="/support" className="text-slate-600 hover:text-primary transition-colors">Support Portal</Link></li>
              <li><Link to="/support" className="text-slate-600 hover:text-primary transition-colors">Help Center</Link></li>
            </ul>
          </div>
        </div>

        {/* Compliance Badges */}
        <div className="border-t border-slate-200 pt-12 pb-8">
          <div className="flex flex-col sm:flex-row flex-wrap justify-center items-center gap-6 sm:gap-8 md:gap-16 opacity-70 hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-2">
              <img src="https://img.icons8.com/color/48/caduceus.png" alt="HIPAA" className="w-8 grayscale opacity-60" />
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">HIPAA Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <img src="https://img.icons8.com/ios-filled/50/000000/security-shield-green.png" alt="SOC 2" className="w-8 opacity-60" />
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">SOC 2 Type II</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black border-2 border-slate-400 px-2 rounded text-slate-400">ISO</span>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">27001 Certified</span>
            </div>
          </div>
        </div>

        <div className="text-center pt-8 border-t border-slate-200">
          <p className="text-xs text-slate-500">
            &copy; 2026 Aarogya Nidhi. All rights reserved. A Healthcare Solutions Company.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
