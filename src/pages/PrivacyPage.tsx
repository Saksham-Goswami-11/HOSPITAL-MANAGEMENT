import React from 'react';
import Privacy from './landing/Privacy';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';

const PrivacyPage: React.FC = () => {
    return (
        <div className="min-h-screen bg-slate-50">
            <Navbar />
            <Privacy />
            <Footer />
        </div>
    );
};

export default PrivacyPage;
