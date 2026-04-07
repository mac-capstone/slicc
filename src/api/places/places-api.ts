import { Env } from '@env';
import { v4 as uuidv4 } from 'uuid';

const PLACES_BASE = 'https://places.googleapis.com/v1/places';
const FIELD_MASK =
  'places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.name,places.primaryType,places.types,places.priceLevel,places.regularOpeningHours';

export type PriceLevel =
  | 'FREE'
  | 'INEXPENSIVE'
  | 'MODERATE'
  | 'EXPENSIVE'
  | 'VERY_EXPENSIVE';

type PlaceLocation = {
  latitude: number;
  longitude: number;
};

type PlaceDisplayName = {
  text?: string;
};

export type PlaceOpeningHours = {
  openNow?: boolean;
  weekdayDescriptions?: string[];
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
  nationalPhoneNumber?: string;
  regularOpeningHours?: PlaceOpeningHours;
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
  /** API may return `MODERATE` or `PRICE_LEVEL_MODERATE` */
  priceLevel?: string;
  nationalPhoneNumber?: string;
  regularOpeningHours?: { openNow?: boolean; weekdayDescriptions?: string[] };
};

function normalizePriceLevel(raw: unknown): PriceLevel | undefined {
  if (typeof raw !== 'string') return undefined;
  const key = raw.replace(/^PRICE_LEVEL_/, '');
  if (
    key === 'FREE' ||
    key === 'INEXPENSIVE' ||
    key === 'MODERATE' ||
    key === 'EXPENSIVE' ||
    key === 'VERY_EXPENSIVE'
  ) {
    return key as PriceLevel;
  }
  return undefined;
}

/** Key / billing / permission issues — UI can show a single friendly message */
export const PLACES_API_CONFIG_ERROR_CODE = 'config' as const;

export class PlacesApiError extends Error {
  readonly statusCode: number;
  readonly code: typeof PLACES_API_CONFIG_ERROR_CODE | 'unknown';

  constructor(
    message: string,
    statusCode: number,
    code: typeof PLACES_API_CONFIG_ERROR_CODE | 'unknown'
  ) {
    super(message);
    this.name = 'PlacesApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function isPlacesApiConfigError(error: unknown): boolean {
  return (
    error instanceof PlacesApiError &&
    error.code === PLACES_API_CONFIG_ERROR_CODE
  );
}

async function handlePlacesHttpError(res: Response): Promise<never> {
  const status = res.status;
  if (status === 401 || status === 403) {
    await res.text().catch(() => '');
    throw new PlacesApiError(
      'Your Google Places API key is invalid or restricted.',
      status,
      'config'
    );
  }
  const err = await res.text();
  const snippet = err.length > 200 ? `${err.slice(0, 200)}…` : err;
  throw new Error(`Places API error: ${status} ${snippet}`);
}

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
    priceLevel: normalizePriceLevel(raw.priceLevel),
    nationalPhoneNumber: raw.nationalPhoneNumber,
    regularOpeningHours: raw.regularOpeningHours,
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
    await handlePlacesHttpError(res);
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
    await handlePlacesHttpError(res);
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
        'id,name,displayName,formattedAddress,location,rating,userRatingCount,primaryType,types,priceLevel,nationalPhoneNumber,regularOpeningHours',
    },
  });
  if (!res.ok) {
    if (res.status === 404) return null;
    await handlePlacesHttpError(res);
  }
  const raw = (await res.json()) as PlacesApiPlace & { name?: string };
  return mapPlace({ ...raw, name: raw.name ?? `places/${id}` });
}

export async function getPlaceDetailsBatch(
  placeIds: string[]
): Promise<(Place | null)[]> {
  const settled = await Promise.allSettled(
    placeIds.map((id) => getPlaceDetails(id))
  );
  return settled.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    console.warn('[places-api] getPlaceDetailsBatch rejected', {
      placeId: placeIds[index],
      reason: result.reason,
    });
    return null;
  });
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
    await handlePlacesHttpError(res);
  }

  const data = (await res.json()) as { places?: PlacesApiPlace[] };
  return (data.places ?? []).map(mapPlace);
}
