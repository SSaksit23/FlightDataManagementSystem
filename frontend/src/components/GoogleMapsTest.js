import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const GoogleMapsTest = () => {
  const mapRef = useRef(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  useEffect(() => {
    const initMap = () => {
      if (window.google && window.google.maps) {
        try {
          const map = new window.google.maps.Map(mapRef.current, {
            center: { lat: 40.7128, lng: -74.0060 }, // New York City
            zoom: 10,
          });

          // Test Places API
          const placesService = new window.google.maps.places.PlacesService(map);
          placesService.textSearch({
            query: 'attractions New York',
            fields: ['name', 'geometry']
          }, (results, status) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK) {
              setStatus('success');
              // Add markers for first few results
              results.slice(0, 3).forEach((place, index) => {
                new window.google.maps.Marker({
                  position: place.geometry.location,
                  map: map,
                  title: place.name,
                  label: `${index + 1}`
                });
              });
            } else {
              setStatus('error');
              setError(`Places API Error: ${status}`);
            }
          });

        } catch (err) {
          setStatus('error');
          setError(err.message);
        }
      } else {
        setStatus('error');
        setError('Google Maps API not loaded');
      }
    };

    // Wait for Google Maps to load
    if (window.google && window.google.maps) {
      initMap();
    } else {
      const checkGoogleMaps = setInterval(() => {
        if (window.google && window.google.maps) {
          clearInterval(checkGoogleMaps);
          initMap();
        }
      }, 100);

      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkGoogleMaps);
        if (status === 'loading') {
          setStatus('error');
          setError('Google Maps API failed to load within 10 seconds');
        }
      }, 10000);
    }
  }, []);

  const getStatusDisplay = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="flex items-center text-blue-600">
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            <span>Loading Google Maps API...</span>
          </div>
        );
      case 'success':
        return (
          <div className="flex items-center text-green-600">
            <CheckCircle className="h-5 w-5 mr-2" />
            <span>Google Maps API is working correctly!</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center text-red-600">
            <AlertCircle className="h-5 w-5 mr-2" />
            <span>Error: {error}</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4">Google Maps API Status</h3>
      
      {getStatusDisplay()}
      
      <div 
        ref={mapRef} 
        className="w-full h-64 mt-4 rounded-lg border border-gray-300"
        style={{ minHeight: '256px' }}
      />
      
      {status === 'success' && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-700">
            ✅ Google Maps API is loaded and functional<br/>
            ✅ Places API is working<br/>
            ✅ Map rendering is successful<br/>
            ✅ The Intelligent Route Planner should work properly
          </p>
        </div>
      )}
      
      {status === 'error' && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">
            ❌ Google Maps API is not working properly<br/>
            Please check your API key and billing settings in Google Cloud Console
          </p>
        </div>
      )}
    </div>
  );
};

export default GoogleMapsTest; 