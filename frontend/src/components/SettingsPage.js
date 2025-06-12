import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Settings, UserCog, BellRing, CreditCard, Shield, Lock, Palette, Globe } from 'lucide-react';

const SettingsPage = () => {
  const { user } = useAuth(); // For future use, e.g., displaying user-specific settings

  const SettingsSection = ({ title, icon, children, statusText = "Feature under development." }) => (
    <div className="bg-white p-6 rounded-xl shadow-lg mb-6">
      <div className="flex items-center mb-4">
        {React.cloneElement(icon, { className: "h-6 w-6 text-blue-600 mr-3" })}
        <h3 className="text-xl font-semibold text-gray-700">{title}</h3>
      </div>
      <div className="text-gray-600 space-y-2">
        {children}
      </div>
      {statusText && <p className="mt-4 text-sm text-gray-500 italic">{statusText}</p>}
    </div>
  );

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <header className="mb-8">
        <div className="flex items-center">
          <Settings className="h-10 w-10 mr-3 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Settings</h1>
            {user && <p className="text-gray-600">Manage your account and platform preferences, {user.firstName}.</p>}
            {!user && <p className="text-gray-600">Manage your account and platform preferences.</p>}
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto">
        <SettingsSection title="Account Settings" icon={<UserCog />}>
          <p>Update your personal information, email address, and profile details.</p>
          <button className="mt-3 text-sm text-blue-500 hover:text-blue-600 disabled:opacity-50" disabled>
            Edit Profile Information (Coming Soon)
          </button>
          <p className="mt-2">Change your password or manage linked social accounts.</p>
          <button className="mt-1 text-sm text-blue-500 hover:text-blue-600 disabled:opacity-50" disabled>
            Manage Login & Password (Coming Soon)
          </button>
        </SettingsSection>

        <SettingsSection title="Notification Preferences" icon={<BellRing />}>
          <p>Choose how you want to be notified about bookings, messages, and platform updates.</p>
          <div className="mt-3 space-y-2">
            <label className="flex items-center">
              <input type="checkbox" className="form-checkbox h-4 w-4 text-blue-600 rounded mr-2" disabled />
              Email notifications for new bookings
            </label>
            <label className="flex items-center">
              <input type="checkbox" className="form-checkbox h-4 w-4 text-blue-600 rounded mr-2" disabled />
              In-app notifications for messages
            </label>
            <label className="flex items-center">
              <input type="checkbox" className="form-checkbox h-4 w-4 text-blue-600 rounded mr-2" disabled />
              Promotional emails and newsletters
            </label>
          </div>
          <button className="mt-3 text-sm text-blue-500 hover:text-blue-600 disabled:opacity-50" disabled>
            Save Notification Settings (Coming Soon)
          </button>
        </SettingsSection>

        <SettingsSection title="Payment Methods" icon={<CreditCard />}>
          <p>Manage your saved payment methods for bookings and other transactions.</p>
          <p className="mt-2">You have no saved payment methods. (Placeholder)</p>
          <button className="mt-3 text-sm text-blue-500 hover:text-blue-600 disabled:opacity-50" disabled>
            Add New Payment Method (Coming Soon)
          </button>
        </SettingsSection>

        <SettingsSection title="Security & Privacy" icon={<Shield />}>
          <p>Review your security settings, manage data privacy, and view login activity.</p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
            <li>Two-Factor Authentication (2FA) - Coming Soon</li>
            <li>Login History - Coming Soon</li>
            <li>Data Download Request - Coming Soon</li>
            <li>Account Deletion - Coming Soon</li>
          </ul>
          <button className="mt-3 text-sm text-blue-500 hover:text-blue-600 disabled:opacity-50" disabled>
            Manage Security Settings (Coming Soon)
          </button>
        </SettingsSection>
        
        <SettingsSection title="Appearance" icon={<Palette />}>
          <p>Customize the look and feel of the platform.</p>
          <div className="mt-3">
            <label htmlFor="theme-select" className="block text-sm font-medium text-gray-700">Theme</label>
            <select id="theme-select" name="theme" className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md disabled:opacity-50" disabled>
              <option>System Default</option>
              <option>Light Mode</option>
              <option>Dark Mode</option>
            </select>
          </div>
           <p className="mt-2 text-xs text-gray-400">Theme selection feature is under development.</p>
        </SettingsSection>

        <SettingsSection title="Language & Region" icon={<Globe />}>
          <p>Set your preferred language and region for localized content.</p>
           <div className="mt-3">
            <label htmlFor="language-select" className="block text-sm font-medium text-gray-700">Language</label>
            <select id="language-select" name="language" className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md disabled:opacity-50" disabled>
              <option>English (United States)</option>
              <option>Español</option>
              <option>Français</option>
            </select>
          </div>
          <p className="mt-2 text-xs text-gray-400">Language and region settings are under development.</p>
        </SettingsSection>
      </div>
    </div>
  );
};

export default SettingsPage;
