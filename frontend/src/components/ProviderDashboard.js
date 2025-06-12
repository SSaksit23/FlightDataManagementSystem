import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { LayoutDashboard, ListChecks, CalendarDays, UserCircle, BarChart3, PlusCircle, Edit, AlertCircle, Loader2, Eye, Trash2, DollarSign, Tag, Info, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'react-toastify';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const ProviderDashboard = () => {
  const { user, token } = useAuth();
  const [profile, setProfile] = useState(null);
  const [listings, setListings] = useState([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingListings, setLoadingListings] = useState(true);
  const [errorProfile, setErrorProfile] = useState(null);
  const [errorListings, setErrorListings] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!token) {
        setLoadingProfile(false);
        setErrorProfile("Authentication token not found. Please log in.");
        return;
      }
      try {
        setLoadingProfile(true);
        const response = await axios.get(`${API_URL}/providers/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setProfile(response.data);
        setErrorProfile(null);
      } catch (err) {
        console.error("Error fetching provider profile:", err);
        setErrorProfile(err.response?.data?.message || "Failed to fetch provider profile. You might need to create one first.");
        if (err.response?.status === 404) {
            toast.info("Provider profile not found. Please create your provider profile.");
        } else {
            toast.error(err.response?.data?.message || "Error fetching profile.");
        }
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchProfile();
  }, [token]);

  useEffect(() => {
    const fetchListings = async () => {
      if (!token) {
        setLoadingListings(false);
        setErrorListings("Authentication token not found. Please log in.");
        return;
      }
      // Only fetch listings if profile exists and is verified (or adjust based on requirements)
      // For now, we'll fetch if profile is loaded, assuming provider might have listings even if profile is basic.
      // Or, we can depend on `profile` state to only fetch listings if profile is successfully loaded.
      // Let's fetch if token exists, and handle profile dependency implicitly.
      try {
        setLoadingListings(true);
        const response = await axios.get(`${API_URL}/providers/listings`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setListings(response.data);
        setErrorListings(null);
      } catch (err) {
        console.error("Error fetching provider listings:", err);
        setErrorListings(err.response?.data?.message || "Failed to fetch listings.");
        toast.error(err.response?.data?.message || "Error fetching listings.");
      } finally {
        setLoadingListings(false);
      }
    };

    fetchListings();
  }, [token]);

  const stats = [
    { name: 'Active Listings', value: listings.filter(l => l.status === 'published').length, icon: <ListChecks className="h-6 w-6 text-blue-500" /> },
    { name: 'Total Listings', value: listings.length, icon: <ListChecks className="h-6 w-6 text-blue-500" /> },
    { name: 'Upcoming Bookings', value: '0', icon: <CalendarDays className="h-6 w-6 text-green-500" /> }, // Placeholder
    { name: 'Profile Status', value: profile?.verification_status || 'N/A', icon: <UserCircle className="h-6 w-6 text-orange-500" /> },
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'published': return 'bg-green-100 text-green-700';
      case 'draft': return 'bg-yellow-100 text-yellow-700';
      case 'archived': return 'bg-gray-100 text-gray-700';
      case 'suspended': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };
  
  const getVerificationStatusInfo = (status) => {
    switch (status) {
      case 'verified': return { text: 'Verified', color: 'text-green-600', icon: <CheckCircle className="h-4 w-4 mr-1" /> };
      case 'pending': return { text: 'Pending Verification', color: 'text-yellow-600', icon: <Loader2 className="h-4 w-4 mr-1 animate-spin" /> };
      case 'rejected': return { text: 'Verification Rejected', color: 'text-red-600', icon: <XCircle className="h-4 w-4 mr-1" /> };
      default: return { text: 'Not Submitted', color: 'text-gray-500', icon: <Info className="h-4 w-4 mr-1" /> };
    }
  };

  if (loadingProfile || loadingListings) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
        <p className="ml-4 text-lg text-gray-700">Loading Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Provider Dashboard</h1>
        {user && <p className="text-gray-600">Welcome back, {profile?.business_name || user.firstName}!</p>}
      </header>

      {/* Profile Status and Actions */}
      {errorProfile && !profile && (
         <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg flex items-center">
           <AlertCircle className="h-5 w-5 mr-2" />
           <span>{errorProfile} 
           {errorProfile.includes("create one first") && 
            <Link to="/provider/profile/edit" className="font-semibold underline ml-1 hover:text-red-800">Create Profile</Link>}
           </span>
         </div>
      )}
      {profile && (
        <section className="mb-8 bg-white p-6 rounded-xl shadow-lg">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <div>
              <h2 className="text-2xl font-semibold text-gray-800">{profile.business_name || "Your Business"}</h2>
              <div className="flex items-center mt-1">
                {getVerificationStatusInfo(profile.verification_status).icon}
                <span className={`text-sm font-medium ${getVerificationStatusInfo(profile.verification_status).color}`}>
                  {getVerificationStatusInfo(profile.verification_status).text}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">Specialties: {profile.specialty_areas?.join(', ') || 'Not set'}</p>
            </div>
            <div className="mt-4 sm:mt-0">
              <Link
                to="/provider/profile/edit" // Assuming a route for profile editing
                className="flex items-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition duration-150 ease-in-out"
              >
                <Edit className="h-5 w-5 mr-2" />
                Manage Profile
              </Link>
            </div>
          </div>
          {profile.verification_status !== 'verified' && (
            <div className="mt-4 p-3 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-md text-sm">
              <Info className="h-5 w-5 inline mr-1" />
              Your profile is currently <strong>{profile.verification_status || 'not submitted'}</strong>. 
              {profile.verification_status === 'pending' && " It's under review. You'll be notified once it's processed."}
              {profile.verification_status !== 'pending' && profile.verification_status !== 'verified' && " Please complete your profile and submit for verification to publish listings."}
              {profile.verification_status !== 'verified' && 
                <Link to="/provider/profile/verify" className="font-semibold underline ml-1 hover:text-yellow-800">
                  {profile.verification_documents ? 'Update Verification' : 'Submit for Verification'}
                </Link>
              }
            </div>
          )}
        </section>
      )}

      {/* Stats Overview */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-white p-6 rounded-xl shadow-lg flex items-center space-x-4">
            <div className="p-3 bg-gray-100 rounded-full">
              {stat.icon}
            </div>
            <div>
              <p className="text-sm text-gray-500">{stat.name}</p>
              <p className="text-2xl font-semibold text-gray-800">{stat.value}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Create New Listing Action */}
      <section className="mb-8">
         <Link
            to="/provider/listings/new" // Assuming a route for creating new listing
            className="inline-flex items-center bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition duration-150 ease-in-out text-lg shadow-md hover:shadow-lg"
          >
            <PlusCircle className="h-6 w-6 mr-2" />
            Create New Listing
          </Link>
      </section>
      
      {/* Listings Section */}
      <section className="bg-white p-6 rounded-xl shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <ListChecks className="h-8 w-8 text-blue-600 mr-3" />
            <h2 className="text-xl font-semibold text-gray-700">My Service Listings</h2>
          </div>
          {/* Add sorting/filtering options here later */}
        </div>
        {errorListings && (
          <div className="mb-4 p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            <span>{errorListings}</span>
          </div>
        )}
        {listings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {listings.map((listing) => (
                  <tr key={listing.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{listing.title}</div>
                      <div className="text-xs text-gray-500">{listing.custom_location?.city || listing.location_city || 'Online/Various'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(listing.status)}`}>
                        {listing.status.charAt(0).toUpperCase() + listing.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      <DollarSign className="h-4 w-4 inline mr-1 text-green-500" />
                      {listing.base_price} {listing.currency}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <Tag className="h-4 w-4 inline mr-1 text-purple-500" />
                      {listing.category_name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <Link to={`/provider/listings/edit/${listing.id}`} className="text-indigo-600 hover:text-indigo-900" title="Edit">
                        <Edit className="h-5 w-5 inline" />
                      </Link>
                      <Link to={`/listing/${listing.id}`} target="_blank" className="text-blue-600 hover:text-blue-900" title="View Listing">
                         <Eye className="h-5 w-5 inline" />
                      </Link>
                      <button onClick={() => console.log(`Delete listing ${listing.id}`)} className="text-red-600 hover:text-red-900" title="Delete (Placeholder)">
                        <Trash2 className="h-5 w-5 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-gray-500">You haven't created any listings yet.</p>
            <Link
              to="/provider/listings/new"
              className="mt-4 inline-flex items-center bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg"
            >
              <PlusCircle className="h-5 w-5 mr-2" />
              Create Your First Listing
            </Link>
          </div>
        )}
      </section>

      {/* Other sections like Bookings, Analytics will be added later */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
         <section className="bg-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center mb-4">
            <CalendarDays className="h-8 w-8 text-green-600 mr-3" />
            <h2 className="text-xl font-semibold text-gray-700">Bookings</h2>
          </div>
          <p className="text-gray-600 mb-4">
            View upcoming bookings, manage traveler requests, and see your booking history.
          </p>
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-gray-500">Booking management feature is under development.</p>
          </div>
        </section>

        <section className="bg-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center mb-4">
            <BarChart3 className="h-8 w-8 text-purple-600 mr-3" />
            <h2 className="text-xl font-semibold text-gray-700">Analytics & Reports</h2>
          </div>
          <p className="text-gray-600 mb-4">
            Track your earnings, view performance metrics for your listings, and get insights into traveler trends.
          </p>
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-gray-500">Analytics feature is under development.</p>
          </div>
        </section>
      </div>

    </div>
  );
};

export default ProviderDashboard;
