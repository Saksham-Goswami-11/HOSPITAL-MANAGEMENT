import React from 'react';
import HospitalCommandCenter from './landing/HospitalCommandCenter';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';

const HospitalCommandCenterPage: React.FC = () => {
    return (
        <div className="min-h-screen bg-slate-50">
            <Navbar />
            <HospitalCommandCenter />
            <Footer />
        </div>
    );
};

export default HospitalCommandCenterPage;
