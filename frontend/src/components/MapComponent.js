// ==========================================
// FILE 3: frontend/src/components/MapComponent.js
// REPLACE THE ENTIRE FILE WITH THIS CONTENT
// ==========================================

import React from 'react';

const MapComponent = ({ origin, destination, hotels, selectedHotel, height = '400px', type = 'flight' }) => {
  return (
    <div 
      style={{ 
        height, 
        width: '100%', 
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        backgroundColor: '#f9fafb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column'
      }}
    >
      <div className="text-6xl mb-4">🗺️</div>
      <p className="text-gray-500 text-center">
        {type === 'flight' ? 'Flight Route Map' : 'Hotel Location Map'}
      </p>
      <p className="text-sm text-gray-400 text-center mt-2">
        Interactive map coming soon!
      </p>
      {type === 'flight' && origin && destination && (
        <div className="mt-4 text-center">
          <div className="text-sm text-gray-600">
            📍 {origin.city || origin.name} → {destination.city || destination.name}
          </div>
        </div>
      )}
      {type === 'hotels' && hotels && hotels.length > 0 && (
        <div className="mt-4 text-center">
          <div className="text-sm text-gray-600">
            🏨 {hotels.length} hotel{hotels.length !== 1 ? 's' : ''} found
          </div>
        </div>
      )}
    </div>
  );
};

export default MapComponent;