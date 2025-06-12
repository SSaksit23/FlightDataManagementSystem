import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

const SafeMapWrapper = ({ children, onError, mapType = "Map" }) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Give the component a chance to load
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const handleError = (error) => {
    console.warn(`SafeMapWrapper caught error in ${mapType}:`, error);
    setHasError(true);
    if (onError) {
      onError(error);
    }
  };

  // Wrap in try-catch for additional safety
  try {
    if (hasError) {
      return (
        <div className="flex items-center justify-center h-64 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="text-center p-6">
            <AlertCircle className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600">{mapType} temporarily unavailable</p>
            <p className="text-xs text-gray-500 mt-1">Please use the Route Planning page for map functionality</p>
          </div>
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-64 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="text-center p-6">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Loading {mapType}...</p>
          </div>
        </div>
      );
    }

    return (
      <div
        onError={handleError}
        style={{ width: '100%', height: '100%' }}
      >
        {children}
      </div>
    );
  } catch (error) {
    handleError(error);
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="text-center p-6">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-gray-600">{mapType} failed to load</p>
          <p className="text-xs text-gray-500 mt-1">Please refresh the page or use Route Planning</p>
        </div>
      </div>
    );
  }
};

export default SafeMapWrapper; 