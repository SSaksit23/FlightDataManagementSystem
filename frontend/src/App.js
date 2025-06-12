// frontend/src/App.js
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Outlet, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { GoogleMapsProvider } from './contexts/GoogleMapsContext';
import GlobalErrorBoundary from './components/GlobalErrorBoundary';
import TripCustomizationEngine from './components/TripCustomizationEngine';
import { User, LogOut, Settings, Menu, X, Home, Compass } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Simple HomePage Component  
const HomePage = () => {
  return (
    <div className="text-center py-20">
      <h1 className="text-4xl font-bold text-gray-800 mb-4">Welcome to AdventureConnect</h1>
      <p className="text-gray-600 mb-8">Plan your dream adventure with our smart trip customization engine.</p>
      <Link to="/customize-trip" className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
        Start Planning
      </Link>
    </div>
  );
};

const NotFoundPage = () => (
  <div className="text-center py-20">
    <h1 className="text-4xl font-bold text-gray-800 mb-4">404 - Page Not Found</h1>
    <p className="text-gray-600 mb-8">Oops! The page you are looking for does not exist.</p>
    <Link to="/" className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
      Go to Homepage
    </Link>
  </div>
);

// Protected Route Component
const ProtectedRoute = ({ children, roles }) => {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    toast.info('Please sign in to access this page.');
    return <Navigate to="/" replace />;
  }
  if (roles && roles.length > 0 && !roles.includes(user?.role)) {
    toast.error('You do not have permission to access this page.');
    return <Navigate to="/" replace />;
  }
  return children;
};

const Layout = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const handleLogout = async () => {
    await logout();
    setShowUserMenu(false);
    setShowMobileMenu(false);
    toast.success('Logged out successfully!');
  };

  const navLinks = [
    { path: "/", label: "Home", icon: <Home className="h-5 w-5" /> },
    { path: "/customize-trip", label: "Customize Trip", icon: <Compass className="h-5 w-5" /> },
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <Link to="/" className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold text-gray-900">✈️ AdventureConnect</h1>
            </Link>

            <nav className="hidden md:flex items-center space-x-1">
              {navLinks.map(link => (
                <Link key={link.path} to={link.path} className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 flex items-center space-x-1">
                  {link.icon}<span>{link.label}</span>
                </Link>
              ))}
            </nav>

            <div className="hidden md:flex items-center space-x-4">
              {isAuthenticated ? (
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center space-x-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition"
                  >
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium">
                      {user?.firstName?.[0]}{user?.lastName?.[0]}
                    </div>
                    <span className="text-sm font-medium text-gray-700">{user?.firstName}</span>
                  </button>
                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border py-1 z-30">
                      <div className="px-4 py-2 border-b">
                        <p className="text-sm font-medium text-gray-900">{user?.firstName} {user?.lastName}</p>
                        <p className="text-xs text-gray-500 capitalize">{user?.role?.replace('_', ' ')}</p>
                      </div>
                      <button onClick={handleLogout} className="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 flex items-center space-x-2">
                        <LogOut className="h-4 w-4" /><span>Sign Out</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <button className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium">Sign In</button>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Sign Up</button>
                </div>
              )}
            </div>
            <div className="md:hidden">
              <button onClick={() => setShowMobileMenu(!showMobileMenu)} className="p-2 rounded-lg hover:bg-gray-100">
                {showMobileMenu ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
          {showMobileMenu && (
            <div className="md:hidden mt-4 pb-4 border-t">
              <nav className="flex flex-col space-y-1 pt-2">
                {navLinks.map(link => (
                  <Link key={link.path} to={link.path} onClick={() => setShowMobileMenu(false)} className="px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 flex items-center space-x-2">
                   {link.icon} <span>{link.label}</span>
                  </Link>
                ))}
              </nav>
            </div>
          )}
        </div>
      </header>
      <main className="flex-grow max-w-7xl mx-auto py-6 px-4 w-full">
        <Outlet />
      </main>
      {(showUserMenu || showMobileMenu) && (
        <div className="fixed inset-0 z-10" onClick={() => { setShowUserMenu(false); setShowMobileMenu(false); }} />
      )}
    </div>
  );
};

const App = () => {
  return (
    <GlobalErrorBoundary>
      <GoogleMapsProvider>
        <AuthProvider>
          <Router>
            <ToastContainer position="bottom-right" autoClose={5000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<HomePage />} />
                
                {/* Trip Customization Routes */}
                <Route path="/customize-trip" element={<TripCustomizationEngine />} />
                <Route path="/customize-trip/:tripId" element={<TripCustomizationEngine />} />
                
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </Router>
        </AuthProvider>
      </GoogleMapsProvider>
    </GlobalErrorBoundary>
  );
};

export default App;
