import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ProtectedEmail from './ProtectedEmail'; // <-- Убедитесь, что путь правильный

const PrivacyPolicyPage: React.FC = () => {
  const navigate = useNavigate();
  const lastUpdated = "July 2, 2025";

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
        <h1 className="text-2xl font-bold text-white mb-2">WeDealz Privacy Policy</h1>
        <p className="text-gray-400 mb-6">Effective Date: {lastUpdated}</p>

        <div className="prose prose-invert text-gray-300">
          <p className="mb-6">
            WeDealz (“WeDealz,” “we,” “us,” or “our”) values its users’ privacy. This Privacy Policy explains how we collect, use, and share information when you use our website, mobile application, and related services (collectively, the “Services”). By using our Services, you agree to the collection and use of information in accordance with this policy.
          </p>

          <h2 className="text-xl font-bold text-white mt-8 mb-4">1. Information We Collect</h2>
          <p className="mb-4">We collect information in a few different ways:</p>
          <ul className="list-disc pl-6 mb-4">
            <li><strong>Information You Provide to Us.</strong> We collect information you provide directly, such as when you create an account, submit a deal, comment, or contact us. This may include your name, email address, and username.</li>
            <li><strong>Information We Collect Automatically.</strong> When you use our Services, we automatically collect certain information, such as your IP address, browser type, operating system, and information about your usage of our Services (like pages visited and links clicked).</li>
            <li><strong>Information from Third Parties.</strong> If you choose to log in to our Services via a third-party service like Google or Facebook, we may receive information from that service, such as your public profile information.</li>
            <li><strong>Device and Location Information.</strong> We may collect information about the device you use to access our Services. With your consent, we may also collect information about your device’s location to help us provide more relevant deals.</li>
          </ul>

          <h2 className="text-xl font-bold text-white mt-8 mb-4">2. How We Use Your Information</h2>
          <p className="mb-4">
            We use the information we collect to:
          </p>
          <ul className="list-disc pl-6 mb-6">
            <li>Provide, maintain, and improve our Services.</li>
            <li>Communicate with you, including responding to your comments and questions.</li>
            <li>Personalize your experience on our Services.</li>
            <li>Monitor and analyze trends, usage, and activities in connection with our Services.</li>
            <li>Detect and prevent fraudulent transactions and other illegal activities.</li>
            <li>Display relevant advertising.</li>
          </ul>

          <h2 className="text-xl font-bold text-white mt-8 mb-4">3. How We Share Your Information</h2>
          <p className="mb-4">We may share information as follows:</p>
          <ul className="list-disc pl-6 mb-6">
            <li>With service providers who perform services for us (e.g., website hosting).</li>
            <li>With merchants and affiliate networks when you interact with a deal or offer.</li>
            <li>With advertising partners to show you ads that might interest you. You can learn more about opting out of interest-based advertising in the "Your Choices" section.</li>
            <li>If you post content in public areas of our Services (like comments), that information will be visible to the public.</li>
            <li>In connection with a business transaction like a merger or sale of our company.</li>
            <li>With law enforcement or in response to a legal request if we believe disclosure is required by law.</li>
          </ul>

          <h2 className="text-xl font-bold text-white mt-8 mb-4">4. Cookies and Advertising</h2>
          <p className="mb-4">
            We and our third-party partners use cookies and similar technologies to collect information, analyze trends, and deliver targeted advertising. Cookies are small data files stored on your hard drive or in device memory.
          </p>
          <p className="mb-6">
             Most web browsers are set to accept cookies by default. If you prefer, you can usually choose to set your browser to remove or reject browser cookies.
          </p>

          <h2 className="text-xl font-bold text-white mt-8 mb-4">5. Your Choices and Rights</h2>
          <ul className="list-disc pl-6 mb-6">
            <li><strong>Account Information.</strong> You may update or correct your account information at any time by logging into your account.</li>
            <li><strong>Promotional Emails.</strong> You may opt out of receiving promotional emails from us by following the instructions in those emails.</li>
            <li><strong>Data Rights.</strong> Depending on your location, you may have certain rights under local law, such as the right to access or delete your personal data. To make a request regarding your personal data, please contact us at <ProtectedEmail />. We will handle your request in accordance with applicable law.</li>
             <li><strong>Interest-Based Advertising.</strong> To learn more about interest-based advertising and how you may be able to opt-out, you can visit the Digital Advertising Alliance (DAA) at <a href="https://www.aboutads.info/choices" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">aboutads.info/choices</a>.</li>
          </ul>

          <h2 className="text-xl font-bold text-white mt-8 mb-4">6. Other Important Information</h2>
          <ul className="list-disc pl-6 mb-6">
            <li><strong>Data Security.</strong> We take reasonable measures to help protect your personal information. However, no electronic storage or transmission is 100% secure.</li>
            <li><strong>Children’s Privacy.</strong> Our Services are not intended for children under 16, and we do not knowingly collect personal information from them.</li>
            <li><strong>International Users.</strong> Our Services are hosted in the United States and intended for users in the U.S. By using our Services, you consent to the transfer and processing of your information in the U.S.</li>
            <li><strong>Loyalty Programs.</strong> In the future, we may offer loyalty or rewards programs. Participation will be optional, and the terms will be presented to you at that time.</li>
          </ul>

          <h2 className="text-xl font-bold text-white mt-8 mb-4">Changes to This Policy</h2>
          <p className="mb-6">
            We may change this Privacy Policy from time to time. If we make changes, we will notify you by revising the date at the top of the policy and, in some cases, we may provide you with additional notice.
          </p>

          <h2 className="text-xl font-bold text-white mt-8 mb-4">Contact Us</h2>
          <p className="mb-8">
            If you have any questions about this Privacy Policy, please contact us at: <ProtectedEmail />
          </p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;