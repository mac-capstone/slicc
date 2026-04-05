import 'react-native-get-random-values';

import Ionicons from '@expo/vector-icons/Ionicons';
import Octicons from '@expo/vector-icons/Octicons';
import { FlashList } from '@shopify/flash-list';
import { router, Stack, useLocalSearchParams, usePathname } from 'expo-router';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ActivityIndicator, Alert, BackHandler, Modal } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useMMKVBoolean } from 'react-native-mmkv';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { v4 as uuidv4 } from 'uuid';

import { useEvent } from '@/api/events/use-events';
import { useExpense } from '@/api/expenses/use-expenses';
import { useUser, useUsersAsPeople } from '@/api/people/use-users';
import ExpenseCreationFooter from '@/components/expense-creation-footer';
import {
  Button,
  colors,
  Input,
  Pressable,
  Select,
  Text,
  View,
} from '@/components/ui';
import { useAuth, useDefaultTaxRate, useUserSettings } from '@/lib';
import {
  resolveDefaultTaxRate,
  resolveDefaultTipRate,
} from '@/lib/resolve-user-default-rates';
import { storage } from '@/lib/storage';
import {
  clearTempExpense,
  initializeFromExistingExpense,
  useExpenseCreation,
} from '@/lib/store';
import {
  normalizeStoredTipPercent,
  TIP_PERCENT_OPTIONS,
  TIP_PERCENT_SELECT_OPTIONS,
  type TipPercentOption,
} from '@/lib/tip-percent-options';
import { useThemeConfig } from '@/lib/use-theme-config';
import {
  type EventIdT,
  type ExpenseIdT,
  type ItemIdT,
  type ItemWithId,
  type PersonWithId,
  type UserIdT,
} from '@/types';

const SWIPE_NUDGE_SHOWN_KEY = 'swipe-nudge-shown';

/** Strips anything that isn't a digit or decimal point, and prevents multiple decimals. */
const sanitizeNumeric = (text: string): string => {
  // Remove everything except digits and '.'
  let cleaned = text.replace(/[^0-9.]/g, '');
  // Allow only the first decimal point
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    cleaned = parts[0] + '.' + parts.slice(1).join('');
  }
  return cleaned;
};

type PayerOption = {
  label: string;
  value: string;
};

function useMainPayerOptions({
  eventId,
  tempPeople,
  userId,
  signedInUserName,
  currentPayerId,
  setPayerUserId,
}: {
  eventId?: EventIdT;
  tempPeople: { id: string; name?: string }[];
  userId: string | null;
  signedInUserName?: string;
  currentPayerId?: string;
  setPayerUserId: (payerUserId: string) => void;
}) {
  const eventQuery = useEvent({
    variables: eventId,
    enabled: Boolean(eventId),
  });
  const participantUserIds = eventQuery.data?.participants ?? [];
  const avatarColors = useMemo(() => Object.keys(colors.avatar ?? {}), []);
  const { people: eventParticipants } = useUsersAsPeople(
    participantUserIds as UserIdT[],
    avatarColors
  );

  const payerOptions = useMemo<PayerOption[]>(() => {
    if (eventId) {
      return eventParticipants.map((participant) => ({
        label: participant.name ?? 'Unnamed person',
        value: participant.id,
      }));
    }

    const options = tempPeople.map((person) => ({
      label: person.name ?? 'Unnamed person',
      value: person.id,
    }));

    if (userId && signedInUserName) {
      const isAlreadyPresent = options.some(
        (option) => option.value === userId
      );
      if (!isAlreadyPresent) {
        options.unshift({
          label: signedInUserName,
          value: userId,
        });
      }
    }

    return options;
  }, [eventId, eventParticipants, signedInUserName, tempPeople, userId]);

  useEffect(() => {
    if (!eventId || payerOptions.length === 0) {
      return;
    }

    const hasSelectedPayer = payerOptions.some(
      (option) => option.value === currentPayerId
    );
    if (!hasSelectedPayer) {
      setPayerUserId(payerOptions[0].value);
    }
  }, [currentPayerId, eventId, payerOptions, setPayerUserId]);

  useEffect(() => {
    if (eventId || !userId) return;
    if (currentPayerId !== userId) {
      setPayerUserId(userId);
    }
  }, [currentPayerId, eventId, setPayerUserId, userId]);

  return payerOptions;
}

export default function AddExpense() {
  const theme = useThemeConfig();
  const userId = useAuth.use.userId();
  const { eventId, expenseId } = useLocalSearchParams<{
    eventId?: EventIdT;
    expenseId?: string;
  }>();
  const isEditMode = !!expenseId;

  // Fetch existing expense data when editing
  const { data: existingExpenseData } = useExpense({
    variables: expenseId as ExpenseIdT,
    enabled: isEditMode,
  });
  const pathname = usePathname();
  const tempExpense = useExpenseCreation.use.tempExpense();
  const [expenseName, setExpenseName] = useState<string>('');
  const prevItemsCountRef = React.useRef<number>(0);
  const firstItemNudgeTriggerRef = React.useRef<(() => void) | null>(null);

  const {
    setExpenseName: setExpenseNameInStore,
    setPayerUserId,
    getTotalAmount,
    initializeTempExpense,
    hydrate,
    removeItem,
    addItem,
    updateItem,
  } = useExpenseCreation();
  const addPerson = useExpenseCreation.use.addPerson();
  const avatarColors = useMemo(() => Object.keys(colors.avatar ?? {}), []);

  const viewerUserId = userId ?? null;
  const { data: signedInUser } = useUser({
    variables: { userId: userId as UserIdT, viewerUserId },
    enabled: Boolean(userId),
  });
  const { defaultTipPercent } = useUserSettings();

  const currentPayerId = tempExpense?.payerUserId;
  const resolvedDefaultTipRate = resolveDefaultTipRate(
    signedInUser,
    defaultTipPercent
  );

  const payerOptions = useMainPayerOptions({
    eventId,
    tempPeople: tempExpense?.people ?? [],
    userId,
    signedInUserName: signedInUser?.displayName,
    currentPayerId,
    setPayerUserId,
  });

  // Track items count and trigger nudge when adding first item (list length goes from 0 to 1)
  useEffect(() => {
    const currentCount = tempExpense?.items?.length || 0;
    const prevCount = prevItemsCountRef.current;

    if (prevCount === 0 && currentCount === 1) {
      // First item added, trigger animation on first item
      setTimeout(() => {
        firstItemNudgeTriggerRef.current?.();
      }, 300);
    }

    prevItemsCountRef.current = currentCount;
  }, [tempExpense?.items?.length]);

  const performLeave = useCallback(() => {
    router.replace('/');
    clearTempExpense();
    setExpenseName('');
  }, [setExpenseName]);

  const handleLeave = useCallback(() => {
    if (tempExpense?.items?.length && tempExpense.items.length > 0) {
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. Are you sure you want to leave?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Leave', onPress: performLeave },
        ]
      );
      return true;
    }
    performLeave();
    return true;
  }, [tempExpense, performLeave]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (isEditMode) {
      const alreadyLoaded =
        tempExpense?.originalExpenseId === (expenseId as ExpenseIdT);

      if (!alreadyLoaded && existingExpenseData) {
        // If the user has an in-progress new-expense draft, warn before overwriting
        const hasDraft =
          tempExpense &&
          !tempExpense.originalExpenseId &&
          (tempExpense.items?.length ?? 0) > 0;

        if (hasDraft) {
          Alert.alert(
            'Discard Draft?',
            'You have an unsaved expense in progress. Starting an edit will discard it.',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => router.back() },
              {
                text: 'Discard & Edit',
                style: 'destructive',
                onPress: () => {
                  initializeFromExistingExpense(existingExpenseData);
                  setExpenseName(existingExpenseData.name);
                },
              },
            ]
          );
        } else {
          // First load: initialise store from Firestore data and sync name input
          initializeFromExistingExpense(existingExpenseData);
          setExpenseName(existingExpenseData.name);
        }
      } else if (alreadyLoaded && expenseName === '') {
        // Store already hydrated from MMKV but name input is still empty — sync it
        setExpenseName(tempExpense!.name);
      }
    } else {
      if (userId && (!tempExpense || tempExpense.originalExpenseId)) {
        initializeTempExpense(userId);
      }
    }
  }, [
    userId,
    tempExpense,
    initializeTempExpense,
    isEditMode,
    existingExpenseData,
    expenseId,
    expenseName,
  ]);

  // For standalone (non-event) expenses, auto-add the signed-in user as a person
  // so they appear in the split view as the default payer.
  const hasAddedSelfRef = useRef(false);
  useEffect(() => {
    if (eventId) return;
    if (!tempExpense || !userId || !signedInUser?.displayName) return;
    if (hasAddedSelfRef.current) return;
    const alreadyAdded = tempExpense.people.some((p) => p.id === userId);
    if (!alreadyAdded) {
      const color =
        avatarColors[Math.floor(Math.random() * avatarColors.length)] ??
        'white';
      addPerson({
        id: userId as UserIdT,
        name: signedInUser.displayName,
        color,
        userRef: userId,
        subtotal: 0,
        paid: 0,
      } as PersonWithId);
    }
    hasAddedSelfRef.current = true;
  }, [
    eventId,
    userId,
    signedInUser?.displayName,
    tempExpense,
    addPerson,
    avatarColors,
  ]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (pathname === '/expense/add-expense') {
          handleLeave();
        } else {
          router.back();
        }
        return true;
      }
    );
    return () => backHandler.remove();
  }, [handleLeave, pathname]);

  if (!tempExpense) {
    return (
      <>
        <Stack.Screen
          options={{
            title: '',
            headerShadowVisible: false,
            headerTitleStyle: {
              fontSize: 24,
              fontWeight: 'bold',
            },
            headerLeft: () => (
              <Pressable onPress={() => router.replace('/')}>
                <Octicons
                  name="x"
                  color={theme.dark ? 'white' : 'black'}
                  size={24}
                />
              </Pressable>
            ),
          }}
        />
        <View className="flex-1 justify-center p-3">
          <ActivityIndicator />
        </View>
      </>
    );
  }

  const existingTip = tempExpense?.items?.find((item) => item.isTip);

  return (
    <>
      <Stack.Screen
        options={{
          title: '',
          headerShadowVisible: false,
          headerTitleStyle: {
            fontSize: 24,
            fontWeight: 'bold',
          },
          headerLeft: () => (
            <Pressable onPress={handleLeave}>
              <Octicons
                className="mr-2"
                name="x"
                color={theme.dark ? 'white' : 'black'}
                size={24}
              />
            </Pressable>
          ),
        }}
      />
      <View className="flex-1 px-4">
        <Text className="font-futuraBold text-4xl dark:text-text-50">
          {isEditMode ? 'Edit Expense' : 'Create an expense'}
        </Text>
        <View className="pb-2 pt-5">
          <Input
            placeholder="Enter Expense Name"
            inputClassName="py-4 text-lg"
            value={expenseName}
            onChangeText={(text) => {
              setExpenseName(text);
              setExpenseNameInStore(text);
            }}
          />
        </View>
        {eventId ? (
          <View className="pb-2">
            <Text className="!dark:text-text-200 pb-2 text-base font-semibold">
              Expense Owner
            </Text>
            <Select
              value={currentPayerId}
              placeholder="Select who paid all or most of the expense"
              options={payerOptions}
              onSelect={(value) => {
                if (typeof value === 'string') {
                  setPayerUserId(value);
                }
              }}
            />
          </View>
        ) : null}
        <View className="flex-1 flex-col gap-4">
          <FlashList
            data={tempExpense?.items || []}
            renderItem={({ item, index }) => (
              <TempItemCard
                item={item}
                onDelete={removeItem}
                onUpdate={updateItem}
                isFirstItem={index === 0}
                nudgeTriggerRef={
                  index === 0 ? firstItemNudgeTriggerRef : undefined
                }
              />
            )}
            keyExtractor={(item) => item.id}
            drawDistance={500}
            ListFooterComponent={
              <View className="pt-2">
                <CreateItemCard />
                <AddTipButton
                  existingTip={existingTip}
                  totalAmount={getTotalAmount()}
                  addItem={addItem}
                  removeItem={removeItem}
                  defaultTipRate={resolvedDefaultTipRate}
                />
              </View>
            }
            ItemSeparatorComponent={() => <View className="h-5" />}
          />
        </View>
      </View>
      <View className="px-4 pb-3">
        <Button
          className="min-h-12"
          label="Scan Receipt"
          icon={<Ionicons name="scan-outline" size={20} />}
          onPress={() => router.push('/reciept-camera')}
        />
      </View>
      <ExpenseCreationFooter
        nextDisabled={getTotalAmount() === 0 || expenseName === ''}
        onNextPress={() => {
          setExpenseNameInStore(expenseName);
          router.push(
            eventId
              ? `/expense/split-expense?eventId=${eventId}`
              : '/expense/split-expense'
          );
        }}
        totalAmount={getTotalAmount()}
        hasPrevious={false}
      />
    </>
  );
}

const TempItemCard = React.memo(function TempItemCard({
  item,
  onDelete,
  onUpdate,
  isFirstItem = false,
  nudgeTriggerRef,
}: {
  item: ItemWithId;
  onDelete: (itemId: ItemIdT) => void;
  onUpdate: (itemId: ItemIdT, updates: Partial<ItemWithId>) => void;
  isFirstItem?: boolean;
  nudgeTriggerRef?: ReturnType<typeof React.useRef<(() => void) | null>>;
}) {
  const swipe_threshold = 80;
  const delete_button_width = 80;
  const translateX = useSharedValue(0);
  const [hasShownNudge, setHasShownNudge] = useMMKVBoolean(
    SWIPE_NUDGE_SHOWN_KEY,
    storage
  );

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editTax, setEditTax] = useState('');

  const handleDelete = useCallback(() => {
    if (!item) return;
    onDelete(item.id);
  }, [item, onDelete]);

  const handleEditPress = useCallback(() => {
    // Recover base amount from stored total-with-tax
    const taxRate = item.taxRate ?? 0;
    const base = taxRate > 0 ? item.amount / (1 + taxRate / 100) : item.amount;
    setEditName(item.isTip ? '' : item.name);
    setEditAmount(base.toFixed(2));
    setEditTax(taxRate > 0 ? taxRate.toString() : '');
    translateX.value = withSpring(0);
    setIsEditing(true);
  }, [item, translateX]);

  const handleSave = useCallback(() => {
    const base = parseFloat(editAmount) || 0;
    const tax = parseFloat(editTax) || 0;
    const total = Math.round(base * (1 + tax / 100) * 100) / 100;
    onUpdate(item.id, {
      name: editName.trim() || item.name,
      amount: total,
      taxRate: tax,
    });
    setIsEditing(false);
  }, [item, editName, editAmount, editTax, onUpdate]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  const triggerNudge = useCallback(() => {
    translateX.value = withSequence(
      withTiming(-5, { duration: 150 }), // offset to the left 5
      withDelay(170, withTiming(0, { duration: 150 }))
    );
  }, [translateX]);

  // register trigger function with ref
  useEffect(() => {
    if (isFirstItem && nudgeTriggerRef) {
      nudgeTriggerRef.current = triggerNudge;
      return () => {
        if (nudgeTriggerRef) {
          nudgeTriggerRef.current = null;
        }
      };
    }
  }, [isFirstItem, nudgeTriggerRef, triggerNudge]);

  // nudge animation when list first appears
  useEffect(() => {
    if (isFirstItem && hasShownNudge === undefined) {
      // small delay to ensure list is rendered
      const timeoutId = setTimeout(() => {
        triggerNudge();
        // mark as shown after animation completes (~600ms total)
        setTimeout(() => {
          setHasShownNudge(true);
        }, 600);
      }, 300);

      return () => clearTimeout(timeoutId);
    }
  }, [isFirstItem, hasShownNudge, triggerNudge, setHasShownNudge]);

  const panGesture = Gesture.Pan()
    .enabled(!isEditing)
    .onUpdate((e) => {
      // only allow swiping left (negative translation)
      if (e.translationX < 0) {
        translateX.value = Math.max(e.translationX, -delete_button_width);
      }
    })
    .onEnd((e) => {
      // if swiped past threshold, snap to delete button
      if (e.translationX < -swipe_threshold) {
        translateX.value = withSpring(-delete_button_width);
      } else {
        // else snap back to original position
        translateX.value = withSpring(0);
      }
    });

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  if (!item) return null;

  // Preview values for the edit form
  const editBase = parseFloat(editAmount) || 0;
  const editTaxRate = parseFloat(editTax) || 0;
  const editTotal = Math.round(editBase * (1 + editTaxRate / 100) * 100) / 100;

  if (isEditing) {
    return (
      <View className="flex flex-col gap-2 rounded-xl bg-background-900 p-4">
        <Input
          placeholder="Item name"
          value={editName}
          onChangeText={setEditName}
          containerClassName="mb-0"
        />
        <View className="flex flex-row items-center gap-2">
          <Text className="pb-2 text-base font-bold text-neutral-400">$</Text>
          <Input
            placeholder="Amount"
            keyboardType="decimal-pad"
            containerClassName="mb-0 flex-1"
            value={editAmount}
            onChangeText={(t) => setEditAmount(sanitizeNumeric(t))}
          />
          <Text className="pb-2 text-base font-bold text-neutral-400">+</Text>
          <Input
            placeholder="0"
            keyboardType="numeric"
            containerClassName="mb-0 w-16"
            inputClassName="text-center"
            value={editTax}
            onChangeText={(t) => setEditTax(sanitizeNumeric(t))}
          />
          <Text className="pb-2 text-base font-bold text-neutral-400">
            % Tax
          </Text>
        </View>
        {editBase > 0 && (
          <View className="rounded-lg bg-background-925 px-3 py-2">
            <View className="flex-row justify-between">
              <Text className="text-sm text-neutral-400">Base</Text>
              <Text className="text-sm text-neutral-400">
                ${editBase.toFixed(2)}
              </Text>
            </View>
            {editTaxRate > 0 && (
              <View className="flex-row justify-between">
                <Text className="text-sm text-neutral-400">
                  Tax ({editTaxRate}%)
                </Text>
                <Text className="text-sm text-neutral-400">
                  +${(editTotal - editBase).toFixed(2)}
                </Text>
              </View>
            )}
            <View className="mt-1 flex-row justify-between border-t border-neutral-700 pt-1">
              <Text className="text-sm font-bold dark:text-text-50">Total</Text>
              <Text className="text-sm font-bold dark:text-text-50">
                ${editTotal.toFixed(2)}
              </Text>
            </View>
          </View>
        )}
        <View className="flex-row gap-2">
          <Button
            label="Save"
            className="flex-1"
            disabled={!editName.trim() || editBase <= 0}
            onPress={handleSave}
          />
          <Button
            label="Cancel"
            variant="outline"
            className="flex-1"
            onPress={handleCancelEdit}
          />
        </View>
      </View>
    );
  }

  return (
    <View className="overflow-hidden rounded-xl">
      <View
        className="absolute right-0 h-full w-20 items-center justify-center rounded-xl bg-red-500"
        style={{ width: delete_button_width }}
      >
        <Pressable
          className="size-full items-center justify-center"
          onPress={handleDelete}
        >
          <Ionicons name="trash-outline" size={24} color="white" />
        </Pressable>
      </View>

      {/* swipeable card */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={animatedCardStyle}>
          <View className="flex flex-col rounded-xl bg-background-900 p-4">
            <View className="flex flex-row items-center justify-between">
              <Text className="flex-1 font-futuraBold text-lg dark:text-text-50">
                {item.isTip ? 'Tip' : item.name}
              </Text>
              <View className="flex-row items-center gap-3">
                <Text className="font-futuraDemi text-xl dark:text-text-50">
                  ${item.amount.toFixed(2)}
                </Text>
                {!item.isTip && (
                  <Pressable onPress={handleEditPress} hitSlop={8}>
                    <Ionicons name="pencil-outline" size={18} color="#A4A4A4" />
                  </Pressable>
                )}
              </View>
            </View>
            {!item.isTip && item.taxRate !== undefined && item.taxRate > 0 && (
              <View className="mt-1 flex flex-row justify-between">
                <Text className="text-xs text-neutral-400">
                  Tax ({item.taxRate}%) included
                </Text>
              </View>
            )}
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
});

function getItemAndAmountFromTaggedWords(taggedWords: any[]): {
  itemName: string;
  itemAmount: number;
} {
  let itemName = '';
  let itemAmount = 0;
  let index = 0;
  let start = -1;
  let end = -1;
  let lastCDIndex = -1;

  taggedWords.forEach((pair: [string, string]) => {
    if (pair[1] === '$') {
      // Price should come after dollar sign
      itemAmount = parseFloat(taggedWords[index + 1][0]);
      if (start !== -1 && end === -1) {
        end = index;
      }
    } else if (
      pair[0].toLowerCase() !== 'cost' &&
      pair[0].toLowerCase() !== 'dollar' &&
      pair[0].toLowerCase() !== 'dollars' &&
      (pair[1] === 'NN' ||
        pair[1] === 'NNS' ||
        pair[1] === 'NNP' ||
        pair[1] === 'NNPS')
    ) {
      // Noun indicates item name, set start if not set
      // also ignore "cost" and "dollar(s)" as they are not item names
      if (start === -1) {
        start = index;
      }
    } else {
      if (pair[0].toLowerCase() !== 'and') {
        // any other word indicates end of item name if start has been set
        if (start !== -1 && end === -1) {
          end = index;
        }
      } else {
        // handle "and" case
        // and must be followed by a noun or item name ends on the index of "and"
        // also must not be the last word
        if (
          index + 1 !== taggedWords.length &&
          (taggedWords[index + 1][1] === 'NN' ||
            taggedWords[index + 1][1] === 'NNS' ||
            taggedWords[index + 1][1] === 'NNP' ||
            taggedWords[index + 1][1] === 'NNPS')
        ) {
          // do nothing, continue item name
        } else {
          // bad "and" case, item name ends here
          if (start !== -1 && end === -1) {
            end = index;
          }
        }
      }
    }
    // Keep track of last CD (cardinal number) index for amount extraction
    // in the case no dollar sign is present
    // this case shouldn't happen using voice to text

    // could be adjusted in the future using multiple possible voice text possibilities,
    // picking the one with a dollar sign
    if (pair[1] === 'CD') {
      lastCDIndex = index;
    }

    index++;
  });
  if (lastCDIndex !== -1 && itemAmount === 0) {
    itemAmount = parseFloat(taggedWords[lastCDIndex][0]);
  }

  if (end === -1) {
    end = taggedWords.length;
  }
  itemName = taggedWords
    .slice(start, end)
    .map((pair: [string, string]) => pair[0])
    .join(' ');

  // Logging for debugging
  // console.log('sentence:', taggedWords);
  // console.log('itemName start index:', start);
  // console.log('itemName end index:', end);
  // console.log('Extracted Item Name:', itemName);
  // console.log('Extracted Item Amount:', itemAmount);

  return { itemName, itemAmount };
}

function CreateItemCard() {
  const userId = useAuth.use.userId();
  const viewerUserId = userId ?? null;
  const { data: signedInUser } = useUser({
    variables: { userId: userId as UserIdT, viewerUserId },
    enabled: Boolean(userId),
  });
  const { defaultTaxRate: mmkvDefaultTaxRate } = useDefaultTaxRate();
  const defaultTaxRate = resolveDefaultTaxRate(
    signedInUser,
    mmkvDefaultTaxRate
  );
  const [tempItemName, setTempItemName] = useState<string>('');
  const [tempItemAmount, setTempItemAmount] = useState<string>('');
  const [tempItemTaxStr, setTempItemTaxStr] = useState<string>('');
  const [recognizing, setRecognizing] = useState(false);
  const [hasUserEditedTax, setHasUserEditedTax] = useState(false);

  // Mirror default into the field only until the user edits; late signedInUser resolution
  // must not overwrite in-progress input.
  useEffect(() => {
    if (hasUserEditedTax) return;
    setTempItemTaxStr(defaultTaxRate > 0 ? defaultTaxRate.toString() : '');
  }, [defaultTaxRate, hasUserEditedTax]);

  const addItem = useExpenseCreation.use.addItem();

  const baseAmount = parseFloat(tempItemAmount) || 0;
  const taxRate = parseFloat(tempItemTaxStr) || 0;
  const taxAmount = baseAmount * (taxRate / 100);
  const totalWithTax = baseAmount + taxAmount;

  useSpeechRecognitionEvent('start', () => setRecognizing(true));
  useSpeechRecognitionEvent('end', () => setRecognizing(false));
  useSpeechRecognitionEvent('result', (event) => {
    const transcriptText = event.results[0]?.transcript ?? '';

    if (event.isFinal) {
      let pos = require('pos');
      let words = new pos.Lexer().lex(transcriptText);

      let tagger = new pos.Tagger();
      let taggedWords = tagger.tag(words);

      let { itemName, itemAmount } =
        getItemAndAmountFromTaggedWords(taggedWords);

      setTempItemName(itemName);
      setTempItemAmount(itemAmount > 0 ? itemAmount.toString() : '');
    }
  });
  useSpeechRecognitionEvent('error', (event) => {
    console.log('error code:', event.error, 'error message:', event.message);
  });

  const handleStartRecording = async () => {
    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!result.granted) {
      console.warn('Permissions not granted', result);
      return;
    }
    // Start speech recognition
    ExpoSpeechRecognitionModule.start({
      lang: 'en-US',
      interimResults: true,
      continuous: false,
    });
  };

  const handleAddItem = () => {
    addItem({
      id: uuidv4() as ItemIdT,
      name: tempItemName,
      amount: totalWithTax,
      taxRate: taxRate,
      isTip: false,
      split: {
        mode: 'equal',
        shares: {},
      },
      assignedPersonIds: [],
    });
    setHasUserEditedTax(false);
    setTempItemName('');
    setTempItemAmount('');
    setTempItemTaxStr(defaultTaxRate > 0 ? defaultTaxRate.toString() : '');
  };

  return (
    <View className="flex w-full flex-col gap-2 rounded-xl bg-background-925 p-4">
      <View className="flex w-full flex-row gap-2">
        <Input
          placeholder="Enter Item Name"
          containerClassName="flex-1 mb-0"
          value={tempItemName}
          onChangeText={(text) => setTempItemName(text)}
        />
        {!recognizing ? (
          <Pressable
            className="size-11 items-center justify-center rounded-2xl bg-background-900"
            onPress={handleStartRecording}
          >
            <Ionicons name="mic-outline" size={24} color="#A4A4A4" />
          </Pressable>
        ) : (
          <Pressable
            className="size-11 items-center justify-center rounded-2xl bg-background-900"
            onPress={() => {
              ExpoSpeechRecognitionModule.stop();
            }}
          >
            <Ionicons name="mic-outline" size={24} color="#c70000ff" />
          </Pressable>
        )}
      </View>
      <View className="flex flex-row items-center gap-2">
        <Text className="pb-2 text-base font-bold text-neutral-400">$</Text>
        <Input
          placeholder="Enter Item Amount"
          keyboardType="decimal-pad"
          containerClassName="mb-0 flex-1"
          value={tempItemAmount}
          onChangeText={(text) => setTempItemAmount(sanitizeNumeric(text))}
        />
        <Text className="pb-2 text-base font-bold text-neutral-400">+</Text>
        <Input
          placeholder="0"
          keyboardType="numeric"
          containerClassName="mb-0 w-16"
          inputClassName="text-center"
          value={tempItemTaxStr}
          onChangeText={(text) => {
            setHasUserEditedTax(true);
            setTempItemTaxStr(sanitizeNumeric(text));
          }}
        />
        <Text className="pb-2 text-base font-bold text-neutral-400">% Tax</Text>
      </View>

      {/* Tax breakdown display */}
      {baseAmount > 0 && (
        <View className="rounded-lg bg-background-900 px-3 py-2">
          <View className="flex-row justify-between">
            <Text className="text-sm text-neutral-400">Base Price</Text>
            <Text className="text-sm text-neutral-400">
              ${baseAmount.toFixed(2)}
            </Text>
          </View>
          {taxRate > 0 && (
            <View className="flex-row justify-between">
              <Text className="text-sm text-neutral-400">Tax ({taxRate}%)</Text>
              <Text className="text-sm text-neutral-400">
                +${taxAmount.toFixed(2)}
              </Text>
            </View>
          )}
          <View className="mt-1 border-t border-neutral-700 pt-1">
            <View className="flex-row justify-between">
              <Text className="text-sm font-bold dark:text-text-50">Total</Text>
              <Text className="text-sm font-bold dark:text-text-50">
                ${totalWithTax.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>
      )}

      <Button
        label="Add Item"
        onPress={handleAddItem}
        disabled={!tempItemName.trim() || !tempItemName || baseAmount <= 0}
      />
    </View>
  );
}

function AddTipButton({
  existingTip,
  totalAmount,
  addItem,
  removeItem,
  defaultTipRate,
}: {
  existingTip: ItemWithId | undefined;
  totalAmount: number;
  addItem: (item: ItemWithId) => void;
  removeItem: (itemId: ItemIdT) => void;
  defaultTipRate?: number;
}) {
  const { defaultTipPercent } = useUserSettings();
  const resolvedDefaultTipPercent = defaultTipRate ?? defaultTipPercent;
  const [modalVisible, setModalVisible] = useState(false);
  const [tipMode, setTipMode] = useState<'flat' | 'percentage'>('percentage');
  const [flatInput, setFlatInput] = useState('');
  const [percentValue, setPercentValue] = useState<TipPercentOption>(0);
  /** After user has a % choice this open (default seed or explicit pick), keep it when toggling modes. */
  const percentChoiceEstablishedRef = useRef(false);

  const subtotalWithoutTip = useMemo(() => {
    if (existingTip) {
      return totalAmount - existingTip.amount;
    }
    return totalAmount;
  }, [totalAmount, existingTip]);

  const calculatedTipAmount = useMemo(() => {
    if (tipMode === 'percentage') {
      return Math.round(subtotalWithoutTip * (percentValue / 100) * 100) / 100;
    }
    const val = parseFloat(flatInput) || 0;
    return Math.round(val * 100) / 100;
  }, [tipMode, subtotalWithoutTip, percentValue, flatInput]);

  const handleAddTip = () => {
    if (calculatedTipAmount <= 0) return;

    // Remove existing tip first
    if (existingTip) {
      removeItem(existingTip.id);
    }

    addItem({
      id: uuidv4() as ItemIdT,
      name: 'Tip',
      amount: calculatedTipAmount,
      isTip: true,
      split: {
        mode: 'equal',
        shares: {},
      },
      assignedPersonIds: [],
    });

    setModalVisible(false);
    setFlatInput('');
    setPercentValue(0);
    percentChoiceEstablishedRef.current = false;
  };

  const handleRemoveTip = () => {
    if (existingTip) {
      removeItem(existingTip.id);
    }
    setModalVisible(false);
  };

  return (
    <>
      <Button
        label={
          existingTip ? `Tip: $${existingTip.amount.toFixed(2)}` : 'Add Tip'
        }
        variant="outline"
        icon={<Ionicons name="cash-outline" size={18} color="#A4A4A4" />}
        onPress={() => {
          if (existingTip) {
            setTipMode('flat');
            setFlatInput(existingTip.amount.toFixed(2));
            percentChoiceEstablishedRef.current = false;
          } else {
            setTipMode('percentage');
            setFlatInput('');
            setPercentValue(
              normalizeStoredTipPercent(resolvedDefaultTipPercent)
            );
            percentChoiceEstablishedRef.current = true;
          }
          setModalVisible(true);
        }}
      />

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/50"
          onPress={() => setModalVisible(false)}
        >
          <Pressable
            className="mx-6 w-80 rounded-2xl bg-neutral-100 p-5 dark:bg-neutral-800"
            onPress={() => {}}
          >
            <Text className="mb-4 text-center text-xl font-bold dark:text-text-50">
              Add Tip
            </Text>

            {/* Tip mode toggle */}
            <View className="mb-4 flex-row overflow-hidden rounded-lg bg-neutral-200 dark:bg-neutral-700">
              <Pressable
                className={`flex-1 py-2 ${tipMode === 'flat' ? 'bg-black dark:bg-accent-100' : ''}`}
                onPress={() => {
                  setTipMode('flat');
                  setFlatInput('');
                }}
              >
                <Text
                  className={`text-center font-bold ${
                    tipMode === 'flat'
                      ? 'text-white dark:text-black'
                      : 'dark:text-text-50'
                  }`}
                >
                  Flat ($)
                </Text>
              </Pressable>
              <Pressable
                className={`flex-1 py-2 ${tipMode === 'percentage' ? 'bg-black dark:bg-accent-100' : ''}`}
                onPress={() => {
                  setTipMode('percentage');
                  if (!percentChoiceEstablishedRef.current) {
                    setPercentValue(
                      normalizeStoredTipPercent(resolvedDefaultTipPercent)
                    );
                    percentChoiceEstablishedRef.current = true;
                  }
                }}
              >
                <Text
                  className={`text-center font-bold ${
                    tipMode === 'percentage'
                      ? 'text-white dark:text-black'
                      : 'dark:text-text-50'
                  }`}
                >
                  Percent (%)
                </Text>
              </Pressable>
            </View>

            {/* Quick percentage buttons */}
            {tipMode === 'percentage' && (
              <View className="mb-3 flex-row flex-wrap justify-between gap-2">
                {TIP_PERCENT_OPTIONS.map((pct) => (
                  <Pressable
                    key={pct}
                    className={`min-w-12 flex-1 rounded-lg py-2 ${
                      percentValue === pct
                        ? 'bg-black dark:bg-accent-100'
                        : 'bg-neutral-200 dark:bg-neutral-700'
                    }`}
                    onPress={() => {
                      percentChoiceEstablishedRef.current = true;
                      setPercentValue(pct);
                    }}
                  >
                    <Text
                      className={`text-center text-sm font-bold ${
                        percentValue === pct
                          ? 'text-white dark:text-black'
                          : 'dark:text-text-50'
                      }`}
                    >
                      {pct}%
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {tipMode === 'flat' ? (
              <Input
                placeholder="Enter tip amount"
                keyboardType="numeric"
                value={flatInput}
                onChangeText={(text) => setFlatInput(sanitizeNumeric(text))}
              />
            ) : (
              <View className="mb-3">
                <Select
                  value={String(percentValue)}
                  options={[...TIP_PERCENT_SELECT_OPTIONS]}
                  onSelect={(v) => {
                    percentChoiceEstablishedRef.current = true;
                    setPercentValue(
                      normalizeStoredTipPercent(Number.parseInt(String(v), 10))
                    );
                  }}
                />
              </View>
            )}

            {/* Preview */}
            {calculatedTipAmount > 0 && (
              <View className="mb-2 rounded-lg bg-neutral-200 px-3 py-2 dark:bg-neutral-700">
                <View className="flex-row justify-between">
                  <Text className="text-sm text-neutral-500 dark:text-neutral-400">
                    Subtotal
                  </Text>
                  <Text className="text-sm text-neutral-500 dark:text-neutral-400">
                    ${subtotalWithoutTip.toFixed(2)}
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-sm font-bold dark:text-text-50">
                    Tip
                  </Text>
                  <Text className="text-sm font-bold dark:text-text-50">
                    +${calculatedTipAmount.toFixed(2)}
                  </Text>
                </View>
              </View>
            )}

            <Button
              label="Add Tip"
              onPress={handleAddTip}
              disabled={calculatedTipAmount <= 0}
            />

            {existingTip && (
              <Button
                label="Remove Tip"
                variant="destructive"
                onPress={handleRemoveTip}
              />
            )}

            <Button
              label="Cancel"
              variant="ghost"
              onPress={() => setModalVisible(false)}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
