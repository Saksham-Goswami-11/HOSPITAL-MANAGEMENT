import React from 'react';
import Careers from './landing/Careers';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';

const CareersPage: React.FC = () => {
    return (
        <div className="min-h-screen bg-slate-50">
            <Navbar />
            <Careers />
            <Footer />
        </div>
    );
};

export default CareersPage;
