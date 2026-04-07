import React from 'react';

import type { Place } from '@/api/places/places-api';
import { PlaceDetailAddressMaps } from '@/components/place-detail-address-maps';
import { PlaceDetailHoursRow } from '@/components/place-detail-hours-row';
import { PlaceDetailPhoneBlock } from '@/components/place-detail-phone-block';
import { View } from '@/components/ui';

type Props = {
  place: Place;
};

export function PlaceDetailInfoCard({ place }: Props): React.ReactElement {
  return (
    <View className="mb-4 rounded-2xl bg-neutral-850 p-5">
      <PlaceDetailAddressMaps place={place} />
      <PlaceDetailHoursRow
        weekdayDescriptions={place.regularOpeningHours?.weekdayDescriptions}
      />
      <PlaceDetailPhoneBlock place={place} />
    </View>
  );
}
