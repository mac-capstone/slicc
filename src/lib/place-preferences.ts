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
  bookmarks: Record<string, true>;
  bookmarkDetails: Record<string, Place>;
};

function loadPreferences(): PlacePreferencesData {
  const saved = getItem<PlacePreferencesData>(PLACE_PREFERENCES_KEY);
  return {
    placeRatings: saved?.placeRatings ?? {},
    placeDetails: saved?.placeDetails ?? {},
    bookmarks: saved?.bookmarks ?? {},
    bookmarkDetails: saved?.bookmarkDetails ?? {},
  };
}

function savePreferences(data: PlacePreferencesData): void {
  setItem(PLACE_PREFERENCES_KEY, data);
}

interface PlacePreferencesState extends PlacePreferencesData {
  setPlaceRating: (placeId: string, rating: PlaceRating, place?: Place) => void;
  clearPlaceRating: (placeId: string) => void;
  getPlaceRating: (placeId: string) => PlaceRating | undefined;
  getLikedPlaces: () => Place[];
  toggleBookmark: (placeId: string, place?: Place) => void;
  getBookmarkedPlaces: () => Place[];
  hydrate: () => void;
}

const _usePlacePreferences = create<PlacePreferencesState>((set, get) => ({
  placeRatings: {},
  placeDetails: {},
  bookmarks: {},
  bookmarkDetails: {},

  hydrate: () => {
    const loaded = loadPreferences();
    set({
      placeRatings: loaded.placeRatings,
      placeDetails: loaded.placeDetails,
      bookmarks: loaded.bookmarks,
      bookmarkDetails: loaded.bookmarkDetails,
    });
  },

  setPlaceRating: (placeId, rating, place) => {
    const { placeRatings, placeDetails, bookmarks, bookmarkDetails } = get();
    const nextRatings = { ...placeRatings, [placeId]: rating };

    let nextDetails = { ...placeDetails };
    if (place) {
      nextDetails = { ...nextDetails, [placeId]: place };
    }

    const next: PlacePreferencesData = {
      placeRatings: nextRatings,
      placeDetails: nextDetails,
      bookmarks,
      bookmarkDetails,
    };
    set(next);
    savePreferences(next);
  },

  clearPlaceRating: (placeId) => {
    const { placeRatings, placeDetails, bookmarks, bookmarkDetails } = get();
    const { [placeId]: _, ...nextRatings } = placeRatings;
    const { [placeId]: __, ...nextDetails } = placeDetails;
    const next: PlacePreferencesData = {
      placeRatings: nextRatings,
      placeDetails: nextDetails,
      bookmarks,
      bookmarkDetails,
    };
    set(next);
    savePreferences(next);
  },

  getPlaceRating: (placeId) => get().placeRatings[placeId],

  getLikedPlaces: () => {
    const { placeRatings, placeDetails } = get();
    return Object.keys(placeRatings)
      .filter((id) => placeRatings[id] === 'up')
      .map((id) => placeDetails[id])
      .filter((p): p is Place => p != null);
  },

  toggleBookmark: (placeId, place) => {
    const { placeRatings, placeDetails, bookmarks, bookmarkDetails } = get();
    const isCurrentlyBookmarked = !!bookmarks[placeId];

    let nextBookmarks: Record<string, true>;
    let nextBookmarkDetails: Record<string, Place>;

    if (isCurrentlyBookmarked) {
      const { [placeId]: _, ...rest } = bookmarks;
      const { [placeId]: __, ...restDetails } = bookmarkDetails;
      nextBookmarks = rest;
      nextBookmarkDetails = restDetails;
    } else {
      nextBookmarks = { ...bookmarks, [placeId]: true };
      nextBookmarkDetails = place
        ? { ...bookmarkDetails, [placeId]: place }
        : bookmarkDetails;
    }

    const next: PlacePreferencesData = {
      placeRatings,
      placeDetails,
      bookmarks: nextBookmarks,
      bookmarkDetails: nextBookmarkDetails,
    };
    set(next);
    savePreferences(next);
  },

  getBookmarkedPlaces: () => {
    const { bookmarks, bookmarkDetails } = get();
    return Object.keys(bookmarks)
      .map((id) => bookmarkDetails[id])
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
export const toggleBookmark = (placeId: string, place?: Place) =>
  _usePlacePreferences.getState().toggleBookmark(placeId, place);
export const getBookmarkedPlaces = () =>
  _usePlacePreferences.getState().getBookmarkedPlaces();

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

export function useBookmarkedPlaces(): Place[] {
  const bookmarks = usePlacePreferences.use.bookmarks();
  const bookmarkDetails = usePlacePreferences.use.bookmarkDetails();
  return useMemo(
    () =>
      Object.keys(bookmarks)
        .map((id) => bookmarkDetails[id])
        .filter((p): p is Place => p != null),
    [bookmarks, bookmarkDetails]
  );
}

export function useRatedPlaceIds(): Set<string> {
  const placeRatings = usePlacePreferences.use.placeRatings();
  return useMemo(() => new Set(Object.keys(placeRatings)), [placeRatings]);
}

export type RatedPlacesByCategory = {
  liked: Place[];
  okay: Place[];
  disliked: Place[];
};

export function useRatedPlacesByCategory(): RatedPlacesByCategory {
  const placeRatings = usePlacePreferences.use.placeRatings();
  const placeDetails = usePlacePreferences.use.placeDetails();

  return useMemo(() => {
    const liked: Place[] = [];
    const okay: Place[] = [];
    const disliked: Place[] = [];

    for (const [id, rating] of Object.entries(placeRatings)) {
      const place = placeDetails[id];
      if (!place) continue;
      if (rating === 'up') liked.push(place);
      else if (rating === 'neutral') okay.push(place);
      else if (rating === 'down') disliked.push(place);
    }

    return { liked, okay, disliked };
  }, [placeRatings, placeDetails]);
}
