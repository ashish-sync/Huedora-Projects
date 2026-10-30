import { createContext, useContext } from 'react';

/** Optional PIN / city lookup override for public (unauthenticated) camp forms. */
export const GeoLookupContext = createContext(null);

export function useGeoLookup() {
  return useContext(GeoLookupContext);
}
