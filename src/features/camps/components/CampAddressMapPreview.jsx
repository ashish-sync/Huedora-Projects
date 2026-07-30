import { useEffect, useRef } from 'react';
import { useGoogleMapsPlaces } from '../../../shared/googleMaps/useGoogleMapsPlaces.js';

/**
 * Embedded map preview for a verified camp address (lat/lng from Google Places).
 */
export default function CampAddressMapPreview({
  latitude = '',
  longitude = '',
  address = '',
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const { isReady, isDisabled, hasError } = useGoogleMapsPlaces();

  const lat = Number(latitude);
  const lng = Number(longitude);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

  useEffect(() => {
    if (!isReady || !hasCoords || !mapRef.current || !window.google?.maps) return undefined;

    const center = { lat, lng };
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        center,
        zoom: 16,
        disableDefaultUI: true,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: 'cooperative',
      });
    } else {
      mapInstanceRef.current.setCenter(center);
    }

    if (markerRef.current) {
      markerRef.current.setPosition(center);
    } else {
      markerRef.current = new window.google.maps.Marker({
        position: center,
        map: mapInstanceRef.current,
        title: address || 'Camp location',
      });
    }

    return undefined;
  }, [isReady, lat, lng, hasCoords, address]);

  if (isDisabled || hasError || !hasCoords) return null;

  return (
    <div className="camp-address-map-wrap" aria-label="Map preview of selected camp address">
      <div className="camp-address-map" ref={mapRef} />
      <p className="muted camp-address-map-caption">Verify the pin matches your camp / clinic location.</p>
    </div>
  );
}
