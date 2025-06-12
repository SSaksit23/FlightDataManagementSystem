import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User, Settings, Briefcase, Star, Edit2, Shield, Bell, Heart, Camera } from 'lucide-react';

const UserProfilePage = () => {
  const { user } = useAuth();

  const SectionCard = ({ title, icon, children, statusText = "Feature under development." }) => (
    <div className="bg-white p-6 rounded-xl shadow-lg">
      <div className="flex items-center mb-4">
        {React.cloneElement(icon, { className: "h-6 w-6 text-blue-600 mr-3" })}
        <h3 className="text-xl font-semibold text-gray-700">{title}</h3>
      </div>
      <div className="text-gray-600">
        {children}
      </div>
      {statusText && <p className="mt-4 text-sm text-gray-500 italic">{statusText}</p>}
    </div>
  );

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <header className="mb-8">
        <div className="flex items-center">
          <User className="h-10 w-10 mr-3 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-800">My Profile</h1>
            {user && <p className="text-gray-600">Manage your personal information and preferences, {user.firstName}.</p>}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Profile Details & Preferences */}
        <div className="lg:col-span-2 space-y-8">
          <SectionCard title="Personal Information" icon={<Edit2 />}>
            <div className="space-y-3">
              <p><strong>Name:</strong> {user?.firstName} {user?.lastName} (Placeholder)</p>
              <p><strong>Email:</strong> {user?.email} (Placeholder)</p>
              <p><strong>Phone:</strong> Not set (Placeholder)</p>
              <p><strong>Bio:</strong> Tell us a bit about yourself! (Placeholder)</p>
            </div>
            <button className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50" disabled>
              Edit Personal Info (Coming Soon)
            </button>
          </SectionCard>

          <SectionCard title="Travel Preferences" icon={<Settings />}>
            <p>Customize your travel style for better recommendations.</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
              <li>Preferred Adventure Types: (e.g., Hiking, Cultural, Culinary)</li>
              <li>Accommodation Style: (e.g., Boutique, Eco-lodge, Luxury)</li>
              <li>Travel Pace: (e.g., Relaxed, Moderate, Fast-paced)</li>
            </ul>
            <button className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50" disabled>
              Update Preferences (Coming Soon)
            </button>
          </SectionCard>

          <SectionCard title="Profile Picture" icon={<Camera />}>
            <div className="flex items-center space-x-4">
              <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center">
                <User className="h-12 w-12 text-gray-400" />
              </div>
              <div>
                <p>Upload a profile picture to personalize your account.</p>
                <button className="mt-2 text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 py-1 px-3 rounded-md disabled:opacity-50" disabled>
                  Upload Image (Coming Soon)
                </button>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Right Column: Activity & Settings */}
        <div className="lg:col-span-1 space-y-8">
          <SectionCard title="Booking History" icon={<Briefcase />}>
            <p>View all your past and upcoming trips booked through AdventureConnect.</p>
             <button className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50" disabled>
              View My Bookings (Coming Soon)
            </button>
          </SectionCard>

          <SectionCard title="My Reviews" icon={<Star />}>
            <p>See reviews you've written and manage your feedback on experiences.</p>
            <button className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50" disabled>
              View My Reviews (Coming Soon)
            </button>
          </SectionCard>
          
          <SectionCard title="Wishlist" icon={<Heart />}>
            <p>Access your saved adventures and dream trips.</p>
            <button className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50" disabled>
              View My Wishlist (Coming Soon)
            </button>
          </SectionCard>

          <SectionCard title="Account Settings" icon={<Shield />}>
            <p>Manage your login credentials, notification preferences, and account security.</p>
            <button className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50" disabled>
              Go to Settings (Coming Soon)
            </button>
          </SectionCard>

          <SectionCard title="Notifications" icon={<Bell />}>
            <p>Check your latest notifications and alerts from the platform.</p>
            <button className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50" disabled>
              View Notifications (Coming Soon)
            </button>
          </SectionCard>
        </div>
      </div>
    </div>
  );
};

export default UserProfilePage;
