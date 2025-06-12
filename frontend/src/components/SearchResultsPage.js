import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Search, SlidersHorizontal, Filter, MapPin, Star, CalendarDays, Users, DollarSign, ThumbsUp, Clock, Loader2, AlertCircle, ChevronLeft, ChevronRight, ListFilter, XCircle } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const ITEMS_PER_PAGE = 9; // Number of listings per page

const ListingCard = ({ listing }) => {
  const featuredImage = listing.media?.find(m => m.is_featured)?.url || listing.media?.[0]?.url;
  const displayImage = featuredImage ? `${API_URL.replace('/api', '')}${featuredImage}` : `https://via.placeholder.com/300x200?text=${listing.title.split(' ').join('+')}`;

  return (
    <Link to={`/listing/${listing.id}`} className="bg-white rounded-xl shadow-lg overflow-hidden flex flex-col hover:shadow-xl transition-shadow duration-300 group">
      <div className="w-full h-48 bg-gray-200 flex items-center justify-center overflow-hidden">
        <img src={displayImage} alt={listing.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
      </div>
      <div className="p-4 sm:p-5 flex flex-col flex-grow">
        <span className="inline-block bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-1 rounded-full mb-2 self-start">
          {listing.category_name || 'Uncategorized'}
        </span>
        <h3 className="text-lg font-bold text-gray-800 mb-2 group-hover:text-blue-600 transition-colors flex-grow min-h-[2.5em]">
          {listing.title}
        </h3>
        <div className="flex items-center text-sm text-gray-500 mb-1">
          <MapPin className="h-4 w-4 mr-1.5 text-red-500 flex-shrink-0" />
          <span className="truncate">{listing.custom_location?.city || listing.location_city || 'Various Locations'}, {listing.custom_location?.country || listing.location_country || ''}</span>
        </div>
        <div className="flex items-center text-sm text-yellow-500 mb-3">
          <Star className="h-4 w-4 mr-1.5 fill-current flex-shrink-0" /> {listing.average_rating?.toFixed(1) || 'New'}
          <span className="text-gray-400 ml-1 text-xs">({listing.total_reviews || 0} reviews)</span>
        </div>
        <div className="flex items-center text-xs text-gray-500 mb-3 space-x-3">
          {listing.duration_hours && <span className="flex items-center"><Clock className="h-3.5 w-3.5 mr-1" /> {listing.duration_hours} hrs</span>}
          {listing.total_days && <span className="flex items-center"><CalendarDays className="h-3.5 w-3.5 mr-1" /> {listing.total_days} days</span>}
          {listing.max_travelers && <span className="flex items-center"><Users className="h-3.5 w-3.5 mr-1" /> Up to {listing.max_travelers}</span>}
        </div>
        <div className="mt-auto pt-3 border-t border-gray-100">
          <p className="text-xl font-bold text-green-600">
            <DollarSign className="h-5 w-5 inline mr-0.5 relative -top-0.5" />
            {listing.base_price} <span className="text-xs font-normal text-gray-500">{listing.currency}</span>
          </p>
        </div>
      </div>
    </Link>
  );
};

const SearchResultsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [listings, setListings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalResults, setTotalResults] = useState(0);
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page')) || 1);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const initialFilters = useMemo(() => ({
    keyword: searchParams.get('keyword') || '',
    categoryId: searchParams.get('categoryId') || '',
    minPrice: searchParams.get('minPrice') || '',
    maxPrice: searchParams.get('maxPrice') || '',
    sortBy: searchParams.get('sortBy') || 'rating',
    // Add other filters here: duration, location etc.
  }), [searchParams]);

  const [filters, setFilters] = useState(initialFilters);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/search/categories`);
      setCategories(response.data || []);
    } catch (err) {
      console.error("Failed to fetch categories", err);
      toast.error("Could not load categories for filtering.");
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        ...filters,
        limit: ITEMS_PER_PAGE,
        offset: (currentPage - 1) * ITEMS_PER_PAGE,
      };
      // Remove empty filter values
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === null || params[key] === undefined) {
          delete params[key];
        }
      });

      const response = await axios.get(`${API_URL}/search/listings`, { params });
      setListings(response.data.listings || []);
      // Backend needs to return totalCount for accurate pagination
      // For now, if backend doesn't send total, we estimate or handle differently
      setTotalResults(response.data.totalCount || response.data.listings?.length || 0); 
      if (response.data.totalCount === undefined) {
        console.warn("Backend doesn't return totalCount. Pagination might be inaccurate.");
      }
      
      // Update URL with current filters and page
      const newSearchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (key !== 'limit' && key !== 'offset' && value) { // Don't put limit/offset in URL if not needed
          newSearchParams.set(key, value.toString());
        }
      });
      if (currentPage > 1) newSearchParams.set('page', currentPage.toString());
      setSearchParams(newSearchParams, { replace: true });

    } catch (err) {
      console.error("Failed to fetch search results", err);
      setError(err.response?.data?.message || "An error occurred while fetching results.");
      toast.error(err.response?.data?.message || "Search failed.");
    } finally {
      setLoading(false);
    }
  }, [filters, currentPage, setSearchParams]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  // Update filters from URL on mount and when URL changes externally
  useEffect(() => {
    setFilters(prevFilters => ({
      ...prevFilters,
      keyword: searchParams.get('keyword') || '',
      categoryId: searchParams.get('categoryId') || '',
      minPrice: searchParams.get('minPrice') || '',
      maxPrice: searchParams.get('maxPrice') || '',
      sortBy: searchParams.get('sortBy') || 'rating',
    }));
    setCurrentPage(parseInt(searchParams.get('page')) || 1);
  }, [searchParams]);


  const handleFilterChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setCurrentPage(1); // Reset to first page on filter change
  };

  const handleApplyFilters = () => {
    // fetchData will be called due to filters state change via useEffect
    // Update URL explicitly here if not relying on fetchData's setSearchParams
    const newSearchParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) newSearchParams.set(key, value.toString());
    });
    newSearchParams.set('page', '1'); // Reset page to 1
    setSearchParams(newSearchParams, { replace: true });
    if (showMobileFilters) setShowMobileFilters(false);
  };
  
  const handleClearFilters = () => {
    const defaultFilters = {
        keyword: '', categoryId: '', minPrice: '', maxPrice: '', sortBy: 'rating',
    };
    setFilters(defaultFilters);
    setCurrentPage(1);
    setSearchParams({}, {replace: true}); // Clear URL params
    if (showMobileFilters) setShowMobileFilters(false);
  };

  const totalPages = Math.ceil(totalResults / ITEMS_PER_PAGE);

  const FilterSidebar = () => (
    <aside className={`fixed inset-y-0 left-0 z-30 w-72 bg-white p-6 shadow-xl transform ${showMobileFilters ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out md:relative md:translate-x-0 md:w-1/4 lg:w-1/5 md:h-fit md:rounded-xl md:shadow-lg`}>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800 flex items-center">
          <Filter className="h-6 w-6 mr-2 text-blue-600" />
          Filters
        </h2>
        <button onClick={() => setShowMobileFilters(false)} className="md:hidden p-1 rounded hover:bg-gray-200">
          <XCircle className="h-6 w-6 text-gray-500" />
        </button>
      </div>
      
      <div className="space-y-6">
        <div>
          <label htmlFor="keyword" className="block text-sm font-medium text-gray-700 mb-1">Keyword</label>
          <input type="text" name="keyword" id="keyword" value={filters.keyword} onChange={handleFilterChange} placeholder="e.g., hiking, culinary" className="form-input w-full rounded-md border-gray-300 shadow-sm text-sm" />
        </div>
        <div>
          <label htmlFor="categoryId" className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select name="categoryId" id="categoryId" value={filters.categoryId} onChange={handleFilterChange} className="form-select w-full rounded-md border-gray-300 shadow-sm text-sm">
            <option value="">All Categories</option>
            {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Price Range</label>
          <div className="flex space-x-2">
            <input type="number" name="minPrice" value={filters.minPrice} onChange={handleFilterChange} placeholder="Min" className="form-input w-1/2 rounded-md border-gray-300 shadow-sm text-sm" />
            <input type="number" name="maxPrice" value={filters.maxPrice} onChange={handleFilterChange} placeholder="Max" className="form-input w-1/2 rounded-md border-gray-300 shadow-sm text-sm" />
          </div>
        </div>
        {/* Add more filters: duration, location, etc. */}
      </div>
      <div className="mt-8 space-y-3">
        <button onClick={handleApplyFilters} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition">Apply Filters</button>
        <button onClick={handleClearFilters} className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-4 rounded-lg transition">Clear Filters</button>
      </div>
    </aside>
  );

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <header className="mb-6 md:mb-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center">
            <Search className="h-7 w-7 sm:h-8 sm:w-8 mr-2 sm:mr-3 text-blue-600" />
            Discover Adventures
          </h1>
          <button onClick={() => setShowMobileFilters(true)} className="md:hidden p-2 rounded-lg hover:bg-gray-200 border border-gray-300">
            <ListFilter className="h-5 w-5 text-gray-600" />
          </button>
        </div>
        <p className="text-gray-600 mt-1 sm:mt-2 text-sm sm:text-base">
          Find unique experiences, curated trips, and local providers.
        </p>
      </header>

      <div className="flex flex-col md:flex-row gap-6 md:gap-8">
        <FilterSidebar />
        {showMobileFilters && <div className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden" onClick={() => setShowMobileFilters(false)}></div>}

        <main className="w-full md:flex-1">
          <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row justify-between items-center gap-3">
            <p className="text-gray-600 text-sm">
              {loading ? 'Searching...' : error ? 'Error loading results' : `Found ${totalResults} adventure(s)`}
            </p>
            <div>
              <label htmlFor="sortBy" className="text-xs text-gray-600 mr-1.5">Sort by:</label>
              <select name="sortBy" id="sortBy" value={filters.sortBy} onChange={handleFilterChange} className="form-select rounded-md border-gray-300 shadow-sm text-xs py-1.5">
                <option value="rating">Popularity (Rating)</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="newest">Newest</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
            </div>
          ) : error ? (
            <div className="text-center py-20 bg-white rounded-xl shadow p-6">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-red-700 mb-2">Oops! Something went wrong.</h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <button onClick={fetchData} className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition">Try Again</button>
            </div>
          ) : listings.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-xl shadow p-6">
              <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No Adventures Found</h3>
              <p className="text-gray-600 mb-4">Try adjusting your search terms or filters. Or explore popular categories:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {categories.slice(0, 5).map(cat => (
                    <button key={cat.id} onClick={() => { setFilters(f => ({...f, categoryId: cat.id.toString(), keyword: ''})); setCurrentPage(1);}} className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm hover:bg-blue-200 transition">
                        {cat.name}
                    </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {listings.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
              {totalPages > 1 && (
                <div className="mt-8 flex justify-center items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-md border bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  {/* Simple page indicator, can be expanded */}
                  <span className="text-sm text-gray-700">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-md border bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default SearchResultsPage;
