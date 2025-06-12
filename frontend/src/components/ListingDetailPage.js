import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  MapPin, Star, Users, CalendarDays, Clock, FileText, CheckCircle, XCircle,
  ImageIcon, DollarSign, MessageSquare, UserCircle, ShieldCheck, ThumbsUp,
  ListChecks, GalleryThumbnails, ShoppingCart, ChevronLeft, ChevronRight, Share2, AlertTriangle, Loader2, Maximize, X as XIcon
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const ImageModal = ({ isOpen, onClose, images, currentIndex, setCurrentIndex }) => {
  if (!isOpen || !images || images.length === 0) return null;

  const nextImage = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + images.length) % images.length);
  };
  
  const currentImage = images[currentIndex];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="relative bg-white p-4 rounded-lg max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-3 -right-3 bg-white text-gray-700 rounded-full p-1.5 shadow-md hover:bg-gray-100 z-10">
          <XIcon className="h-5 w-5" />
        </button>
        <div className="relative w-full h-full max-h-[80vh] flex flex-col items-center">
          <img 
            src={currentImage?.url ? `${API_URL.replace('/api', '')}${currentImage.url}` : `https://via.placeholder.com/800x500?text=Image+Not+Available`} 
            alt={currentImage?.caption || `Listing Image ${currentIndex + 1}`} 
            className="max-w-full max-h-[70vh] object-contain rounded-md"
          />
          {currentImage?.caption && <p className="text-center text-sm text-gray-600 mt-2">{currentImage.caption}</p>}
        </div>
        {images.length > 1 && (
          <>
            <button onClick={prevImage} className="absolute left-2 sm:left-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-75">
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button onClick={nextImage} className="absolute right-2 sm:right-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-75">
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};


const ListingDetailPage = () => {
  const { listingId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [currentImageInModal, setCurrentImageInModal] = useState(0);

  const fetchListingDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Assuming a public endpoint for fetching listing details including media and itinerary
      // The backend GET /api/providers/listings/:listingId already fetches components and media if owned.
      // For a public page, we need a public equivalent. Let's assume `/api/listings/public/${listingId}`
      const response = await axios.get(`${API_URL}/listings/public/${listingId}`);
      setListing(response.data);
    } catch (err) {
      console.error("Error fetching listing details:", err);
      if (err.response?.status === 404) {
        setError("Listing not found. It might have been removed or the link is incorrect.");
        toast.error("Listing not found.");
      } else {
        setError("Failed to load listing details. Please try again later.");
        toast.error("Failed to load listing details.");
      }
    } finally {
      setLoading(false);
    }
  }, [listingId]);

  useEffect(() => {
    fetchListingDetails();
  }, [fetchListingDetails]);

  const handleImageClick = (index) => {
    setCurrentImageInModal(index);
    setShowImageModal(true);
  };

  const Section = ({ title, icon, children, className = "" }) => (
    <section className={`py-6 border-b border-gray-200 last:border-b-0 ${className}`}>
      <div className="flex items-center mb-4">
        {React.cloneElement(icon, { className: "h-6 w-6 text-blue-600 mr-3 flex-shrink-0" })}
        <h2 className="text-2xl font-semibold text-gray-800">{title}</h2>
      </div>
      {children}
    </section>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-150px)]">
        <Loader2 className="h-16 w-16 animate-spin text-blue-600" />
        <p className="ml-4 text-xl text-gray-700">Loading Adventure Details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 max-w-2xl mx-auto">
        <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-gray-800 mb-3">Oops! Something went wrong.</h1>
        <p className="text-gray-600 mb-6">{error}</p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition"
        >
          Go to Homepage
        </button>
      </div>
    );
  }

  if (!listing) {
    // This case should ideally be covered by the error state if API returns 404
    return (
        <div className="text-center py-20">
             <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-800">Listing Not Available</h1>
            <p className="text-gray-600">The requested listing could not be found.</p>
        </div>
    );
  }
  
  const featuredMedia = listing.media?.find(m => m.is_featured) || listing.media?.[0];
  const otherMedia = listing.media?.filter(m => m.id !== featuredMedia?.id).slice(0, 4) || [];


  return (
    <div className="bg-gray-50 min-h-screen py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Breadcrumbs */}
        <nav className="text-sm text-gray-500 mb-4" aria-label="Breadcrumb">
          <ol className="list-none p-0 inline-flex">
            <li className="flex items-center">
              <Link to="/" className="hover:text-blue-600">Home</Link>
              <ChevronRight className="h-4 w-4 mx-1" />
            </li>
            <li className="flex items-center">
              <Link to="/search" className="hover:text-blue-600">Search</Link>
              <ChevronRight className="h-4 w-4 mx-1" />
            </li>
            <li className="flex items-center text-gray-700 truncate max-w-[200px] sm:max-w-xs md:max-w-sm">
              {listing.title}
            </li>
          </ol>
        </nav>

        {/* Image Gallery */}
        <div className="mb-8 bg-white p-1 sm:p-2 rounded-xl shadow-lg">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 sm:gap-2">
            <div className="col-span-1 sm:col-span-2 lg:col-span-1 h-64 sm:h-80 md:h-96 rounded-lg overflow-hidden cursor-pointer" onClick={() => handleImageClick(listing.media?.findIndex(m => m.id === featuredMedia?.id) || 0)}>
              {featuredMedia ? (
                <img src={`${API_URL.replace('/api', '')}${featuredMedia.url}`} alt={featuredMedia.caption || listing.title} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
              ) : (
                <div className="w-full h-full bg-gray-200 flex items-center justify-center rounded-lg">
                  <ImageIcon className="h-24 w-24 text-gray-400" />
                </div>
              )}
            </div>
            {otherMedia.length > 0 && (
              <div className="hidden lg:grid grid-cols-2 gap-1 sm:gap-2">
                {otherMedia.map((media, index) => (
                  <div key={media.id} className="h-40 md:h-[188px] rounded-md overflow-hidden cursor-pointer relative" onClick={() => handleImageClick(listing.media?.findIndex(m => m.id === media.id) || 0)}>
                    <img src={`${API_URL.replace('/api', '')}${media.url}`} alt={media.caption || listing.title} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                    {index === 3 && listing.media.length > 5 && (
                       <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center text-white text-xl font-bold">
                         +{listing.media.length - 5} more
                       </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          {listing.media && listing.media.length > 1 && (
             <button onClick={() => handleImageClick(0)} className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center">
                <GalleryThumbnails className="h-4 w-4 mr-1" /> Show all photos ({listing.media.length})
             </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content Area */}
          <div className="lg:col-span-2 bg-white p-6 sm:p-8 rounded-xl shadow-lg">
            <header className="pb-6 border-b border-gray-200">
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">{listing.title}</h1>
              <div className="flex flex-wrap items-center text-sm text-gray-600 gap-x-4 gap-y-1 mb-2">
                <span className="flex items-center"><MapPin className="h-4 w-4 mr-1 text-red-500 flex-shrink-0" /> {listing.custom_location?.city || listing.location_city}, {listing.custom_location?.country || listing.location_country}</span>
                <span className="flex items-center"><Star className="h-4 w-4 mr-1 text-yellow-500 fill-current flex-shrink-0" /> {listing.average_rating?.toFixed(1) || 'New'} ({listing.total_reviews || 0} reviews)</span>
              </div>
              <div className="flex flex-wrap items-center text-sm text-gray-600 gap-x-4 gap-y-1">
                {listing.duration_hours && <span className="flex items-center"><Clock className="h-4 w-4 mr-1 flex-shrink-0" /> {listing.duration_hours} hours</span>}
                {listing.is_multi_day && listing.total_days && <span className="flex items-center"><CalendarDays className="h-4 w-4 mr-1 flex-shrink-0" /> {listing.total_days} days</span>}
                {listing.max_travelers && <span className="flex items-center"><Users className="h-4 w-4 mr-1 flex-shrink-0" /> Up to {listing.max_travelers}</span>}
                {listing.category_name && <span className="inline-block bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full">{listing.category_name}</span>}
              </div>
            </header>

            <Section title="About this Adventure" icon={<FileText />}>
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{listing.description}</p>
            </Section>

            {listing.is_multi_day && listing.itinerary && listing.itinerary.length > 0 && (
              <Section title="Itinerary" icon={<ListChecks />}>
                <div className="space-y-4">
                  {listing.itinerary.map((item, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded-md border border-gray-200">
                      <h4 className="font-semibold text-gray-700">Day {item.day_number || (index + 1)}: {item.title}</h4>
                      <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{item.description}</p>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {listing.inclusions && listing.inclusions.length > 0 && (
              <Section title="What's Included" icon={<CheckCircle />}>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-gray-700">
                  {listing.inclusions.map((item, index) => <li key={index} className="flex items-start"><CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />{item}</li>)}
                </ul>
              </Section>
            )}
            {listing.exclusions && listing.exclusions.length > 0 && (
              <Section title="What's Not Included" icon={<XCircle />}>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-gray-700">
                  {listing.exclusions.map((item, index) => <li key={index} className="flex items-start"><XCircle className="h-4 w-4 text-red-500 mr-2 mt-0.5 flex-shrink-0" />{item}</li>)}
                </ul>
              </Section>
            )}
            
            {listing.requirements && (
                <Section title="Requirements" icon={<AlertTriangle />}>
                    <p className="text-gray-700 whitespace-pre-wrap">{listing.requirements}</p>
                </Section>
            )}

            {listing.cancellation_policy && (
                <Section title="Cancellation Policy" icon={<FileText />}>
                     <p className="text-gray-700 whitespace-pre-wrap">{listing.cancellation_policy}</p>
                </Section>
            )}
          </div>

          {/* Sidebar for Booking & Provider Info */}
          <aside className="lg:col-span-1 space-y-8">
            <div className="bg-white p-6 rounded-xl shadow-lg sticky top-24">
              <div className="flex items-center mb-4">
                <ShoppingCart className="h-6 w-6 text-green-600 mr-3" />
                <h2 className="text-2xl font-semibold text-gray-800">Book Your Spot</h2>
              </div>
              <div className="mb-4">
                <span className="text-3xl font-bold text-green-700">{listing.currency} {parseFloat(listing.base_price).toFixed(2)}</span>
                <span className="text-sm text-gray-600"> / person</span>
              </div>
              {/* Placeholder for availability calendar/date picker */}
              <div className="mb-4 p-3 bg-yellow-50 rounded-md text-sm text-yellow-700">
                <Info className="h-4 w-4 inline mr-1" /> Availability check and date selection coming soon.
              </div>
              <button 
                onClick={() => toast.info("Booking functionality is under development.")}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition duration-150 ease-in-out"
              >
                Book Now (Placeholder)
              </button>
              <button 
                onClick={() => toast.info("Messaging functionality is under development.")}
                className="mt-3 w-full text-blue-600 hover:text-blue-700 font-medium py-2 border border-blue-600 rounded-lg hover:bg-blue-50 transition flex items-center justify-center"
              >
                <MessageSquare className="h-5 w-5 mr-2" /> Message Provider
              </button>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg">
              <div className="flex items-center mb-4">
                <UserCircle className="h-6 w-6 text-indigo-600 mr-3" />
                <h2 className="text-xl font-semibold text-gray-800">Meet Your Provider</h2>
              </div>
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center overflow-hidden">
                  {listing.provider_image ? (
                    <img src={`${API_URL.replace('/api', '')}${listing.provider_image}`} alt={listing.provider_business_name || `${listing.provider_first_name} ${listing.provider_last_name}`} className="w-full h-full object-cover" />
                  ) : (
                    <UserCircle className="h-8 w-8 text-gray-500" />
                  )}
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">{listing.provider_business_name || `${listing.provider_first_name} ${listing.provider_last_name}`}</h4>
                  {/* Provider rating and link to profile will be added later */}
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                {listing.provider_bio || "Experienced and passionate local expert dedicated to providing unforgettable adventures."} (Provider bio placeholder)
              </p>
              <div className="mt-3 flex items-center text-xs text-green-600">
                <ShieldCheck className="h-4 w-4 mr-1" />
                <span>Verified Provider (Placeholder)</span>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-lg">
                <div className="flex items-center mb-2">
                    <Share2 className="h-5 w-5 text-gray-600 mr-2" />
                    <h3 className="text-md font-semibold text-gray-700">Share this Adventure</h3>
                </div>
                <div className="flex space-x-2">
                    {/* Placeholder share buttons */}
                    <button className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600" onClick={() => toast.info("Sharing to Facebook (placeholder)")}>F</button>
                    <button className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600" onClick={() => toast.info("Sharing to Twitter (placeholder)")}>T</button>
                    <button className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600" onClick={() => toast.info("Copying link (placeholder)")}>Link</button>
                </div>
            </div>
          </aside>
        </div>

        {/* Reviews Section - Placeholder */}
        <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg mt-8">
          <Section title="Traveler Reviews" icon={<ThumbsUp />}>
            <p className="text-gray-600">Review section is under development. Real reviews and ability to add your own will appear here soon!</p>
            <div className="mt-4 p-4 bg-gray-50 rounded-md text-center">
                <Star className="h-10 w-10 text-yellow-400 mx-auto mb-2" />
                <p className="text-gray-500">No reviews yet, or review display is coming soon.</p>
            </div>
          </Section>
        </div>
      </div>
      <ImageModal 
        isOpen={showImageModal} 
        onClose={() => setShowImageModal(false)} 
        images={listing.media || []}
        currentIndex={currentImageInModal}
        setCurrentIndex={setCurrentImageInModal}
      />
    </div>
  );
};

export default ListingDetailPage;
