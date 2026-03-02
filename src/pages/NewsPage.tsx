import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import News from '@/pages/landing/News';

const ScrollToTop = () => {
    const { pathname } = useLocation();
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);
    return null;
};

const NewsPage: React.FC = () => {
    return (
        <div className="min-h-screen flex flex-col bg-slate-50">
            <ScrollToTop />
            <Navbar />
            <main className="flex-grow">
                <News />
            </main>
            <Footer />
        </div>
    );
};

export default NewsPage;
