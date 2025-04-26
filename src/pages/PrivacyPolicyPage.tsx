import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PrivacyPolicyPage: React.FC = () => {
  const navigate = useNavigate();
  const lastUpdated = new Date().toLocaleDateString();

  return (
    <div className="min-h-screen bg-gray-900 pb-16 pt-16">
      <div className="fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-800 px-4 py-3 z-10">
        <div className="flex items-center">
          <button onClick={() => navigate(-1)} className="text-white">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-white font-medium ml-4">Privacy Policy</h1>
        </div>
      </div>

      <div className="px-4 py-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-2">DiscountHUB Privacy Policy</h1>
        <p className="text-gray-400 mb-6">Last Updated: {lastUpdated}</p>

        <div className="prose prose-invert">
          <p className="text-gray-300 mb-6">
            DiscountHUB ("we," "us," or "our") respects your privacy and is committed to protecting your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your data when you use our website, mobile applications, and services (collectively, the "Services").
          </p>

          <p className="text-gray-300 mb-6">
            By accessing or using DiscountHUB, you agree to the terms of this Privacy Policy. If you do not agree, please do not use our Services.
          </p>

          <h2 className="text-xl font-bold text-white mt-8 mb-4">1. Information We Collect</h2>
          
          <p className="text-gray-300 mb-4">We may collect the following types of information:</p>

          <h3 className="text-lg font-semibold text-white mt-6 mb-3">A. Information You Provide Directly</h3>
          <ul className="list-disc pl-6 text-gray-300 mb-4">
            <li>Account registration details (username, email, password)</li>
            <li>Profile information (name, location, preferences)</li>
            <li>User-generated content (deal submissions, comments, votes)</li>
            <li>Communications with DiscountHUB (support requests, feedback)</li>
          </ul>

          <h3 className="text-lg font-semibold text-white mt-6 mb-3">B. Automatically Collected Information</h3>
          <ul className="list-disc pl-6 text-gray-300 mb-4">
            <li>Device and usage data (IP address, browser type, operating system)</li>
            <li>Cookies and tracking technologies (see "Cookies" section below)</li>
            <li>Interactions with our Services (pages visited, clicks, time spent)</li>
          </ul>

          <h3 className="text-lg font-semibold text-white mt-6 mb-3">C. Information from Third Parties</h3>
          <ul className="list-disc pl-6 text-gray-300 mb-4">
            <li>Social media platforms (if you connect your account)</li>
            <li>Advertisers and analytics providers</li>
          </ul>

          <h2 className="text-xl font-bold text-white mt-8 mb-4">2. How We Use Your Information</h2>
          
          <p className="text-gray-300 mb-4">We may use your information to:</p>
          <ul className="list-disc pl-6 text-gray-300 mb-6">
            <li>Provide, maintain, and improve our Services</li>
            <li>Personalize your experience and show relevant deals</li>
            <li>Communicate with you (updates, promotions, customer support)</li>
            <li>Monitor and analyze trends and usage</li>
            <li>Detect and prevent fraud and abuse</li>
          </ul>

          <h2 className="text-xl font-bold text-white mt-8 mb-4">3. Sharing of Information</h2>
          
          <p className="text-gray-300 mb-4">We may share your data in the following cases:</p>
          <ul className="list-disc pl-6 text-gray-300 mb-6">
            <li>With your consent (e.g., for third-party promotions)</li>
            <li>Service providers (hosting, analytics, payment processors)</li>
            <li>Legal compliance (if required by law or to protect rights)</li>
            <li>Business transfers (merger, acquisition, or sale of assets)</li>
          </ul>

          <h2 className="text-xl font-bold text-white mt-8 mb-4">4. Cookies & Tracking Technologies</h2>
          
          <p className="text-gray-300 mb-6">
            DiscountHUB uses cookies and similar technologies to enhance user experience, analyze trends, and deliver targeted ads. You can manage cookie preferences in your browser settings.
          </p>

          <h2 className="text-xl font-bold text-white mt-8 mb-4">5. Your Privacy Choices</h2>
          
          <ul className="list-disc pl-6 text-gray-300 mb-6">
            <li>Account settings: Update or delete your information</li>
            <li>Opt-out of marketing emails: Unsubscribe via email footer</li>
            <li>Disable cookies: Adjust browser settings</li>
          </ul>

          <h2 className="text-xl font-bold text-white mt-8 mb-4">6. Data Security</h2>
          
          <p className="text-gray-300 mb-6">
            We implement industry-standard measures to protect your data, but no method is 100% secure. Please use strong passwords and report suspicious activity.
          </p>

          <h2 className="text-xl font-bold text-white mt-8 mb-4">7. Children's Privacy</h2>
          
          <p className="text-gray-300 mb-6">
            DiscountHUB is not intended for users under 13. We do not knowingly collect data from children.
          </p>

          <h2 className="text-xl font-bold text-white mt-8 mb-4">8. Changes to This Policy</h2>
          
          <p className="text-gray-300 mb-6">
            We may update this Privacy Policy periodically. Continued use of DiscountHUB after changes constitutes acceptance.
          </p>

          <h2 className="text-xl font-bold text-white mt-8 mb-4">9. Contact Us</h2>
          
          <p className="text-gray-300 mb-2">For questions or concerns about this Privacy Policy, contact us at:</p>
          <p className="text-gray-300">Email: privacy@discounthub.com</p>
          <p className="text-gray-300 mb-8">Address: USA</p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;