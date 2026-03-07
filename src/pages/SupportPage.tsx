import React from 'react';
import Support from './landing/Support';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';

const SupportPage: React.FC = () => {
    return (
        <div className="min-h-screen bg-slate-50">
            <Navbar />
            <Support />
            <Footer />
        </div>
    );
};

export default SupportPage;
