import React, { useEffect } from 'react';

const StagewiseSetup = () => {
  useEffect(() => {
    // Only load Stagewise in development mode
    if (process.env.NODE_ENV === 'development') {
      try {
        // Dynamic import to avoid build errors if module is missing
        import('@stagewise/toolbar-react').then((module) => {
          const { StagewiseToolbar } = module;
          // Create a container for Stagewise if it doesn't exist
          let container = document.getElementById('stagewise-container');
          if (!container) {
            container = document.createElement('div');
            container.id = 'stagewise-container';
            document.body.appendChild(container);
          }
          
          console.log('Stagewise toolbar loaded successfully');
        }).catch((error) => {
          console.log('Stagewise not available:', error.message);
        });
      } catch (error) {
        console.log('Failed to load Stagewise:', error.message);
      }
    }
  }, []);

  return null; // This component doesn't render anything
};

export default StagewiseSetup; 