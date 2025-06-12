import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import {
  Lightbulb, DollarSign, MapPin, CalendarDays, Sparkles, Tag, BarChart2, AlertCircle, Loader2, ThumbsUp, Coffee, Sun, Umbrella, Leaf, ShoppingBag, Utensils, Landmark, Mountain, Palette, Smile, Music, Film, BookOpen, Trees, Waves, // Changed Drama to Smile
} from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const interestTagsList = [
  { name: 'Art', icon: <Palette className="h-4 w-4 mr-1.5" />, value: 'art' },
  { name: 'History', icon: <Landmark className="h-4 w-4 mr-1.5" />, value: 'history' },
  { name: 'Nature', icon: <Trees className="h-4 w-4 mr-1.5" />, value: 'nature' },
  { name: 'Foodie', icon: <Utensils className="h-4 w-4 mr-1.5" />, value: 'foodie' },
  { name: 'Adventure', icon: <Mountain className="h-4 w-4 mr-1.5" />, value: 'adventure' },
  { name: 'Shopping', icon: <ShoppingBag className="h-4 w-4 mr-1.5" />, value: 'shopping' },
  { name: 'Nightlife', icon: <Music className="h-4 w-4 mr-1.5" />, value: 'nightlife' },
  { name: 'Beaches', icon: <Waves className="h-4 w-4 mr-1.5" />, value: 'beach' },
  { name: 'Culture', icon: <Smile className="h-4 w-4 mr-1.5" />, value: 'culture' }, // Changed Drama to Smile
];

const RecommendationCard = ({ title, icon, isLoading, error, children }) => (
  <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-2xl transition-shadow duration-300">
    <div className="flex items-center mb-4 text-xl font-semibold text-gray-700">
      {React.cloneElement(icon, { className: "h-7 w-7 mr-3 text-blue-600" })}
      {title}
    </div>
    {isLoading && (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="ml-3 text-gray-500">Fetching recommendations...</p>
      </div>
    )}
    {error && !isLoading && (
      <div className="flex items-center text-red-600 bg-red-50 p-3 rounded-md">
        <AlertCircle className="h-5 w-5 mr-2" />
        <p className="text-sm">{error}</p>
      </div>
    )}
    {!isLoading && !error && children}
  </div>
);

const SmartRecommendations = ({ tripData }) => {
  const { token } = useAuth();
  const [budgetAnalysis, setBudgetAnalysis] = useState(null);
  const [destinationRecs, setDestinationRecs] = useState(null);
  const [seasonalRecs, setSeasonalRecs] = useState(null);
  const [selectedInterests, setSelectedInterests] = useState(tripData?.preferences?.interests || []);

  const [loadingBudget, setLoadingBudget] = useState(false);
  const [loadingDestination, setLoadingDestination] = useState(false);
  const [loadingSeasonal, setLoadingSeasonal] = useState(false);

  const [errorBudget, setErrorBudget] = useState(null);
  const [errorDestination, setErrorDestination] = useState(null);
  const [errorSeasonal, setErrorSeasonal] = useState(null);

  const { budgetAmount, tripDurationDays, numTravelers, destinationName, startDate } = tripData || {};

  const fetchBudgetAnalysis = useCallback(async () => {
    if (!budgetAmount || !tripDurationDays || !numTravelers || !token) return;
    setLoadingBudget(true); setErrorBudget(null);
    try {
      const response = await axios.post(`${API_URL}/recommendations/budget-analysis`, {
        budgetAmount, tripDurationDays, numTravelers, preferences: { interests: selectedInterests }
      }, { headers: { Authorization: `Bearer ${token}` } });
      setBudgetAnalysis(response.data);
    } catch (err) {
      setErrorBudget(err.response?.data?.message || "Failed to analyze budget.");
      toast.error("Budget analysis failed.");
    } finally {
      setLoadingBudget(false);
    }
  }, [budgetAmount, tripDurationDays, numTravelers, token, selectedInterests]);

  const fetchDestinationRecs = useCallback(async () => {
    if (!destinationName || !token) return;
    setLoadingDestination(true); setErrorDestination(null);
    try {
      const response = await axios.post(`${API_URL}/recommendations/destination`, {
        destinationName,
        preferences: { interests: selectedInterests },
        budgetCategory: budgetAnalysis?.budgetCategory 
      }, { headers: { Authorization: `Bearer ${token}` } });
      setDestinationRecs(response.data);
    } catch (err) {
      setErrorDestination(err.response?.data?.message || "Failed to get destination recommendations.");
      toast.error("Destination recommendations failed.");
    } finally {
      setLoadingDestination(false);
    }
  }, [destinationName, token, selectedInterests, budgetAnalysis?.budgetCategory]);

  const fetchSeasonalRecs = useCallback(async () => {
    if (!destinationName || !startDate || !token) return;
    const month = new Date(startDate).getMonth() + 1;
    setLoadingSeasonal(true); setErrorSeasonal(null);
    try {
      const response = await axios.get(`${API_URL}/recommendations/seasonal/${destinationName}/${month}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSeasonalRecs(response.data);
    } catch (err) {
      setErrorSeasonal(err.response?.data?.message || "Failed to get seasonal recommendations.");
      toast.error("Seasonal recommendations failed.");
    } finally {
      setLoadingSeasonal(false);
    }
  }, [destinationName, startDate, token]);

  useEffect(() => {
    fetchBudgetAnalysis();
  }, [fetchBudgetAnalysis]);

  useEffect(() => {
    if (budgetAnalysis) { // Fetch destination recs once budget analysis is available
      fetchDestinationRecs();
    }
  }, [fetchDestinationRecs, budgetAnalysis]);
  
  useEffect(() => {
    fetchSeasonalRecs();
  }, [fetchSeasonalRecs]);

  const handleInterestToggle = (interestValue) => {
    setSelectedInterests(prev =>
      prev.includes(interestValue)
        ? prev.filter(i => i !== interestValue)
        : [...prev, interestValue]
    );
    // Future: Could update tripData.preferences.interests via a callback prop if this component modifies parent state
  };
  
  // Re-fetch destination recs if selectedInterests change
  useEffect(() => {
    if (destinationName && token && budgetAnalysis) { // Ensure other dependencies are met
        fetchDestinationRecs();
    }
  }, [selectedInterests, destinationName, token, budgetAnalysis, fetchDestinationRecs]);


  const getBudgetColor = (category) => {
    if (category === 'budget') return 'bg-green-500';
    if (category === 'mid-range') return 'bg-yellow-500';
    if (category === 'luxury') return 'bg-red-500';
    return 'bg-gray-400';
  };

  return (
    <div className="space-y-8 p-4 md:p-0">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800 flex items-center justify-center">
          <Sparkles className="h-8 w-8 mr-3 text-purple-600" />
          AI Powered Smart Recommendations
        </h2>
        <p className="text-gray-600 mt-2">Tailored suggestions to enhance your trip planning experience.</p>
      </div>

      {/* Interest Tag Selection */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-700 mb-3">Refine by Interests:</h3>
        <div className="flex flex-wrap gap-2">
          {interestTagsList.map(tag => (
            <button
              key={tag.value}
              onClick={() => handleInterestToggle(tag.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center transition-all duration-150 ease-in-out
                ${selectedInterests.includes(tag.value)
                  ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-300'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              {tag.icon}
              {tag.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Budget Analysis Card */}
        <RecommendationCard title="Budget Insights" icon={<DollarSign />} isLoading={loadingBudget} error={errorBudget}>
          {budgetAnalysis ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-500">Your Budget Category</p>
                  <p className={`text-lg font-semibold ${budgetAnalysis.budgetCategory === 'luxury' ? 'text-red-600' : budgetAnalysis.budgetCategory === 'mid-range' ? 'text-yellow-600' : 'text-green-600'}`}>
                    {budgetAnalysis.budgetCategory.charAt(0).toUpperCase() + budgetAnalysis.budgetCategory.slice(1)}
                  </p>
                </div>
                <div className={`w-3 h-10 rounded-full ${getBudgetColor(budgetAnalysis.budgetCategory)}`}></div>
              </div>
              <p className="text-sm text-gray-600">
                Est. <span className="font-medium">${budgetAnalysis.budgetPerDayPerPerson?.toFixed(2)}</span> per person / day
              </p>
              {budgetAnalysis.suggestions?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-600 mt-3 mb-1">Suggestions:</h4>
                  <ul className="list-disc list-inside space-y-1 text-xs text-gray-500">
                    {budgetAnalysis.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Enter budget details in your trip to see analysis.</p>
          )}
        </RecommendationCard>

        {/* Destination Recommendations Card */}
        <RecommendationCard title="Destination Highlights" icon={<MapPin />} isLoading={loadingDestination} error={errorDestination}>
          {destinationRecs ? (
            <div className="space-y-4">
              {destinationRecs.activities?.length > 0 && (
                <div>
                  <h4 className="text-md font-semibold text-gray-600 mb-2">Top Activities:</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {destinationRecs.activities.map(act => (
                      <div key={act.id || act.name} className="p-2.5 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors">
                        <p className="text-sm font-medium text-blue-700">{act.name}</p>
                        <p className="text-xs text-blue-500">Type: {act.type} | Est. Budget: ${act.budget_estimate_per_person}</p>
                        {act.tags && <p className="text-xs text-gray-500 mt-0.5">Tags: {act.tags.join(', ')}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {destinationRecs.hotels?.length > 0 && (
                 <div>
                  <h4 className="text-md font-semibold text-gray-600 mt-3 mb-2">Hotel Ideas:</h4>
                   <div className="space-y-1">
                    {destinationRecs.hotels.map(hotel => (
                      <p key={hotel.type} className="text-xs text-gray-500 p-1.5 bg-gray-50 rounded">
                        Consider: <span className="font-medium">{hotel.type}</span> (Avg. ${hotel.avg_price_range[0]}-${hotel.avg_price_range[1]}/night)
                      </p>
                    ))}
                  </div>
                </div>
              )}
              {destinationRecs.notes && <p className="text-xs text-gray-500 italic mt-3">{destinationRecs.notes}</p>}
              {(!destinationRecs.activities || destinationRecs.activities.length === 0) && (!destinationRecs.hotels || destinationRecs.hotels.length === 0) && (
                <p className="text-sm text-gray-500">No specific recommendations for current filters. Try adjusting interests or budget.</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Enter a destination to see recommendations.</p>
          )}
        </RecommendationCard>

        {/* Seasonal Insights Card */}
        <RecommendationCard title="Seasonal Tips" icon={<CalendarDays />} isLoading={loadingSeasonal} error={errorSeasonal}>
          {seasonalRecs ? (
            <div className="space-y-3">
              {seasonalRecs.seasonalNotes && (
                <div className="p-3 bg-green-50 rounded-lg">
                  <h4 className="text-sm font-semibold text-green-700 mb-1">Notes for this Season:</h4>
                  <p className="text-xs text-green-600">{seasonalRecs.seasonalNotes}</p>
                </div>
              )}
              {seasonalRecs.recommendations?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-600 mt-3 mb-1">Consider These:</h4>
                  <ul className="list-disc list-inside space-y-1 text-xs text-gray-500">
                    {seasonalRecs.recommendations.map((rec, i) => <li key={i}>{rec}</li>)}
                  </ul>
                </div>
              )}
               {(!seasonalRecs.seasonalNotes && (!seasonalRecs.recommendations || seasonalRecs.recommendations.length === 0)) && (
                 <p className="text-sm text-gray-500">No specific seasonal tips for the selected month/destination.</p>
               )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Enter destination and dates to see seasonal tips.</p>
          )}
        </RecommendationCard>
      </div>
    </div>
  );
};

export default SmartRecommendations;
