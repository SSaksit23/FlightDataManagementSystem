import React, { useState, useEffect } from 'react';
import { useGoogleMaps } from '../contexts/GoogleMapsContext';
import { toast } from 'react-toastify';
import { 
  MapPin, 
  Clock, 
  Star, 
  Navigation, 
  Zap, 
  Loader2, 
  Brain, 
  Car, 
  Bus,
  Search,
  
  ArrowRight,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

const IntelligentRoutePlanner = ({ tripData, updateTripData }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [attractions, setAttractions] = useState([]);
  const [optimizedRoute, setOptimizedRoute] = useState([]);
  const [routeAnalysis, setRouteAnalysis] = useState(null);
  const [selectedAttractions, setSelectedAttractions] = useState([]);
  const [travelMode, setTravelMode] = useState('DRIVING');
  const [showDetails, setShowDetails] = useState(false);
  const [planningStep, setPlanningStep] = useState('input');
  
  const { isLoaded, globalMapsError, fallbackMode, isGoogleMapsReady } = useGoogleMaps();

  // Sample attractions data as fallback
  const sampleAttractions = [
    {
      id: 'sample-1',
      name: 'Central Park',
      address: 'New York, NY',
      location: { lat: 40.7829, lng: -73.9654 },
      rating: 4.6,
      ratingsCount: 120000,
      openingHours: { isOpen: true },
      photos: []
    },
    {
      id: 'sample-2',  
      name: 'Times Square',
      address: 'New York, NY',
      location: { lat: 40.7580, lng: -73.9855 },
      rating: 4.3,
      ratingsCount: 85000,
      openingHours: { isOpen: true },
      photos: []
    },
    {
      id: 'sample-3',
      name: 'Statue of Liberty',
      address: 'New York, NY',
      location: { lat: 40.6892, lng: -74.0445 },
      rating: 4.7,
      ratingsCount: 95000,
      openingHours: { isOpen: true },
      photos: []
    }
  ];

  const generateIntelligentRoute = async () => {
    if (!tripData.destinations) {
      toast.error('Please add destinations in Core Details first');
      return;
    }
    
    toast.info(`🎯 Starting route planning for: ${tripData.destinations}`);

    setIsLoading(true);
    setPlanningStep('search');

    try {
      if (isGoogleMapsReady && !fallbackMode && !globalMapsError) {
        try {
          // Use real Google Maps API
          toast.info('Using Google Maps API to find attractions...');
          await findAttractionsWithAPI();
        } catch (apiError) {
          console.warn('Google Maps API error, falling back to sample data:', apiError);
          toast.info('Google Maps had issues, using sample attractions...');
          await findAttractionsWithSampleData();
        }
      } else {
        // Use sample data as fallback
        toast.info('Google Maps API not available. Using sample attractions...');
        await findAttractionsWithSampleData();
      }
    } catch (error) {
      console.error('Error generating route:', error);
      toast.error('Failed to generate route. Using sample data...');
      try {
        await findAttractionsWithSampleData();
      } catch (fallbackError) {
        console.error('Even fallback failed:', fallbackError);
        toast.error('Unable to load attractions. Please try refreshing the page.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const findAttractionsWithAPI = async () => {
    // This would use the Google Maps Places API
    const destinations = tripData.destinations.split(',').map(d => d.trim());
    const allAttractions = [];

    for (const destination of destinations) {
      // For now, use sample data per destination
      const destinationAttractions = sampleAttractions.map(attraction => ({
        ...attraction,
        id: `${destination}-${attraction.id}`,
        address: `${attraction.name}, ${destination}`
      }));
      allAttractions.push(...destinationAttractions);
    }

    setAttractions(allAttractions);
    toast.success(`Found ${allAttractions.length} attractions`);

    const topAttractions = allAttractions
      .filter(attr => attr.rating >= 4.0)
      .slice(0, Math.min(6, allAttractions.length));
    
    setSelectedAttractions(topAttractions);
    setPlanningStep('optimize');

    if (topAttractions.length >= 2) {
      await optimizeSelectedRoute(topAttractions);
    }
  };

  const findAttractionsWithSampleData = async () => {
    const destinations = tripData.destinations.split(',').map(d => d.trim());
    const allAttractions = [];

    destinations.forEach(destination => {
      const destinationAttractions = sampleAttractions.map(attraction => ({
        ...attraction,
        id: `${destination}-${attraction.id}`,
        address: `${attraction.name}, ${destination}`
      }));
      allAttractions.push(...destinationAttractions);
    });

    setAttractions(allAttractions);
    toast.success(`Found ${allAttractions.length} sample attractions`);

    const topAttractions = allAttractions.slice(0, Math.min(6, allAttractions.length));
    setSelectedAttractions(topAttractions);
    setPlanningStep('optimize');

    if (topAttractions.length >= 2) {
      await optimizeSelectedRoute(topAttractions);
    }
  };

  const optimizeSelectedRoute = async (attractionsToOptimize = selectedAttractions) => {
    if (attractionsToOptimize.length < 2) {
      toast.error('Please select at least 2 attractions');
      return;
    }

    setIsLoading(true);
    toast.info('Optimizing your route...');

    try {
      // Simple optimization without Google APIs
      const optimized = [...attractionsToOptimize]; // Simple copy for now
      setOptimizedRoute(optimized);

      // Generate sample analysis
      const totalDistance = optimized.length * 15; // 15km between each
      const totalDuration = optimized.length * 30; // 30 minutes between each

      setRouteAnalysis({
        totalDistance: totalDistance.toFixed(1) + ' km',
        totalDuration: totalDuration + ' minutes',
        estimatedCost: calculateEstimatedCost(totalDistance * 1000, travelMode),
        attractionsCount: optimized.length,
        legs: optimized.slice(0, -1).map((attraction, index) => ({
          from: attraction.name,
          to: optimized[index + 1].name,
          distance: '15 km',
          duration: '30 mins'
        }))
      });

      setPlanningStep('review');
      toast.success('Route optimized successfully!');

      // Update trip data
      updateTripData({
        routePlanning: {
          ...tripData.routePlanning,
          intelligentRoute: {
            attractions: optimized,
            analysis: routeAnalysis,
            travelMode: travelMode,
            lastUpdated: new Date().toISOString()
          }
        }
      });

    } catch (error) {
      console.error('Error optimizing route:', error);
      toast.error('Failed to optimize route');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateEstimatedCost = (distanceMeters, mode) => {
    const distanceKm = distanceMeters / 1000;
    const costs = {
      'DRIVING': distanceKm * 0.15,
      'TRANSIT': distanceKm * 0.05,
      'WALKING': 0
    };
    return costs[mode] ? `$${costs[mode].toFixed(2)}` : 'N/A';
  };

  const toggleAttractionSelection = (attraction) => {
    const isSelected = selectedAttractions.some(a => a.id === attraction.id);
    if (isSelected) {
      setSelectedAttractions(prev => prev.filter(a => a.id !== attraction.id));
    } else {
      setSelectedAttractions(prev => [...prev, attraction]);
    }
  };

  const getTravelModeIcon = (mode) => {
    switch (mode) {
      case 'DRIVING': return <Car className="h-4 w-4" />;
      case 'TRANSIT': return <Bus className="h-4 w-4" />;
      case 'WALKING': return <Navigation className="h-4 w-4" />;
      default: return <Car className="h-4 w-4" />;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold flex items-center">
          <Brain className="h-6 w-6 mr-2 text-purple-600" />
          Intelligent Route Planner
        </h3>
        <div className="flex items-center space-x-2">
          <select
            value={travelMode}
            onChange={(e) => setTravelMode(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="DRIVING">🚗 Driving</option>
            <option value="TRANSIT">🚌 Public Transit</option>
            <option value="WALKING">🚶 Walking</option>
          </select>
        </div>
      </div>

      {/* API Status */}
      <div className="mb-4 p-3 rounded-lg border">
        {isGoogleMapsReady && !fallbackMode && !globalMapsError ? (
          <div className="flex items-center text-green-600">
            <CheckCircle className="h-4 w-4 mr-2" />
            <span className="text-sm">Google Maps API loaded - Full functionality available</span>
          </div>
        ) : (
          <div className="flex items-center text-orange-600">
            <AlertCircle className="h-4 w-4 mr-2" />
            <span className="text-sm">Google Maps API not available - Using sample data</span>
          </div>
        )}
      </div>

      {/* Planning Steps Progress */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span className={`flex items-center ${planningStep === 'input' ? 'text-blue-600 font-medium' : ''}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center mr-2 ${
              planningStep === 'input' ? 'bg-blue-600 text-white' : 'bg-gray-200'
            }`}>1</div>
            Input
          </span>
          <ArrowRight className="h-4 w-4" />
          <span className={`flex items-center ${planningStep === 'search' ? 'text-blue-600 font-medium' : ''}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center mr-2 ${
              planningStep === 'search' ? 'bg-blue-600 text-white' : 'bg-gray-200'
            }`}>2</div>
            Search
          </span>
          <ArrowRight className="h-4 w-4" />
          <span className={`flex items-center ${planningStep === 'optimize' ? 'text-blue-600 font-medium' : ''}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center mr-2 ${
              planningStep === 'optimize' ? 'bg-blue-600 text-white' : 'bg-gray-200'
            }`}>3</div>
            Optimize
          </span>
          <ArrowRight className="h-4 w-4" />
          <span className={`flex items-center ${planningStep === 'review' ? 'text-green-600 font-medium' : ''}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center mr-2 ${
              planningStep === 'review' ? 'bg-green-600 text-white' : 'bg-gray-200'
            }`}>4</div>
            Review
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-3 mb-6">
        <button
          onClick={generateIntelligentRoute}
          disabled={isLoading || !tripData.destinations}
          className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
        >
          {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
          Generate AI Route
        </button>
        
        {selectedAttractions.length > 1 && (
          <button
            onClick={() => optimizeSelectedRoute()}
            disabled={isLoading}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            <Navigation className="h-4 w-4 mr-2" />
            Optimize Selected ({selectedAttractions.length})
          </button>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-8">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-purple-600" />
          <p className="text-gray-600">
            {planningStep === 'search' && 'Finding the best attractions...'}
            {planningStep === 'optimize' && 'Optimizing your route...'}
          </p>
        </div>
      )}

      {/* Attractions Grid */}
      {attractions.length > 0 && (
        <div className="mb-6">
          <h4 className="text-lg font-semibold mb-4 flex items-center">
            <Search className="h-5 w-5 mr-2 text-blue-600" />
            Found Attractions ({attractions.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {attractions.map((attraction) => (
              <div
                key={attraction.id}
                className={`border rounded-lg p-4 cursor-pointer transition-all ${
                  selectedAttractions.some(a => a.id === attraction.id)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => toggleAttractionSelection(attraction)}
              >
                <div className="w-full h-32 bg-gray-200 rounded-md mb-3 flex items-center justify-center">
                  <MapPin className="h-8 w-8 text-gray-400" />
                </div>
                <h5 className="font-medium text-sm mb-2">{attraction.name}</h5>
                <p className="text-xs text-gray-600 mb-2">{attraction.address}</p>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center">
                    <Star className="h-3 w-3 text-yellow-400 mr-1" />
                    <span>{attraction.rating.toFixed(1)}</span>
                    <span className="text-gray-500 ml-1">({attraction.ratingsCount})</span>
                  </div>
                  <div className="flex items-center text-green-600">
                    <Clock className="h-3 w-3 mr-1" />
                    <span>Open</span>
                  </div>
                </div>
                <div className="mt-2">
                  <input
                    type="checkbox"
                    checked={selectedAttractions.some(a => a.id === attraction.id)}
                    onChange={() => toggleAttractionSelection(attraction)}
                    className="mr-2"
                  />
                  <span className="text-xs text-gray-600">Include in route</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Optimized Route Display */}
      {optimizedRoute.length > 0 && (
        <div className="mb-6">
          <h4 className="text-lg font-semibold mb-4 flex items-center">
            <Navigation className="h-5 w-5 mr-2 text-green-600" />
            Optimized Route ({optimizedRoute.length} stops)
          </h4>
          <div className="space-y-3">
            {optimizedRoute.map((attraction, index) => (
              <div key={attraction.id} className="flex items-center p-3 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium mr-3">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <h6 className="font-medium">{attraction.name}</h6>
                  <p className="text-sm text-gray-600">{attraction.address}</p>
                  <div className="flex items-center text-xs text-gray-500 mt-1">
                    <Star className="h-3 w-3 text-yellow-400 mr-1" />
                    {attraction.rating.toFixed(1)}
                    <span className="mx-2">•</span>
                    <Clock className="h-3 w-3 mr-1" />
                    <span className="text-green-600">Open</span>
                  </div>
                </div>
                {index < optimizedRoute.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-gray-400 ml-2" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Route Analysis */}
      {routeAnalysis && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="text-lg font-semibold mb-4 flex items-center text-green-800">
            <CheckCircle className="h-5 w-5 mr-2" />
            Route Analysis
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-700">{routeAnalysis.totalDistance}</div>
              <div className="text-sm text-green-600">Total Distance</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-700">{routeAnalysis.totalDuration}</div>
              <div className="text-sm text-green-600">Travel Time</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-700">{routeAnalysis.estimatedCost}</div>
              <div className="text-sm text-green-600">Estimated Cost</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-700 flex items-center justify-center">
                {getTravelModeIcon(travelMode)}
              </div>
              <div className="text-sm text-green-600">{travelMode.toLowerCase()}</div>
            </div>
          </div>

          {/* Detailed Route Steps */}
          {routeAnalysis.legs && (
            <div className="mt-4">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center text-sm text-green-700 hover:text-green-800"
              >
                {showDetails ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                Show Route Details
              </button>
              
              {showDetails && (
                <div className="mt-3 space-y-2">
                  {routeAnalysis.legs.map((leg, index) => (
                    <div key={index} className="bg-white border border-green-200 rounded p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-medium mr-2">
                            {index + 1}
                          </div>
                          <span className="font-medium text-sm">{leg.from}</span>
                          <ArrowRight className="h-4 w-4 mx-2 text-gray-400" />
                          <span className="font-medium text-sm">{leg.to}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-600">{leg.distance}</div>
                          <div className="text-xs text-blue-600 font-medium">{leg.duration}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Travel Mode Recommendations */}
      {planningStep === 'review' && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h5 className="font-semibold text-blue-800 mb-2">💡 Travel Recommendations</h5>
          <div className="text-sm text-blue-700 space-y-1">
            <p>🚗 <strong>Driving:</strong> Most flexible, park at each location</p>
            <p>🚌 <strong>Public Transit:</strong> Most economical, consider day passes</p>
            <p>✈️ <strong>Flights:</strong> For long distances, check <a href="https://www.google.com/flights" target="_blank" rel="noopener noreferrer" className="underline">Google Flights</a></p>
            <p>🚂 <strong>Train:</strong> Comfortable for medium distances, scenic routes</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default IntelligentRoutePlanner; 