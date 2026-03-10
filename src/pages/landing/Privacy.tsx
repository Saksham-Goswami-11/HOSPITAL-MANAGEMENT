
import React from 'react';

const Privacy: React.FC = () => {
  return (
    <div className="pt-20">
      <section className="bg-slate-50 py-24">
        <div className="max-w-3xl mx-auto px-4">
          <h1 className="text-4xl font-bold text-slate-900 mb-8">Privacy Policy</h1>
          <p className="text-slate-500 mb-12">Last updated: February 20, 2024</p>

          <div className="prose prose-slate max-w-none space-y-12">
            <div>
              <div className="prose prose-slate max-w-none text-slate-600 space-y-8">
                <p className="text-lg leading-relaxed">
                  Aarogya Nidhi ("we", "our", or "us") is committed to protecting the privacy and security of your health data.
                  This Privacy Policy explains how we collect, use, and safeguard information when you use our platform.
                </p>
              </div>
            </div>


            <div className="bg-blue-50 p-8 rounded-2xl border border-blue-100">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">1. Data Ownership & Sovereignty</h2>
              <div className="w-16 h-1 bg-blue-600 rounded-full mb-8"></div>
              <p>
                Unlike other platforms, Aarogya Nidhi does not own your clinical data. You retain full sovereignty over your institution's data at all times.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-4">2. Security Measures</h2>
              <ul className="list-disc pl-5 space-y-3 text-slate-600">
                <li>End-to-end AES-256 encryption</li>
                <li>Secure Infrastructure</li>
                <li>Multi-factor authentication (MFA) required for all clinical access</li>
                <li>Regular internal security audits</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Privacy;
