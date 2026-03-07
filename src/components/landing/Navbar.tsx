
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close menu on navigation
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const navLinks = [
    { name: 'Solutions', path: 'offers', isSection: true },
    { name: 'Pricing', path: 'pricing', isSection: true },
    { name: 'About', path: '/about', isSection: false },
    { name: 'News', path: '/news', isSection: false },
    { name: 'Contact', path: '/contact', isSection: false },
  ];

  const navigate = useNavigate();

  const handleNavClick = (link: typeof navLinks[0]) => {
    if (link.isSection) {
      if (location.pathname !== '/') {
        navigate('/');
        // Give it a moment to mount the LandingPage
        setTimeout(() => {
          const element = document.getElementById(link.path);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100);
      } else {
        const element = document.getElementById(link.path);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }
  };

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <nav className={`fixed w-full z-50 transition-all duration-300 ${scrolled ? 'bg-white shadow-sm py-3 border-b border-slate-100' : 'bg-white py-4 border-b border-transparent'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-white text-xl">local_hospital</span>
            </div>
            <span className="text-2xl font-extrabold tracking-tight text-slate-900">MedFlow</span>
          </Link>

          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              link.isSection ? (
                <button
                  key={link.name}
                  onClick={() => handleNavClick(link)}
                  className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                  {link.name}
                </button>
              ) : (
                <Link
                  key={link.name}
                  to={link.path}
                  className={`text-sm font-medium transition-colors ${location.pathname === link.path ? 'text-primary' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  {link.name}
                </Link>
              )
            ))}
            <Link to="/app" className="bg-primary hover:opacity-90 px-6 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-blue-500/20 transition-all text-white">
              Launch App
            </Link>
          </div>

          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-slate-600 hover:text-primary"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 top-[73px] bg-slate-900/20 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile Menu Panel */}
      {isOpen && (
        <div className="md:hidden fixed inset-x-0 top-[73px] bg-white border-b border-slate-100 p-6 space-y-6 shadow-2xl z-50 animate-in fade-in slide-in-from-top-4 flex flex-col h-[calc(100vh-73px)] overflow-y-auto">
          <div className="space-y-4">
            {navLinks.map((link) => (
              link.isSection ? (
                <button
                  key={link.name}
                  onClick={() => {
                    handleNavClick(link);
                    setIsOpen(false);
                  }}
                  className="block w-full text-left text-lg font-bold text-slate-700 hover:text-primary py-3 border-b border-slate-50"
                >
                  {link.name}
                </button>
              ) : (
                <Link
                  key={link.name}
                  to={link.path}
                  className="block text-lg font-bold text-slate-700 hover:text-primary py-3 border-b border-slate-50"
                >
                  {link.name}
                </Link>
              )
            ))}
          </div>
          <div className="pt-4 mt-auto pb-8">
            <Link to="/app" className="block w-full bg-primary hover:bg-blue-700 text-white px-6 py-4 rounded-xl font-bold text-center shadow-lg transition-colors">
              Launch App
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
