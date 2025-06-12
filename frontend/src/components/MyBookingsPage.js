import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Briefcase, CalendarDays, MapPin, Info, Clock, CheckCircle, XCircle, RefreshCw, Edit3, Eye, PlusCircle, FileText, DollarSign, Users, Loader2, AlertCircle, Trash2 } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const MyBookingsPage = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('drafts');
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUserTripsAndBookings = useCallback(async () => {
    if (!token) {
      setError("Authentication required. Please log in.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Fetch all custom trips (includes drafts, planned, booked etc.)
      const response = await axios.get(`${API_URL}/trips/custom`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTrips(response.data || []);
    } catch (err) {
      console.error("Error fetching user trips and bookings:", err);
      const errMsg = err.response?.data?.message || "Failed to load your trips and bookings.";
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchUserTripsAndBookings();
  }, [fetchUserTripsAndBookings]);

  const categorizeTrips = () => {
    const now = new Date();
    const draftTrips = trips.filter(trip => trip.status === 'draft' || trip.status === 'planned');
    const upcomingBookings = trips.filter(trip => trip.status === 'booked' && new Date(trip.start_date) >= now);
    const pastBookings = trips.filter(trip => trip.status === 'completed' || trip.status === 'cancelled' || (trip.status === 'booked' && new Date(trip.start_date) < now));
    return { draftTrips, upcomingBookings, pastBookings };
  };

  const { draftTrips, upcomingBookings, pastBookings } = categorizeTrips();

  const handleCancelBooking = async (tripId) => {
    // Placeholder for cancellation logic
    // In a real app, this would call a backend endpoint:
    // POST /api/trips/custom/:tripId/cancel or /api/bookings/:bookingId/cancel
    toast.info(`Cancellation for trip ID ${tripId} initiated (Placeholder).`);
    // Optimistically update UI or re-fetch:
    // setTrips(prev => prev.map(t => t.id === tripId ? {...t, status: 'cancelled'} : t));
  };
  
  const handleDeleteDraft = async (tripId) => {
    if (!window.confirm("Are you sure you want to delete this draft trip? This action cannot be undone.")) {
        return;
    }
    try {
        await axios.delete(`${API_URL}/trips/custom/${tripId}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        toast.success("Draft trip deleted successfully.");
        fetchUserTripsAndBookings(); // Re-fetch to update the list
    } catch (err) {
        console.error("Error deleting draft trip:", err);
        toast.error(err.response?.data?.message || "Failed to delete draft trip.");
    }
  };


  const TripCard = ({ trip }) => {
    let statusIcon, statusColor, statusText;
    const now = new Date(); // Define now here to use in conditions
    switch (trip.status) {
      case 'draft':
        statusIcon = <Edit3 className="text-yellow-500" />;
        statusColor = 'text-yellow-600 bg-yellow-100';
        statusText = 'Draft';
        break;
      case 'planned':
        statusIcon = <CalendarDays className="text-blue-500" />;
        statusColor = 'text-blue-600 bg-blue-100';
        statusText = 'Planned';
        break;
      case 'booked':
        statusIcon = <CheckCircle className="text-green-500" />;
        statusColor = 'text-green-600 bg-green-100';
        statusText = 'Booked & Confirmed';
        break;
      case 'completed':
        statusIcon = <CheckCircle className="text-gray-500" />;
        statusColor = 'text-gray-600 bg-gray-100';
        statusText = 'Completed';
        break;
      case 'cancelled':
        statusIcon = <XCircle className="text-red-500" />;
        statusColor = 'text-red-600 bg-red-100';
        statusText = 'Cancelled';
        break;
      default:
        statusIcon = <Info className="text-gray-500" />;
        statusColor = 'text-gray-600 bg-gray-100';
        statusText = trip.status ? trip.status.charAt(0).toUpperCase() + trip.status.slice(1) : 'Unknown';
    }

    return (
      <div className="bg-white p-5 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 flex flex-col justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2 truncate">{trip.title || "Untitled Trip"}</h3>
          <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor} mb-3`}>
            {React.cloneElement(statusIcon, { className: "h-4 w-4 mr-1.5"})}
            {statusText}
          </div>
          {trip.booking_reference && (
            <p className="text-xs text-gray-500 mb-1">Ref: {trip.booking_reference}</p>
          )}
          <div className="text-sm text-gray-600 space-y-1 mb-3">
            {trip.start_date && (
              <div className="flex items-center">
                <CalendarDays className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                <span>{new Date(trip.start_date).toLocaleDateString()} - {trip.end_date ? new Date(trip.end_date).toLocaleDateString() : 'N/A'}</span>
              </div>
            )}
            {trip.destinations && ( // Assuming destinations is a field in tripData
              <div className="flex items-center">
                <MapPin className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                <span className="truncate">{trip.destinations}</span>
              </div>
            )}
             {trip.number_of_travelers && (
              <div className="flex items-center">
                <Users className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                <span>{trip.number_of_travelers} Traveler(s)</span>
              </div>
            )}
            {trip.total_price !== null && trip.total_price !== undefined && (
                <div className="flex items-center font-medium">
                    <DollarSign className="h-4 w-4 mr-2 text-green-500 flex-shrink-0" />
                    <span>{trip.currency || 'USD'} {parseFloat(trip.total_price).toFixed(2)}</span>
                </div>
            )}
          </div>
          {/* Placeholder for components summary */}
          {trip.components && trip.components.length > 0 && (
            <p className="text-xs text-gray-500 mb-3">{trip.components.length} component(s) in this trip.</p>
          )}
        </div>
        <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap gap-2">
          {(trip.status === 'draft' || trip.status === 'planned') && (
            <Link
              to={`/customize-trip/${trip.id}`} // Assuming a route like this for editing
              className="flex-1 text-center min-w-[100px] bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-3 rounded-md text-sm transition duration-150 ease-in-out flex items-center justify-center"
            >
              <Edit3 className="h-4 w-4 mr-1.5" /> Edit Trip
            </Link>
          )}
           {(trip.status === 'draft' || trip.status === 'planned') && (
            <button
              onClick={() => handleDeleteDraft(trip.id)}
              className="flex-1 text-center min-w-[100px] bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-3 rounded-md text-sm transition duration-150 ease-in-out flex items-center justify-center"
            >
              <Trash2 className="h-4 w-4 mr-1.5" /> Delete Draft
            </button>
          )}
          {trip.status === 'booked' && (
            <button
              onClick={() => toast.info(`View details for booking ${trip.id} (Placeholder)`)}
              className="flex-1 text-center min-w-[100px] bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-3 rounded-md text-sm transition duration-150 ease-in-out flex items-center justify-center"
            >
              <Eye className="h-4 w-4 mr-1.5" /> View Booking
            </button>
          )}
          {trip.status === 'booked' && new Date(trip.start_date) > now && ( // Only allow cancel for future bookings
            <button
              onClick={() => handleCancelBooking(trip.id)}
              className="flex-1 text-center min-w-[100px] bg-gray-300 hover:bg-gray-400 text-gray-700 font-medium py-2 px-3 rounded-md text-sm transition duration-150 ease-in-out flex items-center justify-center"
            >
              <XCircle className="h-4 w-4 mr-1.5" /> Cancel
            </button>
          )}
          {(trip.status === 'completed' || trip.status === 'cancelled' || (trip.status === 'booked' && new Date(trip.start_date) < now)) && (
             <button
              onClick={() => toast.info(`View details for past trip ${trip.id} (Placeholder)`)}
              className="flex-1 text-center min-w-[100px] bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-3 rounded-md text-sm transition duration-150 ease-in-out flex items-center justify-center"
            >
              <FileText className="h-4 w-4 mr-1.5" /> View Details
            </button>
          )}
        </div>
      </div>
    );
  };

  const TabButton = ({ label, isActive, onClick, count }) => (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors duration-150
        ${isActive ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
    >
      {label} {count > 0 && <span className={`ml-1.5 px-2 py-0.5 rounded-full text-xs ${isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{count}</span>}
    </button>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
        </div>
      );
    }
    if (error) {
      return (
        <div className="text-center py-20 bg-white rounded-lg shadow p-6">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-red-700 mb-2">Error Loading Trips</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button onClick={fetchUserTripsAndBookings} className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition">Try Again</button>
        </div>
      );
    }

    let currentList = [];
    let emptyStateMessage = "No items in this category yet.";
    let emptyStateIcon = <Info className="h-8 w-8 mx-auto mb-2 text-gray-400" />;

    if (activeTab === 'drafts') {
      currentList = draftTrips;
      emptyStateMessage = "You have no draft or planned trips. Start planning your next adventure!";
      emptyStateIcon = <PlusCircle className="h-8 w-8 mx-auto mb-2 text-blue-400" />;
    } else if (activeTab === 'upcoming') {
      currentList = upcomingBookings;
      emptyStateMessage = "No upcoming bookings. Time to book an adventure!";
      emptyStateIcon = <CalendarDays className="h-8 w-8 mx-auto mb-2 text-green-400" />;
    } else if (activeTab === 'past') {
      currentList = pastBookings;
      emptyStateMessage = "No past bookings found in your history.";
      emptyStateIcon = <Clock className="h-8 w-8 mx-auto mb-2 text-gray-400" />;
    }

    if (currentList.length === 0) {
      return (
        <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
          {emptyStateIcon}
          {emptyStateMessage}
          {activeTab === 'drafts' && (
            <Link to="/customize-trip" className="mt-4 inline-flex items-center bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg">
              <PlusCircle className="h-5 w-5 mr-2" />
              Create New Trip
            </Link>
          )}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {currentList.map(trip => <TripCard key={trip.id} trip={trip} />)}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <header className="mb-6 md:mb-8">
        <div className="flex items-center">
          <Briefcase className="h-8 w-8 md:h-10 md:w-10 mr-3 text-blue-600" />
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">My Trips & Bookings</h1>
        </div>
        {user && <p className="text-gray-600 mt-1 text-sm md:text-base">Manage your adventure plans, {user.firstName}.</p>}
      </header>

      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-2 sm:space-x-4 overflow-x-auto" aria-label="Tabs">
          <TabButton label="Drafts & Planned" isActive={activeTab === 'drafts'} onClick={() => setActiveTab('drafts')} count={draftTrips.length} />
          <TabButton label="Upcoming Bookings" isActive={activeTab === 'upcoming'} onClick={() => setActiveTab('upcoming')} count={upcomingBookings.length} />
          <TabButton label="Past Bookings" isActive={activeTab === 'past'} onClick={() => setActiveTab('past')} count={pastBookings.length} />
        </nav>
      </div>

      <div>
        {renderContent()}
      </div>
    </div>
  );
};

export default MyBookingsPage;
