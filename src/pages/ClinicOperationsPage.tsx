import React from 'react';
import ClinicOperations from './landing/ClinicOperations';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';

const ClinicOperationsPage: React.FC = () => {
    return (
        <div className="min-h-screen bg-slate-50">
            <Navbar />
            <ClinicOperations />
            <Footer />
        </div>
    );
};

export default ClinicOperationsPage;
