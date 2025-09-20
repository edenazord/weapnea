
declare global {
  interface Window {
    google: any;
  }
}

declare namespace google {
  namespace maps {
    class Map {
      constructor(mapDiv: HTMLElement, opts?: MapOptions);
    }
    
    class Marker {
      constructor(opts?: MarkerOptions);
      addListener(eventName: string, handler: Function): void;
    }

    class InfoWindow {
      constructor(opts?: InfoWindowOptions);
      open(map?: Map, anchor?: Marker): void;
    }

    class Geocoder {
      geocode(
        request: GeocoderRequest,
        callback: (results: GeocoderResult[] | null, status: GeocoderStatus) => void
      ): void;
    }

    class Size {
      constructor(width: number, height: number);
    }

    class Point {
      constructor(x: number, y: number);
    }
    
    interface MapOptions {
      center?: LatLng | LatLngLiteral;
      zoom?: number;
      mapTypeId?: MapTypeId;
    }

    interface MarkerOptions {
      position?: LatLng | LatLngLiteral;
      map?: Map;
      title?: string;
      icon?: any;
    }

    interface InfoWindowOptions {
      content?: string;
    }

    interface GeocoderRequest {
      address?: string;
    }

    interface GeocoderResult {
      geometry: {
        location: {
          lat(): number;
          lng(): number;
        };
      };
    }

    enum GeocoderStatus {
      OK = 'OK',
      ERROR = 'ERROR'
    }

    enum MapTypeId {
      ROADMAP = 'roadmap'
    }

    class LatLng {
      constructor(lat: number, lng: number);
    }

    interface LatLngLiteral {
      lat: number;
      lng: number;
    }

    namespace places {
      class AutocompleteService {
        getPlacePredictions(
          request: AutocompletionRequest,
          callback: (predictions: AutocompletePrediction[] | null, status: PlacesServiceStatus) => void
        ): void;
      }

      class PlacesService {
        constructor(attrContainer: HTMLElement | Map);
      }

      interface AutocompletionRequest {
        input: string;
        types?: string[];
        bounds?: LatLngBounds;
        componentRestrictions?: ComponentRestrictions;
      }

      interface AutocompletePrediction {
        description: string;
        place_id: string;
        structured_formatting?: {
          main_text: string;
          secondary_text: string;
        };
      }

      enum PlacesServiceStatus {
        OK = 'OK',
        ZERO_RESULTS = 'ZERO_RESULTS',
        OVER_QUERY_LIMIT = 'OVER_QUERY_LIMIT',
        REQUEST_DENIED = 'REQUEST_DENIED',
        INVALID_REQUEST = 'INVALID_REQUEST',
        NOT_FOUND = 'NOT_FOUND',
        UNKNOWN_ERROR = 'UNKNOWN_ERROR'
      }

      interface ComponentRestrictions {
        country?: string | string[];
      }

      class LatLngBounds {
        constructor(sw?: LatLng | LatLngLiteral, ne?: LatLng | LatLngLiteral);
      }
    }
  }
}

export {};
