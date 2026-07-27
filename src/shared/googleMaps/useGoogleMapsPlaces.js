import { useEffect, useState } from 'react';
import { resolveGoogleMapsApiKey } from './resolveGoogleMapsApiKey.js';

const SCRIPT_ID = 'tylo-google-maps-js';
let loadPromise = null;

async function ensurePlacesLibrary() {
  if (!window.google?.maps?.importLibrary) {
    throw new Error('Google Maps importLibrary is unavailable');
  }
  await window.google.maps.importLibrary('places');
  return window.google;
}

function loadGoogleMapsScript(apiKey) {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps is only available in the browser'));
  }

  if (window.google?.maps?.importLibrary) {
    return ensurePlacesLibrary();
  }

  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      if (window.google?.maps?.importLibrary) {
        ensurePlacesLibrary().then(resolve).catch(reject);
        return;
      }
      existing.addEventListener(
        'load',
        () => ensurePlacesLibrary().then(resolve).catch(reject),
        { once: true }
      );
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Maps')), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async`;
    script.onload = () => {
      ensurePlacesLibrary().then(resolve).catch(reject);
    };
    script.onerror = () => {
      loadPromise = null;
      reject(new Error('Failed to load Google Maps'));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

/**
 * Load the Google Maps JavaScript API with the Places library.
 */
export function useGoogleMapsPlaces() {
  const buildTimeKey = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
  const [apiKey, setApiKey] = useState(buildTimeKey);
  const [status, setStatus] = useState(buildTimeKey ? 'loading' : 'resolving');

  useEffect(() => {
    if (apiKey) return undefined;

    let cancelled = false;
    setStatus('resolving');
    resolveGoogleMapsApiKey().then((key) => {
      if (cancelled) return;
      if (key) {
        setApiKey(key);
        setStatus('loading');
      } else {
        setStatus('disabled');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  useEffect(() => {
    if (!apiKey) return undefined;

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
    isResolving: status === 'resolving',
    isDisabled: status === 'disabled',
    hasError: status === 'error',
  };
}
