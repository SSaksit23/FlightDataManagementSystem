import React, { createContext, useContext, useState, useEffect } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import { toast } from 'react-toastify';

const GoogleMapsContext = createContext();

// Global Google Maps configuration
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || 'AIzaSyC8thfcniP-SWuADDMKaRKwG_4chz01E8k';
const GOOGLE_MAPS_LIBRARIES = ['places', 'geometry'];

export const GoogleMapsProvider = ({ children }) => {
  const [globalMapsError, setGlobalMapsError] = useState(false);
  const [apiReadyConfirmed, setApiReadyConfirmed] = useState(false);
  const [fallbackMode, setFallbackMode] = useState(false);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'global-google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
    preventGoogleFontsLoading: true,
    version: "weekly"
  });

  // Global error handler for Google Maps related errors
  useEffect(() => {
    const handleGlobalError = (error) => {
      if (error.message && (
        error.message.includes('google') || 
        error.message.includes('maps') || 
        error.message.includes('travelMode') ||
        error.message.includes('DirectionsStatus') ||
        error.message.includes('places') ||
        error.message.toLowerCase().includes('api')
      )) {
        console.warn('Global Google Maps error detected:', error);
        setGlobalMapsError(true);
        setFallbackMode(true);
      }
    };

    const handleGlobalRejection = (event) => {
      if (event.reason && event.reason.message && (
        event.reason.message.includes('google') || 
        event.reason.message.includes('maps') ||
        event.reason.message.includes('api')
      )) {
        console.warn('Global Google Maps promise rejection:', event.reason);
        setGlobalMapsError(true);
        setFallbackMode(true);
      }
    };

    // Global error listeners
    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleGlobalRejection);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleGlobalRejection);
    };
  }, []);

  // Comprehensive API readiness check
  useEffect(() => {
    if (isLoaded && !fallbackMode) {
      let attempts = 0;
      const maxAttempts = 30; // 6 seconds maximum wait

      const checkFullApiReadiness = () => {
        attempts++;
        
        try {
          const isFullyReady = window.google && 
            window.google.maps && 
            window.google.maps.Map && 
            window.google.maps.DirectionsService && 
            window.google.maps.DirectionsRenderer &&
            window.google.maps.TravelMode &&
            window.google.maps.DirectionsStatus &&
            window.google.maps.places &&
            window.google.maps.places.PlacesService;

          if (isFullyReady) {
            setApiReadyConfirmed(true);
            console.log('Google Maps API fully loaded and confirmed');
          } else if (attempts < maxAttempts) {
            setTimeout(checkFullApiReadiness, 200);
          } else {
            console.warn('Google Maps API failed to load completely, enabling fallback mode');
            setFallbackMode(true);
            toast.warning('Maps functionality is using fallback mode due to API limitations');
          }
        } catch (error) {
          console.warn('Error checking Google Maps API readiness:', error);
          setFallbackMode(true);
        }
      };

      setTimeout(checkFullApiReadiness, 1000);
    }
  }, [isLoaded, fallbackMode]);

  // Handle load errors
  useEffect(() => {
    if (loadError) {
      console.error('Google Maps load error:', loadError);
      setGlobalMapsError(true);
      setFallbackMode(true);
      toast.error('Google Maps failed to load. Using fallback mode.');
    }
  }, [loadError]);

  // Safe Google Maps API checker
  const isGoogleMapsReady = () => {
    if (fallbackMode || globalMapsError) return false;
    
    try {
      return isLoaded && 
        apiReadyConfirmed && 
        window.google && 
        window.google.maps && 
        window.google.maps.Map && 
        window.google.maps.DirectionsService && 
        window.google.maps.DirectionsRenderer &&
        window.google.maps.TravelMode &&
        window.google.maps.DirectionsStatus;
    } catch (error) {
      console.warn('Error checking Google Maps readiness:', error);
      return false;
    }
  };

  // Safe API access wrapper
  const safeGoogleMapsCall = (callback, fallbackCallback) => {
    try {
      if (isGoogleMapsReady()) {
        return callback();
      } else {
        console.log('Google Maps not ready, using fallback');
        return fallbackCallback ? fallbackCallback() : null;
      }
    } catch (error) {
      console.warn('Error in Google Maps call, using fallback:', error);
      setGlobalMapsError(true);
      setFallbackMode(true);
      return fallbackCallback ? fallbackCallback() : null;
    }
  };

  // Reset function for retry attempts
  const resetGoogleMaps = () => {
    setGlobalMapsError(false);
    setFallbackMode(false);
    setApiReadyConfirmed(false);
  };

  const contextValue = {
    isLoaded,
    loadError,
    globalMapsError,
    fallbackMode,
    apiReadyConfirmed,
    isGoogleMapsReady: isGoogleMapsReady(),
    safeGoogleMapsCall,
    resetGoogleMaps
  };

  return (
    <GoogleMapsContext.Provider value={contextValue}>
      {children}
    </GoogleMapsContext.Provider>
  );
};

export const useGoogleMaps = () => {
  const context = useContext(GoogleMapsContext);
  if (context === undefined) {
    throw new Error('useGoogleMaps must be used within a GoogleMapsProvider');
  }
  return context;
};

export default GoogleMapsContext; 