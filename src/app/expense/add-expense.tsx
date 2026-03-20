import 'react-native-get-random-values';

import Ionicons from '@expo/vector-icons/Ionicons';
import Octicons from '@expo/vector-icons/Octicons';
import { FlashList } from '@shopify/flash-list';
import { router, Stack, useLocalSearchParams, usePathname } from 'expo-router';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useAuth, useDefaultTaxRate } from '@/lib';
import { storage } from '@/lib/storage';
import { clearTempExpense, useExpenseCreation } from '@/lib/store';
import { useThemeConfig } from '@/lib/use-theme-config';
import {
  type EventIdT,
  type ItemIdT,
  type ItemWithId,
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

  return payerOptions;
}

export default function AddExpense() {
  const theme = useThemeConfig();
  const userId = useAuth.use.userId();
  const { data: signedInUser } = useUser({
    variables: userId as UserIdT,
    enabled: Boolean(userId),
  });
  const { eventId } = useLocalSearchParams<{ eventId?: EventIdT }>();
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
  } = useExpenseCreation();

  const currentPayerId = tempExpense?.payerUserId;
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
    if (userId && !tempExpense) {
      initializeTempExpense(userId);
    }
  }, [userId, tempExpense, initializeTempExpense]);

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
          Create an expense
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
        <View className="pb-2">
          <Text className="!dark:text-text-200 pb-2 text-base font-semibold">
            Main payer
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
        <View className="flex-1 flex-col gap-4">
          <FlashList
            data={tempExpense?.items || []}
            renderItem={({ item, index }) => (
              <TempItemCard
                item={item}
                onDelete={removeItem}
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
          router.push(`/expense/split-expense?eventId=${eventId}`);
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
  isFirstItem = false,
  nudgeTriggerRef,
}: {
  item: ItemWithId;
  onDelete: (itemId: ItemIdT) => void;
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

  const handleDelete = useCallback(() => {
    if (!item) return;
    onDelete(item.id);
  }, [item, onDelete]);

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

  // baseAmount = parseFloat(tempItemAmount) || 0;
  // taxRate = parseFloat(tempItemTaxStr) || 0;
  // taxAmount = baseAmount * (taxRate / 100);
  // totalWithTax = baseAmount + taxAmount;

  // taxAmount is calculated as:
  // amount * (taxRate / 100)
  // totalWithTax is calculated as:
  // amount + taxAmount

  const taxAmount = item.amount * ((item.taxRate ? item.taxRate : 0) / 100);
  const totalWithTax = item.amount + taxAmount;

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
              <Text className="font-futuraBold text-lg dark:text-text-50">
                {item.isTip ? `Tip` : item.name}
              </Text>
              <Text className="font-futuraDemi text-xl dark:text-text-50">
                ${item.amount.toFixed(2)}
              </Text>
            </View>
            {!item.isTip &&
              item.taxRate !== undefined &&
              item.taxRate > 0 &&
              item.amount !== undefined && (
                <View className="mt-1 flex flex-row justify-between">
                  <Text className="text-xs text-neutral-400">
                    Base: ${item.amount.toFixed(2)} + Tax ({item.taxRate}%): $
                    {totalWithTax?.toFixed(2) ?? '0.00'}
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
  const { defaultTaxRate } = useDefaultTaxRate();
  const [tempItemName, setTempItemName] = useState<string>('');
  const [tempItemAmount, setTempItemAmount] = useState<string>('');
  const [tempItemTaxStr, setTempItemTaxStr] = useState<string>('');
  const [recognizing, setRecognizing] = useState(false);

  // Sync the tax input with default whenever default changes and user hasn't typed anything
  useEffect(() => {
    setTempItemTaxStr(defaultTaxRate > 0 ? defaultTaxRate.toString() : '');
  }, [defaultTaxRate]);

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
      amount: baseAmount,
      taxRate: taxRate,
      isTip: false,
      split: {
        mode: 'equal',
        shares: {},
      },
      assignedPersonIds: [],
    });
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
          onChangeText={(text) => setTempItemTaxStr(sanitizeNumeric(text))}
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
}: {
  existingTip: ItemWithId | undefined;
  totalAmount: number;
  addItem: (item: ItemWithId) => void;
  removeItem: (itemId: ItemIdT) => void;
}) {
  const [modalVisible, setModalVisible] = useState(false);
  const [tipMode, setTipMode] = useState<'flat' | 'percentage'>('flat');
  const [tipInput, setTipInput] = useState<string>('');

  const subtotalWithoutTip = useMemo(() => {
    if (existingTip) {
      return totalAmount - existingTip.amount;
    }
    return totalAmount;
  }, [totalAmount, existingTip]);

  const calculatedTipAmount = useMemo(() => {
    const val = parseFloat(tipInput) || 0;
    if (tipMode === 'percentage') {
      return Math.round(subtotalWithoutTip * (val / 100) * 100) / 100;
    }
    return Math.round(val * 100) / 100;
  }, [tipInput, tipMode, subtotalWithoutTip]);

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
    setTipInput('');
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
          setTipInput('');
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
                onPress={() => setTipMode('flat')}
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
                onPress={() => setTipMode('percentage')}
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
              <View className="mb-3 flex-row justify-between gap-2">
                {[10, 15, 18, 20, 25].map((pct) => (
                  <Pressable
                    key={pct}
                    className={`flex-1 rounded-lg py-2 ${
                      tipInput === pct.toString()
                        ? 'bg-black dark:bg-accent-100'
                        : 'bg-neutral-200 dark:bg-neutral-700'
                    }`}
                    onPress={() => setTipInput(pct.toString())}
                  >
                    <Text
                      className={`text-center text-sm font-bold ${
                        tipInput === pct.toString()
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

            <Input
              placeholder={
                tipMode === 'flat' ? 'Enter tip amount' : 'Enter tip %'
              }
              keyboardType="numeric"
              value={tipInput}
              onChangeText={(text) => setTipInput(sanitizeNumeric(text))}
            />

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
