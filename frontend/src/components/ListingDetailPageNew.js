import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import ImageGallery from 'react-image-gallery';
import "react-image-gallery/styles/css/image-gallery.css";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

import {
  MapPin, Star, Users, CalendarDays, Clock, FileText, CheckCircle, XCircle,
  DollarSign, MessageSquare, UserCircle, ShieldCheck, ThumbsUp,
  ListChecks, ShoppingCart, Loader2, AlertCircle, ChevronLeft, ChevronRight, Tag, Image as ImageIconLucide
} from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const BASE_URL = API_URL.replace('/api', ''); // For constructing media URLs

const ListingDetailPageNew = () => {
  const { listingId } = useParams();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [numTravelers, setNumTravelers] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const fetchListingData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Assuming an endpoint like /api/search/listings/:id or /api/listings/:id
      // For now, using /api/search/listings/:id as per previous context, but this might need adjustment
      // A dedicated endpoint like /api/listings/:id would be more standard for fetching a single resource.
      // The listingModel.findById in backend looks suitable.
      const response = await axios.get(`${API_URL}/search/listings/${listingId}`); // Adjust endpoint if needed
      setListing(response.data);
    } catch (err) {
      console.error("Error fetching listing details:", err);
      setError(err.response?.data?.message || "Failed to load listing details.");
      toast.error(err.response?.data?.message || "Failed to load listing details.");
    } finally {
      setLoading(false);
    }
  }, [listingId]);

  useEffect(() => {
    fetchListingData();
  }, [fetchListingData]);

  const handleBookingSubmit = (e) => {
    e.preventDefault();
    // Placeholder for booking logic
    toast.info(`Booking request for ${listing.title} on ${selectedDate.toLocaleDateString()} for ${numTravelers} traveler(s). (Feature not yet implemented)`);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-16 w-16 animate-spin text-blue-600" />
        <p className="ml-4 text-xl text-gray-700">Loading Adventure Details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 max-w-2xl mx-auto">
        <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-semibold text-red-700 mb-3">Oops! Something went wrong.</h2>
        <p className="text-gray-600 mb-6">{error}</p>
        <Link to="/search" className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
          Back to Search
        </Link>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="text-center py-20 max-w-2xl mx-auto">
        <AlertCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-semibold text-gray-700 mb-3">Listing Not Found</h2>
        <p className="text-gray-600 mb-6">The adventure you are looking for could not be found.</p>
        <Link to="/search" className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
          Back to Search
        </Link>
      </div>
    );
  }

  const images = listing.media && listing.media.length > 0
    ? listing.media.map(item => ({
        original: `${BASE_URL}${item.url}`,
        thumbnail: `${BASE_URL}${item.url}`, // Using original for thumbnail for simplicity
        description: item.caption || listing.title,
        originalAlt: item.caption || listing.title,
        thumbnailAlt: item.caption || listing.title,
      }))
    : [{ original: `https://via.placeholder.com/800x500?text=${encodeURIComponent(listing.title)}`, thumbnail: `https://via.placeholder.com/100x70?text=No+Image`, description: "No image available" }];

  const Section = ({ title, icon, children, className = "" }) => (
    <section className={`py-6 ${className}`}>
      <div className="flex items-center mb-4">
        {React.cloneElement(icon, { className: "h-6 w-6 text-blue-600 mr-3 flex-shrink-0" })}
        <h2 className="text-2xl font-semibold text-gray-800">{title}</h2>
      </div>
      {children}
    </section>
  );

  return (
    <div className="bg-gray-50 min-h-screen py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Image Gallery */}
        <div className="mb-8 bg-white p-2 sm:p-4 rounded-xl shadow-lg">
          {images.length > 0 ? (
            <ImageGallery
              items={images}
              showPlayButton={false}
              showFullscreenButton={true}
              slideInterval={5000}
              startIndex={currentImageIndex}
              onSlide={(currentIndex) => setCurrentImageIndex(currentIndex)}
              lazyLoad={true}
              additionalClass="app-image-gallery"
            />
          ) : (
            <div className="w-full h-96 bg-gray-200 rounded-lg flex items-center justify-center">
                <ImageIconLucide className="h-24 w-24 text-gray-400" />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content Area */}
          <div className="lg:col-span-2 bg-white p-6 sm:p-8 rounded-xl shadow-lg">
            <header className="pb-6 border-b border-gray-200">
              {listing.category_name && (
                <span className="inline-block bg-blue-100 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-full mb-3">
                  <Tag className="h-3 w-3 inline mr-1 relative -top-px" />{listing.category_name}
                </span>
              )}
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">{listing.title}</h1>
              <div className="flex flex-wrap items-center text-sm text-gray-600 gap-x-4 gap-y-1 mb-2">
                <span className="flex items-center"><MapPin className="h-4 w-4 mr-1.5 text-red-500 flex-shrink-0" /> {listing.custom_location?.city || listing.location_city || 'N/A'}, {listing.custom_location?.country || listing.location_country || 'N/A'}</span>
                <span className="flex items-center"><Star className="h-4 w-4 mr-1.5 text-yellow-500 fill-current flex-shrink-0" /> {listing.average_rating?.toFixed(1) || 'New'} ({listing.total_reviews || 0} reviews)</span>
              </div>
              <div className="flex flex-wrap items-center text-sm text-gray-600 gap-x-4 gap-y-1">
                {listing.duration_hours && <span className="flex items-center"><Clock className="h-4 w-4 mr-1.5 flex-shrink-0" /> {listing.duration_hours} hours</span>}
                {listing.is_multi_day && listing.total_days && <span className="flex items-center"><CalendarDays className="h-4 w-4 mr-1.5 flex-shrink-0" /> {listing.total_days} days</span>}
                {listing.max_travelers && <span className="flex items-center"><Users className="h-4 w-4 mr-1.5 flex-shrink-0" /> Up to {listing.max_travelers} travelers</span>}
              </div>
            </header>

            <Section title="About this Adventure" icon={<FileText />} className="border-b border-gray-200">
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{listing.description || "No description available."}</p>
            </Section>

            {listing.itinerary && listing.itinerary.length > 0 && (
              <Section title="Itinerary" icon={<ListChecks />} className="border-b border-gray-200">
                <div className="space-y-4">
                  {listing.itinerary.map((item, index) => (
                    <div key={item.id || index} className="p-4 bg-gray-50 rounded-md border border-gray-200">
                      <h4 className="font-semibold text-gray-700">Day {item.day_number || index + 1}: {item.title}</h4>
                      <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{item.description}</p>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {listing.inclusions && listing.inclusions.length > 0 && (
              <Section title="What's Included" icon={<CheckCircle />} className="border-b border-gray-200">
                <ul className="list-disc list-inside space-y-1 text-gray-700">
                  {listing.inclusions.map((item, index) => <li key={index}>{item}</li>)}
                </ul>
              </Section>
            )}

            {listing.exclusions && listing.exclusions.length > 0 && (
              <Section title="What's Not Included" icon={<XCircle />} className="border-b-0 pb-0">
                <ul className="list-disc list-inside space-y-1 text-gray-700">
                  {listing.exclusions.map((item, index) => <li key={index}>{item}</li>)}
                </ul>
              </Section>
            )}
          </div>

          {/* Sidebar for Booking & Provider Info */}
          <aside className="lg:col-span-1 space-y-8">
            <div className="bg-white p-6 rounded-xl shadow-lg sticky top-24">
              <div className="flex items-center mb-4">
                <ShoppingCart className="h-6 w-6 text-green-600 mr-3 flex-shrink-0" />
                <h2 className="text-2xl font-semibold text-gray-800">Book Your Spot</h2>
              </div>
              <div className="mb-4">
                <span className="text-3xl font-bold text-green-700">{listing.currency} {parseFloat(listing.base_price).toFixed(2)}</span>
                <span className="text-sm text-gray-600"> / person</span>
              </div>
              <form onSubmit={handleBookingSubmit} className="space-y-4">
                <div>
                  <label htmlFor="booking-date" className="block text-sm font-medium text-gray-700 mb-1">Select Date</label>
                  <DatePicker
                    selected={selectedDate}
                    onChange={(date) => setSelectedDate(date)}
                    minDate={new Date()}
                    dateFormat="MMMM d, yyyy"
                    className="form-input w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2"
                  />
                </div>
                <div>
                  <label htmlFor="travelers" className="block text-sm font-medium text-gray-700 mb-1">Number of Travelers</label>
                  <input
                    type="number"
                    id="travelers"
                    name="travelers"
                    value={numTravelers}
                    onChange={(e) => setNumTravelers(Math.max(1, parseInt(e.target.value) || 1))}
                    min="1"
                    max={listing.max_travelers || 20} // Default max if not specified
                    className="form-input w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2"
                  />
                </div>
                <div className="pt-2">
                    <p className="text-lg font-semibold text-gray-800">
                        Total: {listing.currency} {(parseFloat(listing.base_price) * numTravelers).toFixed(2)}
                    </p>
                </div>
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition duration-150 ease-in-out">
                  Request to Book
                </button>
              </form>
              <p className="mt-3 text-xs text-center text-gray-500">Full booking functionality with payment is under development.</p>
            </div>

            {listing.provider_business_name && (
              <div className="bg-white p-6 rounded-xl shadow-lg">
                <div className="flex items-center mb-4">
                  <UserCircle className="h-6 w-6 text-indigo-600 mr-3 flex-shrink-0" />
                  <h2 className="text-xl font-semibold text-gray-800">Meet Your Provider</h2>
                </div>
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center overflow-hidden">
                    {listing.provider_image ? (
                        <img src={`${BASE_URL}${listing.provider_image}`} alt={listing.provider_business_name} className="w-full h-full object-cover" />
                    ) : (
                        <UserCircle className="h-8 w-8 text-gray-500" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{listing.provider_business_name}</h4>
                    {/* Provider rating and reviews count would come from provider profile if available */}
                    {/* <div className="flex items-center text-xs text-yellow-500">
                      <Star className="h-3 w-3 mr-1 fill-current" /> {listing.provider.rating} ({listing.provider.reviewsCount} reviews)
                    </div> */}
                  </div>
                </div>
                {/* Provider bio would come from provider profile */}
                <p className="text-sm text-gray-600 mb-3">
                  Learn more about your experienced local guide or service provider.
                </p>
                <Link to={`/provider/${listing.provider_id}`} className="w-full block text-center text-sm text-blue-600 hover:text-blue-700 font-medium py-2 border border-blue-600 rounded-lg hover:bg-blue-50 transition">
                  View Provider Profile (Coming Soon)
                </Link>
                {/* Provider verification status would come from provider profile */}
                <div className="mt-3 flex items-center text-xs text-green-600">
                  <ShieldCheck className="h-4 w-4 mr-1" />
                  <span>Verified Provider (Placeholder)</span>
                </div>
              </div>
            )}
          </aside>
        </div>

        {/* Reviews Section - Full Width Below */}
        <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg mt-8">
          <Section title="Traveler Reviews" icon={<MessageSquare />}>
            <div className="mb-4">
              <span className="text-3xl font-bold text-gray-800">{listing.average_rating?.toFixed(1) || 'N/A'}</span>
              <span className="text-gray-600"> / 5</span>
              <div className="flex items-center mt-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className={`h-5 w-5 ${i < Math.round(listing.average_rating || 0) ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />
                ))}
                <span className="ml-2 text-sm text-gray-600">Based on {listing.total_reviews || 0} reviews</span>
              </div>
            </div>
            {/* Placeholder for actual reviews list */}
            {listing.reviews && listing.reviews.length > 0 ? (
                <div className="space-y-6">
                {listing.reviews.map((review) => (
                    <div key={review.id} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                    <div className="flex items-center mb-1">
                        {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`h-4 w-4 ${i < review.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />
                        ))}
                        <span className="ml-2 font-semibold text-gray-800">{review.author_name || 'Anonymous'}</span>
                    </div>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{review.review_text}</p>
                    </div>
                ))}
                </div>
            ) : (
                <p className="text-gray-500">No reviews yet for this listing.</p>
            )}
            <p className="mt-4 text-sm text-gray-500 italic">Full review system with ability to add reviews is under development.</p>
          </Section>
        </div>

        <div className="mt-12 p-6 bg-yellow-50 border border-yellow-300 rounded-lg text-center">
          <ThumbsUp className="h-10 w-10 text-yellow-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-yellow-700">Page Content is Dynamic!</h3>
          <p className="text-yellow-600 text-sm mt-1">
            This page fetches and displays data from the backend. Some sections are still placeholders pending full feature implementation.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ListingDetailPageNew;
