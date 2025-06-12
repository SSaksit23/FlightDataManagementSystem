import React from 'react';
import { GoogleMap, useJsApiLoader, Marker, Polyline } from '@react-google-maps/api';

const containerStyle = {
  width: '100%',
  height: '300px', // You can adjust this height
  marginTop: '15px',
  borderRadius: '8px',
  border: '1px solid #ddd'
};

// Default center (e.g., world view) if no specific coordinates given
const defaultCenter = {
  lat: 20,
  lng: 0
};

function GoogleMapComponent({ originCoords, destinationCoords, originName, destinationName }) {
  const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || 'AIzaSyC8thfcniP-SWuADDMKaRKwG_4chz01E8k';

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey || "", // Fallback to empty string if undefined
    libraries: ['geometry'], // Useful for geodesic polylines
  });

  const [map, setMap] = React.useState(null);

  const onLoad = React.useCallback(function callback(mapInstance) {
    if (originCoords && destinationCoords &&
        typeof originCoords.latitude === 'number' && typeof originCoords.longitude === 'number' &&
        typeof destinationCoords.latitude === 'number' && typeof destinationCoords.longitude === 'number') {
      
      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend(new window.google.maps.LatLng(originCoords.latitude, originCoords.longitude));
      bounds.extend(new window.google.maps.LatLng(destinationCoords.latitude, destinationCoords.longitude));
      mapInstance.fitBounds(bounds);

      // Optional: Adjust zoom after fitting bounds if it's too close or too far
      const listener = window.google.maps.event.addListener(mapInstance, "idle", function () {
        if (bounds.getNorthEast().equals(bounds.getSouthWest())) { // If origin and dest are same
             mapInstance.setZoom(10);
        } else if (mapInstance.getZoom() > 15) { // Don't zoom in too much
            mapInstance.setZoom(15);
        }
        // Add a little padding by slightly zooming out if there's more than one point
        if (!bounds.getNorthEast().equals(bounds.getSouthWest()) && mapInstance.getZoom() > 2) {
             // mapInstance.setZoom(mapInstance.getZoom() -1); // This might be too aggressive
        }
        window.google.maps.event.removeListener(listener);
      });

    } else if (originCoords && typeof originCoords.latitude === 'number' && typeof originCoords.longitude === 'number') {
        mapInstance.setCenter({ lat: originCoords.latitude, lng: originCoords.longitude });
        mapInstance.setZoom(5);
    }
    setMap(mapInstance);
  }, [originCoords, destinationCoords]);

  const onUnmount = React.useCallback(function callback(mapInstance) {
    setMap(null);
  }, []);

  const pathCoordinates = (originCoords && destinationCoords &&
    typeof originCoords.latitude === 'number' && typeof destinationCoords.latitude === 'number'
  ) ? [
    { lat: originCoords.latitude, lng: originCoords.longitude },
    { lat: destinationCoords.latitude, lng: destinationCoords.longitude },
  ] : [];

  if (loadError) {
    console.error("Google Maps API load error:", loadError);
    return <div style={{padding: '20px', color: 'red', textAlign: 'center'}}>Error loading map. Please check your API key and ensure it's correctly configured and enabled in the Google Cloud Console.</div>;
  }

  if (!apiKey) {
    return <div style={{padding: '20px', color: 'orange', textAlign: 'center'}}>Google Maps API Key is missing. Please configure it in your frontend environment.</div>;
  }

  return isLoaded ? (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={defaultCenter}
      zoom={2}
      onLoad={onLoad}
      onUnmount={onUnmount}
      options={{ // Optional: customize map controls
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
      }}
    >
      {originCoords && typeof originCoords.latitude === 'number' && (
        <Marker 
          position={{ lat: originCoords.latitude, lng: originCoords.longitude }} 
          title={originName || 'Origin'} 
        />
      )}
      {destinationCoords && typeof destinationCoords.latitude === 'number' && (
        <Marker 
          position={{ lat: destinationCoords.latitude, lng: destinationCoords.longitude }} 
          title={destinationName || 'Destination'} 
        />
      )}
      {pathCoordinates.length === 2 && (
        <Polyline
          path={pathCoordinates}
          options={{
            strokeColor: '#007bff', // Blue line, like your button
            strokeOpacity: 0.9,
            strokeWeight: 3,
            geodesic: true, // Draws a curved line appropriate for the globe
          }}
        />
      )}
    </GoogleMap>
  ) : <div style={{...containerStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f9fa'}}>Loading Map...</div>;
}

export default React.memo(GoogleMapComponent);