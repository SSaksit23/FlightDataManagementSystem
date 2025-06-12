import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      isGoogleMapsError: false
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
      error.message.toLowerCase().includes('api')
    );

    return { 
      hasError: true, 
      error,
      isGoogleMapsError
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Global Error Boundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });

    // If it's a Google Maps error, try to suppress further similar errors
    if (this.state.isGoogleMapsError) {
      console.warn('Google Maps error caught by global boundary, enabling fallback mode');
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
      // If it's a Google Maps error, show a more specific message
      if (this.state.isGoogleMapsError) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
              <div className="text-center">
                <AlertCircle className="mx-auto h-12 w-12 text-yellow-500" />
                <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                  Maps Feature Unavailable
                </h2>
                <p className="mt-2 text-sm text-gray-600">
                  We're experiencing issues with the Google Maps integration. This could be due to:
                </p>
                <ul className="mt-4 text-xs text-gray-500 text-left space-y-1">
                  <li>• API key limitations or quota exceeded</li>
                  <li>• Network connectivity issues</li>
                  <li>• Google Maps service temporary issues</li>
                  <li>• Browser compatibility problems</li>
                </ul>
              </div>
              <div className="space-y-3">
                <button
                  onClick={this.handleRetry}
                  className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </button>
                <button
                  onClick={this.handleRefresh}
                  className="group relative w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  Refresh Page
                </button>
                <div className="text-center">
                  <p className="text-xs text-gray-500">
                    Core trip planning features will still work without maps
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      }

      // For non-Google Maps errors, show a generic error boundary
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-md w-full space-y-8">
            <div className="text-center">
              <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
              <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                Something went wrong
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                We've encountered an unexpected error. Please try refreshing the page.
              </p>
            </div>
            <div className="space-y-3">
              <button
                onClick={this.handleRetry}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </button>
              <button
                onClick={this.handleRefresh}
                className="group relative w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Refresh Page
              </button>
            </div>
            {process.env.NODE_ENV === 'development' && (
              <details className="mt-4 text-xs text-gray-500">
                <summary className="cursor-pointer">Error Details (Development)</summary>
                <pre className="mt-2 whitespace-pre-wrap">
                  {this.state.error && this.state.error.toString()}
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default GlobalErrorBoundary; 