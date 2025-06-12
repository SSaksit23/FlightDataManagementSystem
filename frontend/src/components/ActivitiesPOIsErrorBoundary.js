import React from 'react';
import { AlertCircle, RefreshCw, MapPin, Compass } from 'lucide-react';

class ActivitiesPOIsErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      isGoogleMapsError: false,
      componentName: props.componentName || 'Activities & POIs'
    };
  }

  static getDerivedStateFromError(error) {
    // Check if this is a Google Maps related error
    const isGoogleMapsError = error.message && (
      error.message.includes('google') ||
      error.message.includes('maps') ||
      error.message.includes('travelMode') ||
      error.message.includes('DirectionsStatus') ||
      error.message.includes('places') ||
      error.message.toLowerCase().includes('api') ||
      error.message.includes('Script error')
    );

    return { 
      hasError: true, 
      error,
      isGoogleMapsError
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ActivitiesPOIsErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });

    // If it's a Google Maps error, try to suppress further similar errors
    if (this.state.isGoogleMapsError) {
      console.warn('Google Maps error caught in Activities & POIs page, showing fallback');
    }
  }

  handleRetry = () => {
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null,
      isGoogleMapsError: false
    });
  };

  handleRefresh = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // If it's a Google Maps error, show a more specific message for Activities page
      if (this.state.isGoogleMapsError) {
        return (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 my-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-yellow-800 mb-2">
                  {this.state.componentName} Feature Temporarily Limited
                </h3>
                <div className="text-sm text-yellow-700 space-y-2">
                  <p>
                    We're experiencing issues with the Google Maps integration on this page. 
                    This could be due to:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-xs text-yellow-600">
                    <li>API key limitations or quota exceeded</li>
                    <li>Network connectivity issues</li>
                    <li>Google Maps service temporary issues</li>
                    <li>Multiple map components conflicting</li>
                  </ul>
                  
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                    <h4 className="font-medium text-blue-800 mb-1">✅ What still works:</h4>
                    <ul className="text-xs text-blue-700 space-y-1">
                      <li>• Manual activity search and booking</li>
                      <li>• AI recommendations</li>
                      <li>• Local guide suggestions</li>
                      <li>• Activity management and scheduling</li>
                    </ul>
                  </div>
                  
                  <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded">
                    <h4 className="font-medium text-orange-800 mb-1">⚠️ Temporarily limited:</h4>
                    <ul className="text-xs text-orange-700 space-y-1">
                      <li>• Interactive map view on this page</li>
                      <li>• Real-time location plotting</li>
                      <li>• Map-based activity discovery</li>
                    </ul>
                  </div>
                </div>
                
                <div className="flex space-x-3 mt-4">
                  <button
                    onClick={this.handleRetry}
                    className="flex items-center px-4 py-2 bg-yellow-600 text-white text-sm font-medium rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again
                  </button>
                  <button
                    onClick={this.handleRefresh}
                    className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                  >
                    <Compass className="h-4 w-4 mr-2" />
                    Refresh Page
                  </button>
                </div>
                
                <div className="mt-4 text-xs text-yellow-600">
                  <p>
                    💡 <strong>Tip:</strong> The route planning page has a working map that you can use. 
                    You can plan your route there and come back here to add activities manually.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      }

      // For non-Google Maps errors, show a generic error message
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 my-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-800 mb-2">
                Something went wrong with {this.state.componentName}
              </h3>
              <p className="text-sm text-red-700 mb-4">
                We've encountered an unexpected error in this component. Please try refreshing or contact support if the issue persists.
              </p>
              
              <div className="flex space-x-3">
                <button
                  onClick={this.handleRetry}
                  className="flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </button>
                <button
                  onClick={this.handleRefresh}
                  className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  Refresh Page
                </button>
              </div>
              
              {process.env.NODE_ENV === 'development' && (
                <details className="mt-4 text-xs text-gray-500">
                  <summary className="cursor-pointer font-medium">Error Details (Development)</summary>
                  <pre className="mt-2 whitespace-pre-wrap bg-gray-100 p-2 rounded text-xs overflow-auto">
                    {this.state.error && this.state.error.toString()}
                    {this.state.errorInfo && this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ActivitiesPOIsErrorBoundary; 