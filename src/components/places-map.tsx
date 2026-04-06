import React, { useEffect, useRef } from 'react';
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
  onPlacePress?: (place: Place) => void;
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

export function PlacesMap({
  places,
  userLocation,
  onPlacePress,
}: Props): React.ReactElement {
  const mapRef = useRef<MapView>(null);
  const isWeb = Platform.OS === 'web';

  const placesWithLocation = places.filter(
    (p): p is Place & { location: NonNullable<Place['location']> } =>
      !!p.location
  );

  useEffect(() => {
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

    if (coordinates.length < 2) return;

    mapRef.current.fitToCoordinates(coordinates, {
      edgePadding: { top: 80, right: 40, bottom: 80, left: 40 },
      animated: true,
    });
  }, [isWeb, placesWithLocation, userLocation]);

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
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={initialRegion}
        // Avoid showsUserLocation on Fabric: native dispatches topUserLocationChange
        // but RN has no handler → crash. We draw the user with a Marker instead.
        showsUserLocation={false}
        showsMyLocationButton={false}
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
        {placesWithLocation.map((place) => (
          <Marker
            key={place.id}
            coordinate={{
              latitude: place.location!.latitude,
              longitude: place.location!.longitude,
            }}
            title={place.displayName}
            description={place.formattedAddress}
            pinColor={colors.accent[100]}
            onCalloutPress={() => onPlacePress?.(place)}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
