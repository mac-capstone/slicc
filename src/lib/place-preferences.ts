import { useMemo } from 'react';
import { create } from 'zustand';

import type { Place } from '@/api/places/places-api';

import { getItem, setItem } from './storage';
import { createSelectors } from './utils';

const PLACE_PREFERENCES_KEY = 'place_preferences';

export type PlaceRating = 'up' | 'down' | 'neutral';

type PlacePreferencesData = {
  placeRatings: Record<string, PlaceRating>;
  placeDetails: Record<string, Place>;
};

function loadPreferences(): PlacePreferencesData {
  const saved = getItem<PlacePreferencesData>(PLACE_PREFERENCES_KEY);
  return saved ?? { placeRatings: {}, placeDetails: {} };
}

function savePreferences(data: PlacePreferencesData): void {
  setItem(PLACE_PREFERENCES_KEY, data);
}

interface PlacePreferencesState extends PlacePreferencesData {
  setPlaceRating: (placeId: string, rating: PlaceRating, place?: Place) => void;
  clearPlaceRating: (placeId: string) => void;
  getPlaceRating: (placeId: string) => PlaceRating | undefined;
  getLikedPlaces: () => Place[];
  hydrate: () => void;
}

const _usePlacePreferences = create<PlacePreferencesState>((set, get) => ({
  placeRatings: {},
  placeDetails: {},

  hydrate: () => {
    const loaded = loadPreferences();
    set({
      placeRatings: loaded.placeRatings,
      placeDetails: loaded.placeDetails,
    });
  },

  setPlaceRating: (placeId, rating, place) => {
    const { placeRatings, placeDetails } = get();
    const nextRatings = { ...placeRatings, [placeId]: rating };

    let nextDetails = { ...placeDetails };
    if (place) {
      if (rating === 'up') {
        nextDetails = { ...nextDetails, [placeId]: place };
      } else if (rating === 'neutral' || rating === 'down') {
        const { [placeId]: _, ...rest } = nextDetails;
        nextDetails = rest;
      }
    }

    set({ placeRatings: nextRatings, placeDetails: nextDetails });
    savePreferences({
      placeRatings: nextRatings,
      placeDetails: nextDetails,
    });
  },

  clearPlaceRating: (placeId) => {
    const { placeRatings, placeDetails } = get();
    const { [placeId]: _, ...nextRatings } = placeRatings;
    const { [placeId]: __, ...nextDetails } = placeDetails;
    set({ placeRatings: nextRatings, placeDetails: nextDetails });
    savePreferences({
      placeRatings: nextRatings,
      placeDetails: nextDetails,
    });
  },

  getPlaceRating: (placeId) => get().placeRatings[placeId],

  getLikedPlaces: () => {
    const { placeRatings, placeDetails } = get();
    return Object.keys(placeRatings)
      .filter((id) => placeRatings[id] === 'up')
      .map((id) => placeDetails[id])
      .filter((p): p is Place => p != null);
  },
}));

export const usePlacePreferences = createSelectors(_usePlacePreferences);

export const hydratePlacePreferences = () =>
  _usePlacePreferences.getState().hydrate();
export const setPlaceRating = (
  placeId: string,
  rating: PlaceRating,
  place?: Place
) => _usePlacePreferences.getState().setPlaceRating(placeId, rating, place);
export const clearPlaceRating = (placeId: string) =>
  _usePlacePreferences.getState().clearPlaceRating(placeId);
export const getPlaceRating = (placeId: string) =>
  _usePlacePreferences.getState().getPlaceRating(placeId);
export const getLikedPlaces = () =>
  _usePlacePreferences.getState().getLikedPlaces();

export function useLikedPlaces(): Place[] {
  const placeRatings = usePlacePreferences.use.placeRatings();
  const placeDetails = usePlacePreferences.use.placeDetails();
  return useMemo(
    () =>
      Object.keys(placeRatings)
        .filter((id) => placeRatings[id] === 'up')
        .map((id) => placeDetails[id])
        .filter((p): p is Place => p != null),
    [placeRatings, placeDetails]
  );
}

export function useRatedPlaceIds(): Set<string> {
  const placeRatings = usePlacePreferences.use.placeRatings();
  return useMemo(() => new Set(Object.keys(placeRatings)), [placeRatings]);
}
