import React, { useState, useEffect, useRef } from 'react';
import { useGoogleMaps } from '../contexts/GoogleMapsContext';
import { toast } from 'react-toastify';
import { 
  MapPin, 
  Search, 
  Navigation, 
  Clock, 
  Trash2, 
  PlusCircle, 
  Loader2, 
  AlertCircle, 
  ChevronLeft, 
  ChevronRight, 
  XCircle, 
  Zap 
} from 'lucide-react';

// Error Boundary Component for Map
class MapErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Map Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex justify-center items-center h-[400px] bg-red-50 text-red-700 p-4 rounded-md border border-red-200">
          <AlertCircle className="h-6 w-6 mr-2"/>
          <div>
            <p className="font-medium">Map component encountered an error</p>
            <p className="text-sm mt-1">This is likely due to Google Maps API issues.</p>
            <button 
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-2 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 mr-2"
            >
              Try Again
            </button>
            <button 
              onClick={() => window.location.reload()}
              className="mt-2 px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || 'AIzaSyC8thfcniP-SWuADDMKaRKwG_4chz01E8k';

const MapComponent = ({ initialWaypoints, onWaypointsUpdate, tripId, tripData, isLoaded }) => {
  const ref = useRef(null);
  const [map, setMap] = useState(null);
  const [directionsService, setDirectionsService] = useState(null);
  const [directionsRenderer, setDirectionsRenderer] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [waypoints, setWaypoints] = useState([]);
  const [routeInfo, setRouteInfo] = useState(null);
  const [isAddingWaypoint, setIsAddingWaypoint] = useState(false);

  // Initialize waypoints from props and primary destinations
  useEffect(() => {
    let allWaypoints = [];

    // First, add waypoints from route planning (itinerary)
    if (initialWaypoints && initialWaypoints.length > 0) {
      const transformedWaypoints = initialWaypoints.map((component, index) => ({
        id: component.id || `initial-${index}`,
        lat: parseFloat(component.custom_location?.latitude || component.geoCode?.latitude || 0),
        lng: parseFloat(component.custom_location?.longitude || component.geoCode?.longitude || 0),
        name: component.title || component.name || `Waypoint ${index + 1}`,
        type: component.component_type || component.category || 'custom',
        address: component.custom_location?.address || '',
      })).filter(wp => wp.lat && wp.lng);
      allWaypoints = [...transformedWaypoints];
    }

    // If no waypoints but we have primary destinations, create sample waypoints
    if (allWaypoints.length === 0 && tripData?.destinations) {
      // Smart parsing: extract only cities from "City, Country" format
      const parseDestinations = (destinationsString) => {
        const parts = destinationsString.split(',').map(part => part.trim());
        
        if (parts.length === 2) {
          // Single destination in "City, Country" format - take only the city
          return [parts[0]];
        } else if (parts.length > 2) {
          // Multiple destinations - group by pairs and take cities
          const cities = [];
          for (let i = 0; i < parts.length; i += 2) {
            if (parts[i]) {
              cities.push(parts[i]);
            }
          }
          return cities;
        } else {
          // Single destination without country
          return parts;
        }
      };
      
      const destinations = parseDestinations(tripData.destinations);
      const sampleWaypoints = destinations.map((dest, index) => ({
        id: `dest-${index}`,
        lat: 40.7128 + (index * 0.1), // Sample coordinates (will be geocoded later)
        lng: -74.0060 + (index * 0.1),
        name: dest,
        type: 'destination',
        address: dest,
      }));
      allWaypoints = sampleWaypoints;
      toast.info(`Added ${destinations.length} destination(s) from your primary destinations. You can drag to reorder or add custom waypoints.`);
    }

    setWaypoints(allWaypoints);
  }, [initialWaypoints, tripData?.destinations]);

  // Initialize map with enhanced safety checks
  useEffect(() => {
    if (ref.current && !map && isLoaded && window.google && window.google.maps) {
      try {
        // Extra safety check for required Google Maps APIs
        if (!window.google.maps.Map || !window.google.maps.DirectionsService || !window.google.maps.DirectionsRenderer) {
          console.warn('Google Maps APIs not fully loaded');
          return;
        }

        const newMap = new window.google.maps.Map(ref.current, {
          center: { lat: 40.7128, lng: -74.0060 },
          zoom: 8,
          clickableIcons: false,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
        });

        setMap(newMap);
        
        // Initialize directions service and renderer with safety checks
        try {
          const directionsService = new window.google.maps.DirectionsService();
          const directionsRenderer = new window.google.maps.DirectionsRenderer({
            draggable: true,
            suppressMarkers: false,
          });
          
          directionsRenderer.setMap(newMap);
          setDirectionsService(directionsService);
          setDirectionsRenderer(directionsRenderer);
        } catch (directionsError) {
          console.warn('Error initializing directions services:', directionsError);
          // Map can still work without directions
        }
      } catch (error) {
        console.error('Error initializing Google Maps:', error);
        toast.error('Failed to initialize map. Please refresh the page.');
      }
    }
  }, [ref, map, isLoaded]);

  // Update markers
  useEffect(() => {
    if (!map || !window.google || !window.google.maps) return;

    // Clear existing markers
    markers.forEach(marker => {
      try {
        marker.setMap(null);
      } catch (error) {
        console.warn('Error removing marker:', error);
      }
    });
    const newMarkers = [];

    waypoints.forEach((waypoint, index) => {
      if (waypoint.lat && waypoint.lng && !isNaN(waypoint.lat) && !isNaN(waypoint.lng)) {
        try {
          const marker = new window.google.maps.Marker({
            position: { lat: waypoint.lat, lng: waypoint.lng },
            map,
            label: `${index + 1}`,
            title: waypoint.name || `Waypoint ${index + 1}`,
          });
          
          if (window.google.maps.InfoWindow) {
            const infowindow = new window.google.maps.InfoWindow({
              content: `<div><b>${waypoint.name || `Waypoint ${index + 1}`}</b><br/>${waypoint.address || waypoint.type || 'Location'}</div>`,
            });
            
            marker.addListener("click", () => {
              try {
                infowindow.open(map, marker);
              } catch (error) {
                console.warn('Error opening info window:', error);
              }
            });
          }
          
          newMarkers.push(marker);
        } catch (error) {
          console.warn('Error creating marker:', error);
        }
      }
    });
    setMarkers(newMarkers);

    // Fit map bounds to markers
    if (newMarkers.length > 0 && window.google.maps.LatLngBounds) {
      try {
        const bounds = new window.google.maps.LatLngBounds();
        newMarkers.forEach(marker => {
          const position = marker.getPosition();
          if (position) {
            bounds.extend(position);
          }
        });
        map.fitBounds(bounds);
        if (newMarkers.length === 1) {
          map.setZoom(12);
        }
      } catch (error) {
        console.warn('Error fitting bounds:', error);
      }
    }
  }, [map, waypoints]);

  // Calculate directions - with comprehensive safety checks
  useEffect(() => {
    // Comprehensive safety checks - return early if anything is missing
    if (!isLoaded || !map || !directionsService || !directionsRenderer) {
      return;
    }
    
    // Comprehensive Google Maps API validation
    if (!window.google || 
        !window.google.maps || 
        !window.google.maps.TravelMode || 
        !window.google.maps.TravelMode.DRIVING ||
        !window.google.maps.DirectionsStatus ||
        !window.google.maps.DirectionsStatus.OK) {
      console.warn('Google Maps API not fully loaded, skipping directions calculation');
      return;
    }

    // Clear route if less than 2 waypoints
    if (waypoints.length < 2) {
      try {
        if (directionsRenderer && typeof directionsRenderer.setDirections === 'function') {
          directionsRenderer.setDirections({ routes: [] });
        }
      } catch (error) {
        console.warn('Error clearing directions:', error);
      }
      setRouteInfo(null);
      return;
    }

    // Validate waypoints have valid coordinates
    const validWaypoints = waypoints.filter(wp => 
      wp.lat !== undefined && wp.lng !== undefined && 
      !isNaN(parseFloat(wp.lat)) && !isNaN(parseFloat(wp.lng)) &&
      parseFloat(wp.lat) >= -90 && parseFloat(wp.lat) <= 90 && 
      parseFloat(wp.lng) >= -180 && parseFloat(wp.lng) <= 180
    );

    if (validWaypoints.length < 2) {
      setRouteInfo(null);
      return;
    }

    // Prepare route parameters
    const origin = { lat: parseFloat(validWaypoints[0].lat), lng: parseFloat(validWaypoints[0].lng) };
    const destination = { 
      lat: parseFloat(validWaypoints[validWaypoints.length - 1].lat), 
      lng: parseFloat(validWaypoints[validWaypoints.length - 1].lng) 
    };
    const intermediateWaypoints = validWaypoints.slice(1, -1).map(wp => ({
      location: { lat: parseFloat(wp.lat), lng: parseFloat(wp.lng) },
      stopover: true,
    }));

         // Calculate route with comprehensive error handling
     const calculateRoute = async () => {
       try {
         // Comprehensive safety checks
         if (!window.google?.maps?.TravelMode?.DRIVING) {
           console.warn('Google Maps TravelMode.DRIVING not available');
           return;
         }
         
         if (!window.google?.maps?.DirectionsStatus?.OK) {
           console.warn('Google Maps DirectionsStatus not available');
           return;
         }

         if (!directionsService || typeof directionsService.route !== 'function') {
           console.warn('DirectionsService not properly initialized');
           return;
         }



         const routeRequest = {
           origin: origin,
           destination: destination,
           waypoints: intermediateWaypoints,
           optimizeWaypoints: true,
           travelMode: window.google.maps.TravelMode.DRIVING,
         };

         directionsService.route(routeRequest, (response, status) => {
           try {
             // Safety check for DirectionsStatus
             if (!window.google?.maps?.DirectionsStatus?.OK) {
               console.warn('Google Maps DirectionsStatus not available');
               return;
             }
             
             if (status === window.google.maps.DirectionsStatus.OK && response?.routes?.length > 0) {
               if (directionsRenderer && typeof directionsRenderer.setDirections === 'function') {
                 directionsRenderer.setDirections(response);
               }
               
               const route = response.routes[0];
               let totalDuration = 0;
               
               if (route.legs && Array.isArray(route.legs)) {
                 route.legs.forEach(leg => {
                   if (leg.duration && leg.duration.value && typeof leg.duration.value === 'number') {
                     totalDuration += leg.duration.value;
                   }
                 });
               }
               
               if (totalDuration > 0) {
                 setRouteInfo({
                   duration: Math.round(totalDuration / 60) + " mins",
                 });
               } else {
                 setRouteInfo({ duration: "Route calculated" });
               }
             } else {
               console.warn("Route calculation failed:", status);
               setRouteInfo(null);
             }
           } catch (error) {
             console.warn('Error processing route response:', error);
             setRouteInfo(null);
           }
         });
       } catch (error) {
         console.warn('Error initiating route calculation:', error);
         setRouteInfo(null);
       }
     };

    // Only calculate route if everything is properly loaded
    if (isLoaded && map && directionsService && directionsRenderer) {
      const timeoutId = setTimeout(() => {
        try {
          calculateRoute();
        } catch (error) {
          console.warn('Error in route calculation timeout:', error);
          setRouteInfo(null);
        }
      }, 500); // Increased timeout for better stability
      return () => clearTimeout(timeoutId);
    }
  }, [map, directionsService, directionsRenderer, waypoints, isLoaded]);

  const handleRemoveWaypoint = (indexToRemove) => {
    const updatedWaypoints = waypoints.filter((_, index) => index !== indexToRemove);
    setWaypoints(updatedWaypoints);
    if (onWaypointsUpdate) {
      onWaypointsUpdate(updatedWaypoints);
    }
  };

  const handleMoveWaypoint = (index, direction) => {
    if ((direction === -1 && index === 0) || (direction === 1 && index === waypoints.length - 1)) {
      return;
    }
    const newWaypoints = [...waypoints];
    const [movedItem] = newWaypoints.splice(index, 1);
    newWaypoints.splice(index + direction, 0, movedItem);
    setWaypoints(newWaypoints);
    if (onWaypointsUpdate) {
      onWaypointsUpdate(newWaypoints);
    }
  };

  return (
    <div className="space-y-4">
      {/* Route Controls Section */}
      <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Navigation className="h-5 w-5 mr-2 text-blue-600" /> 
          Route Controls
        </h3>
        
        {waypoints.length === 0 ? (
          <div className="text-center py-4">
            <MapPin className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No waypoints added yet.</p>
            <p className="text-xs text-gray-400">Add destinations to your trip to see the route.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {waypoints.map((wp, index) => (
              <li key={wp.id || index} className="p-2 border rounded-md bg-gray-50 text-sm group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center overflow-hidden">
                    <span className="font-medium mr-2">{index + 1}.</span>
                    <span className="truncate">{wp.name}</span>
                  </div>
                  <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100">
                    <button 
                      onClick={() => handleMoveWaypoint(index, -1)} 
                      disabled={index === 0}
                      className="p-1 hover:text-blue-600 disabled:text-gray-300"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => handleMoveWaypoint(index, 1)} 
                      disabled={index === waypoints.length - 1}
                      className="p-1 hover:text-blue-600 disabled:text-gray-300"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => handleRemoveWaypoint(index)} 
                      className="p-1 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 ml-6 truncate">{wp.address || wp.type}</p>
              </li>
            ))}
          </ul>
        )}

        {routeInfo && (
          <div className="mt-4 pt-3 border-t bg-gradient-to-r from-green-50 to-blue-50 p-3 rounded-lg border border-green-200">
            <div className="flex items-center justify-center">
              <Clock className="h-5 w-5 mr-2 text-green-600" /> 
              <span className="text-sm font-medium text-gray-700">Travel Time: <strong className="text-green-700">{routeInfo.duration}</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* Full-Width Map Section */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 to-green-500 text-white p-3">
          <h4 className="font-semibold flex items-center">
            <MapPin className="h-5 w-5 mr-2" />
            Interactive Map View
          </h4>
        </div>
        <div ref={ref} className="w-full h-[60vh] min-h-[500px]" />
      </div>
    </div>
  );
};

// Define libraries outside component to prevent recreation
const libraries = ['places', 'geometry'];

const RoutePlanningMap = ({ tripComponents, onWaypointsUpdate, tripId, tripData }) => {
  const { isLoaded, globalMapsError, fallbackMode, isGoogleMapsReady: globalMapsReady } = useGoogleMaps();

  // Fallback component when Google Maps is not available
  const FallbackRouteDisplay = () => {
    const [waypoints, setWaypoints] = useState([]);

    useEffect(() => {
      if (tripComponents && tripComponents.length > 0) {
        const transformedWaypoints = tripComponents.map((component, index) => ({
          id: component.id || `fallback-${index}`,
          name: component.title || component.name || `Waypoint ${index + 1}`,
          address: component.custom_location?.address || component.geoCode?.address || 'Unknown location',
          type: component.component_type || component.category || 'destination',
        }));
        setWaypoints(transformedWaypoints);
      }
    }, []);

    return (
      <div className="space-y-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
            <h3 className="font-semibold text-yellow-800">Interactive Map Temporarily Unavailable</h3>
          </div>
          <p className="text-sm text-yellow-700 mb-3">
            We're experiencing issues with the Google Maps integration. Here's your route information:
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700"
          >
            Refresh Page
          </button>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Navigation className="h-5 w-5 mr-2 text-blue-600" />
            Your Route ({waypoints.length} stops)
          </h3>

          {waypoints.length === 0 ? (
            <div className="text-center py-8">
              <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No waypoints added to your route yet.</p>
              <p className="text-sm text-gray-500 mt-2">Add destinations in the Route Planning step to see them here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {waypoints.map((waypoint, index) => (
                <div key={waypoint.id || index} className="flex items-center p-3 bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium mr-3">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{waypoint.name}</h4>
                    <p className="text-sm text-gray-600">{waypoint.address}</p>
                    <span className="inline-block mt-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                      {waypoint.type}
                    </span>
                  </div>
                  {index < waypoints.length - 1 && (
                    <div className="ml-3 text-gray-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <h5 className="font-medium text-blue-800 mb-2">📍 Route Information</h5>
            <div className="text-sm text-blue-700">
              <p>• Total stops: {waypoints.length}</p>
              <p>• Route type: Multi-destination trip</p>
              <p>• Map functionality will be restored once Google Maps loads successfully</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="my-6">
      <h2 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center">
        <MapPin className="h-6 w-6 mr-2 text-green-600" />
        Plan Your Route
      </h2>
      
      {globalMapsError || fallbackMode ? (
        <FallbackRouteDisplay />
      ) : !isLoaded || !globalMapsReady ? (
        <div className="flex justify-center items-center h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <div className="ml-3">
            <p>Loading Google Maps...</p>
            <p className="text-sm text-gray-600">This may take a few moments</p>
          </div>
        </div>
      ) : (
        <MapErrorBoundary>
          <MapComponent 
            initialWaypoints={tripComponents} 
            onWaypointsUpdate={onWaypointsUpdate} 
            tripId={tripId}
            tripData={tripData}
            isLoaded={globalMapsReady}
          />
        </MapErrorBoundary>
      )}
    </div>
  );
};

export default RoutePlanningMap; 