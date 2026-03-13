import { Env } from '@env';
import React from 'react';

import { Item } from '@/components/settings/item';
import { ItemsContainer } from '@/components/settings/items-container';
import { LanguageItem } from '@/components/settings/language-item';
import { TaxItem } from '@/components/settings/tax-item';
import { ThemeItem } from '@/components/settings/theme-item';
import { FocusAwareStatusBar, ScrollView, View } from '@/components/ui';
import { useAuth } from '@/lib';

export default function Settings() {
  const signOut = useAuth.use.signOut();
  return (
    <>
      <FocusAwareStatusBar />

      <ScrollView>
        <View className="flex-1 px-4">
          <ItemsContainer title="settings.generale">
            <LanguageItem />
            <ThemeItem />
            <TaxItem />
          </ItemsContainer>

          <ItemsContainer title="settings.about">
            <Item text="settings.app_name" value={Env.NAME} />
            <Item text="settings.version" value={Env.VERSION} />
          </ItemsContainer>

          <ItemsContainer title="settings.support_us">
            <Item text="settings.share" onPress={() => {}} />
            <Item text="settings.rate" onPress={() => {}} />
            <Item text="settings.support" onPress={() => {}} />
          </ItemsContainer>

          <ItemsContainer title="settings.links">
            <Item text="settings.privacy" onPress={() => {}} />
            <Item text="settings.terms" onPress={() => {}} />
          </ItemsContainer>

          <View className="my-8">
            <ItemsContainer>
              <Item text="settings.logout" onPress={signOut} />
            </ItemsContainer>
          </View>
        </View>
      </ScrollView>
    </>
  );
}
