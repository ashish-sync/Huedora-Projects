import { useEffect, useState } from 'react';

const SCRIPT_ID = 'tylo-google-maps-js';
let loadPromise = null;

function loadGoogleMapsScript(apiKey) {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps is only available in the browser'));
  }
  if (window.google?.maps?.places) {
    return Promise.resolve(window.google);
  }
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Maps')), { once: true });
      return;
    }

    const callbackName = '__tyloGoogleMapsInit';
    window[callbackName] = () => {
      delete window[callbackName];
      resolve(window.google);
    };

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&callback=${callbackName}`;
    script.onerror = () => {
      delete window[callbackName];
      loadPromise = null;
      reject(new Error('Failed to load Google Maps'));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

/**
 * Load the Google Maps JavaScript API with the Places library.
 * Returns status: disabled (no key), loading, ready, or error.
 */
export function useGoogleMapsPlaces() {
  const apiKey = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
  const [status, setStatus] = useState(apiKey ? 'loading' : 'disabled');

  useEffect(() => {
    if (!apiKey) {
      setStatus('disabled');
      return undefined;
    }

    let cancelled = false;
    setStatus('loading');
    loadGoogleMapsScript(apiKey)
      .then(() => {
        if (!cancelled) setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  return {
    apiKey,
    status,
    isReady: status === 'ready',
    isDisabled: status === 'disabled',
    hasError: status === 'error',
  };
}
