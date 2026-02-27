
import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Offers from './components/Offers';
import FeaturesGrid from './components/FeaturesGrid';
import Footer from './components/Footer';

// Page Components
import About from './pages/About';
import Careers from './pages/Careers';
import News from './pages/News';
import Contact from './pages/Contact';
import Privacy from './pages/Privacy';
import Solutions from './pages/Solutions';
import Support from './pages/Support';
import ClinicOperations from './pages/ClinicOperations';
import HospitalCommandCenter from './pages/HospitalCommandCenter';

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const App: React.FC = () => {
  return (
    <Router>
      <ScrollToTop />
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Navbar />
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={
              <>
                <Hero />
                <Offers />
                <FeaturesGrid />
              </>
            } />
            <Route path="/about" element={<About />} />
            <Route path="/careers" element={<Careers />} />
            <Route path="/news" element={<News />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/solutions" element={<Solutions />} />
            <Route path="/support" element={<Support />} />
            <Route path="/clinic-operations" element={<ClinicOperations />} />
            <Route path="/hospital-command-center" element={<HospitalCommandCenter />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
};

export default App;
