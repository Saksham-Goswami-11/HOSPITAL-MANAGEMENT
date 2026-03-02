import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import About from '@/pages/landing/About';

const ScrollToTop = () => {
    const { pathname } = useLocation();
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);
    return null;
};

const AboutPage: React.FC = () => {
    return (
        <div className="min-h-screen flex flex-col bg-slate-50">
            <ScrollToTop />
            <Navbar />
            <main className="flex-grow">
                <About />
            </main>
            <Footer />
        </div>
    );
};

export default AboutPage;
