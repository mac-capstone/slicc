import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import type { Place } from '@/api/places/places-api';
import { colors, Text as UIText } from '@/components/ui';
import { DEFAULT_LOCATION } from '@/lib/geo';

type UserLocation = {
  latitude: number;
  longitude: number;
};

type Props = {
  places: Place[];
  userLocation: UserLocation | null;
  highlightedPlaceId?: string | null;
  onMarkerPress?: (place: Place) => void;
};

export type PlacesMapHandle = {
  fitAllMarkers: () => void;
};

const DEFAULT_DELTA = { latitudeDelta: 0.05, longitudeDelta: 0.05 };

function PlacesMapWebFallback(): React.ReactElement {
  return (
    <View style={[styles.container, styles.placeholder]}>
      <UIText className="text-center" style={{ color: colors.text[800] }}>
        Map view is not available on web. Use the mobile app to see places on a
        map.
      </UIText>
    </View>
  );
}

export const PlacesMap = React.forwardRef<PlacesMapHandle, Props>(
  function PlacesMap(
    { places, userLocation, highlightedPlaceId, onMarkerPress },
    ref
  ) {
    const mapRef = useRef<MapView>(null);
    const mapReadyRef = useRef(false);
    const isWeb = Platform.OS === 'web';
    const [pressedId, setPressedId] = useState<string | null>(null);

    const activeHighlight = pressedId ?? highlightedPlaceId ?? null;

    useEffect(() => {
      setPressedId(null);
    }, [highlightedPlaceId]);

    const handleMarkerPress = useCallback(
      (place: Place) => {
        setPressedId(place.id);
        onMarkerPress?.(place);
      },
      [onMarkerPress]
    );

    const placesWithLocation = useMemo(
      () =>
        places.filter(
          (p): p is Place & { location: NonNullable<Place['location']> } =>
            !!p.location
        ),
      [places]
    );

    const fitMap = React.useCallback(() => {
      if (isWeb || !mapRef.current) return;

      const coordinates = placesWithLocation.map((p) => ({
        latitude: p.location!.latitude,
        longitude: p.location!.longitude,
      }));

      if (userLocation) {
        coordinates.push({
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
        });
      }

      if (coordinates.length === 0) return;

      if (coordinates.length === 1) {
        mapRef.current.animateToRegion(
          {
            latitude: coordinates[0].latitude,
            longitude: coordinates[0].longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          },
          300
        );
        return;
      }

      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 60, right: 30, bottom: 60, left: 30 },
        animated: true,
      });
    }, [isWeb, placesWithLocation, userLocation]);

    useImperativeHandle(ref, () => ({ fitAllMarkers: fitMap }), [fitMap]);

    const handleMapReady = React.useCallback(() => {
      mapReadyRef.current = true;
      fitMap();
    }, [fitMap]);

    useEffect(() => {
      if (!mapReadyRef.current) return;
      fitMap();
    }, [placesWithLocation, userLocation, fitMap]);

    if (isWeb) {
      return <PlacesMapWebFallback />;
    }

    const initialRegion = {
      latitude: userLocation?.latitude ?? DEFAULT_LOCATION.latitude,
      longitude: userLocation?.longitude ?? DEFAULT_LOCATION.longitude,
      ...DEFAULT_DELTA,
    };

    return (
      <View style={styles.container}>
        <View style={styles.mapWrapper}>
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            initialRegion={initialRegion}
            onMapReady={handleMapReady}
            showsUserLocation={false}
            showsMyLocationButton={false}
            toolbarEnabled={false}
            mapType="standard"
            customMapStyle={Platform.OS !== 'web' ? darkMapStyle : undefined}
            loadingEnabled
            loadingIndicatorColor={colors.accent[100]}
            loadingBackgroundColor={colors.neutral[900]}
          >
            {userLocation ? (
              <Marker
                key="__user_location__"
                coordinate={userLocation}
                title="You"
                pinColor={colors.avatar.blue}
              />
            ) : null}
            {placesWithLocation.map((place) => {
              const isHighlighted = place.id === activeHighlight;
              return (
                <Marker
                  key={`${place.id}-${isHighlighted}`}
                  coordinate={{
                    latitude: place.location!.latitude,
                    longitude: place.location!.longitude,
                  }}
                  pinColor={isHighlighted ? colors.accent[100] : colors.black}
                  zIndex={isHighlighted ? 999 : undefined}
                  onPress={() => handleMarkerPress(place)}
                />
              );
            })}
          </MapView>
        </View>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  mapWrapper: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.neutral[700],
    overflow: 'hidden',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
});

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#242424' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#242424' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#d59563' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#d59563' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#263c3f' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#6b9a76' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#38414e' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#212a37' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#9ca5b3' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#746855' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1f2835' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#f3d19c' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#2f3948' }],
  },
  {
    featureType: 'transit.station',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#d59563' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#17263c' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#515c6d' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#17263c' }],
  },
];
