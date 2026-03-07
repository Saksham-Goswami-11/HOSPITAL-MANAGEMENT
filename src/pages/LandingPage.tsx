import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from '@/components/landing/Navbar';
import Hero from '@/components/landing/Hero';
import Offers from '@/components/landing/Offers';
import FeaturesGrid from '@/components/landing/FeaturesGrid';
import Footer from '@/components/landing/Footer';
import PricingSection from '@/components/landing/PricingSection';

const ScrollToTop = () => {
    const { pathname } = useLocation();
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);
    return null;
};

const LandingPage: React.FC = () => {
    return (
        <div className="min-h-screen flex flex-col bg-slate-50">
            <ScrollToTop />
            <Navbar />
            <main className="flex-grow">
                <Hero />
                <Offers />
                <FeaturesGrid />
                <PricingSection />
            </main>
            <Footer />
        </div>
    );
};

export default LandingPage;
