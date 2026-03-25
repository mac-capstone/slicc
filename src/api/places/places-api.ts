import { Env } from '@env';
import { v4 as uuidv4 } from 'uuid';

const PLACES_BASE = 'https://places.googleapis.com/v1/places';
const FIELD_MASK =
  'places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.name,places.primaryType,places.types,places.priceLevel';

export type PriceLevel = 'FREE' | 'INEXPENSIVE' | 'MODERATE' | 'EXPENSIVE';

type PlaceLocation = {
  latitude: number;
  longitude: number;
};

type PlaceDisplayName = {
  text?: string;
};

export type Place = {
  id: string;
  displayName: string;
  formattedAddress?: string;
  location?: PlaceLocation;
  rating?: number;
  userRatingCount?: number;
  primaryType?: string;
  types?: string[];
  priceLevel?: PriceLevel;
};

type PlacesApiPlace = {
  name?: string;
  displayName?: PlaceDisplayName;
  formattedAddress?: string;
  location?: PlaceLocation;
  rating?: number;
  userRatingCount?: number;
  primaryType?: string;
  types?: string[];
  priceLevel?: PriceLevel;
};

export function hasPlacesApiKey(): boolean {
  return !!Env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
}

function getApiKey(): string {
  const key = Env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error('EXPO_PUBLIC_GOOGLE_PLACES_API_KEY is not set');
  return key;
}

function mapPlace(raw: PlacesApiPlace): Place {
  const displayName =
    typeof raw.displayName === 'string'
      ? raw.displayName
      : (raw.displayName?.text ?? 'Unknown');
  const id = raw.name?.replace('places/', '') ?? uuidv4();
  return {
    id,
    displayName,
    formattedAddress: raw.formattedAddress,
    location: raw.location,
    rating: raw.rating,
    userRatingCount: raw.userRatingCount,
    primaryType: raw.primaryType,
    types: raw.types,
    priceLevel: raw.priceLevel,
  };
}

type SearchNearbyParams = {
  lat: number;
  lng: number;
  radiusMeters?: number;
  includedTypes?: string[];
};

export async function searchNearby({
  lat,
  lng,
  radiusMeters = 5000,
  includedTypes,
}: SearchNearbyParams): Promise<Place[]> {
  const res = await fetch(`${PLACES_BASE}:searchNearby`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': getApiKey(),
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify({
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: radiusMeters,
        },
      },
      maxResultCount: 20,
      ...(includedTypes?.length ? { includedTypes } : {}),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Places API error: ${res.status} ${err}`);
  }

  const data = (await res.json()) as { places?: PlacesApiPlace[] };
  return (data.places ?? []).map(mapPlace);
}

type SearchNearbyRecommendationsOptions = {
  radiusMeters?: number;
  maxResultCount?: number;
};

export type SearchNearbyRecommendationsParams = {
  latitude: number;
  longitude: number;
  includedTypes: string[];
};

/**
 * Nearby search for recommendations. Pass empty `includedTypes` to omit the
 * filter (any place type), same as {@link searchNearby}.
 */
export async function searchNearbyForRecommendations(
  params: SearchNearbyRecommendationsParams,
  options?: SearchNearbyRecommendationsOptions
): Promise<Place[]> {
  const { latitude, longitude, includedTypes } = params;
  const radiusMeters = options?.radiusMeters ?? 5000;
  /** API constraint: 1–20 inclusive */
  const maxResultCount = Math.min(
    20,
    Math.max(1, options?.maxResultCount ?? 20)
  );
  const res = await fetch(`${PLACES_BASE}:searchNearby`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': getApiKey(),
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify({
      locationRestriction: {
        circle: {
          center: { latitude, longitude },
          radius: radiusMeters,
        },
      },
      maxResultCount,
      ...(includedTypes.length > 0 ? { includedTypes } : {}),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Places API error: ${res.status} ${err}`);
  }

  const data = (await res.json()) as { places?: PlacesApiPlace[] };
  return (data.places ?? []).map(mapPlace);
}

function normalizePlaceIdForApi(placeId: string): string {
  return placeId.startsWith('places/')
    ? placeId.replace('places/', '')
    : placeId;
}

export async function getPlaceDetails(placeId: string): Promise<Place | null> {
  const id = normalizePlaceIdForApi(placeId);
  const res = await fetch(`${PLACES_BASE}/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': getApiKey(),
      'X-Goog-FieldMask':
        'id,name,displayName,formattedAddress,location,rating,userRatingCount,primaryType,types,priceLevel',
    },
  });
  if (!res.ok) {
    if (res.status === 404) return null;
    const err = await res.text();
    throw new Error(`Places API error: ${res.status} ${err}`);
  }
  const raw = (await res.json()) as PlacesApiPlace & { name?: string };
  return mapPlace({ ...raw, name: raw.name ?? `places/${id}` });
}

export async function getPlaceDetailsBatch(
  placeIds: string[]
): Promise<(Place | null)[]> {
  const results = await Promise.all(placeIds.map((id) => getPlaceDetails(id)));
  return results;
}

export async function searchText(
  textQuery: string,
  lat?: number,
  lng?: number
): Promise<Place[]> {
  const body: Record<string, unknown> = {
    textQuery,
    maxResultCount: 20,
  };

  if (lat != null && lng != null) {
    body.locationBias = {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: 50000,
      },
    };
  }

  const res = await fetch(`${PLACES_BASE}:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': getApiKey(),
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Places API error: ${res.status} ${err}`);
  }

  const data = (await res.json()) as { places?: PlacesApiPlace[] };
  return (data.places ?? []).map(mapPlace);
}
