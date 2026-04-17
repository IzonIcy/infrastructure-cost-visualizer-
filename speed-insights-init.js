// Vercel Speed Insights initialization
// This script loads and initializes Vercel Speed Insights for the application

(function() {
  'use strict';

  // Initialize the queue for Speed Insights
  if (window.si) return;
  window.si = function(...params) {
    window.siq = window.siq || [];
    window.siq.push(params);
  };

  // Detect environment
  function isDevelopment() {
    return window.location.hostname === 'localhost' || 
           window.location.hostname === '127.0.0.1' ||
           window.location.hostname === '';
  }

  // Determine script source based on environment
  function getScriptSrc() {
    if (isDevelopment()) {
      return 'https://va.vercel-scripts.com/v1/speed-insights/script.debug.js';
    }
    return '/_vercel/speed-insights/script.js';
  }

  // Create and inject the Speed Insights script
  function injectScript() {
    const src = getScriptSrc();
    
    // Check if script is already loaded
    if (document.head.querySelector(`script[src*="${src}"]`)) {
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    script.dataset.sdkn = '@vercel/speed-insights';
    script.dataset.sdkv = '2.0.0';
    
    script.onerror = function() {
      console.log(
        '[Vercel Speed Insights] Failed to load script from ' + src + 
        '. Please check if any content blockers are enabled and try again.'
      );
    };

    document.head.appendChild(script);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectScript);
  } else {
    injectScript();
  }
})();
