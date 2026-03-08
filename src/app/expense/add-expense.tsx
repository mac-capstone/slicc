import 'react-native-get-random-values';

import Ionicons from '@expo/vector-icons/Ionicons';
import Octicons from '@expo/vector-icons/Octicons';
import { FlashList } from '@shopify/flash-list';
import { router, Stack, usePathname } from 'expo-router';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler } from 'react-native';
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

import { queryClient } from '@/api';
import { useExpense } from '@/api/expenses/use-expenses';
import ExpenseCreationFooter from '@/components/expense-creation-footer';
import { Button, Input, Pressable, Text, View } from '@/components/ui';
import { useAuth } from '@/lib';
import { storage } from '@/lib/storage';
import { clearTempExpense, useExpenseCreation } from '@/lib/store';
import { useThemeConfig } from '@/lib/use-theme-config';
import { type ExpenseIdT, type ItemIdT, type ItemWithId } from '@/types';

const TEMP_EXPENSE_ID = 'temp-expense' as ExpenseIdT;
const SWIPE_NUDGE_SHOWN_KEY = 'swipe-nudge-shown';

export default function AddExpense() {
  const theme = useThemeConfig();
  const userId = useAuth.use.userId();
  const pathname = usePathname();
  const {
    data: tempExpense,
    isPending,
    isError,
  } = useExpense({
    variables: TEMP_EXPENSE_ID,
  });
  const [expenseName, setExpenseName] = useState<string>('');
  const prevItemsCountRef = React.useRef<number>(0);
  const firstItemNudgeTriggerRef = React.useRef<(() => void) | null>(null);

  const {
    setExpenseName: setExpenseNameInStore,
    getTotalAmount,
    initializeTempExpense,
    hydrate,
    removeItem,
  } = useExpenseCreation();

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

  const handleLeave = useCallback(async () => {
    if (tempExpense?.items?.length && tempExpense.items.length > 0) {
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. Are you sure you want to leave?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Leave',
            onPress: async () => {
              router.replace('/');
              clearTempExpense();
              setExpenseName('');
              await queryClient.invalidateQueries({
                queryKey: ['expenses', 'expenseId', TEMP_EXPENSE_ID],
              });
            },
          },
        ]
      );
      return true; // Prevent default back behavior when showing alert
    } else {
      router.replace('/');
      clearTempExpense();
      setExpenseName('');
      await queryClient.invalidateQueries({
        queryKey: ['expenses', 'expenseId', TEMP_EXPENSE_ID],
      });
      return true; // Prevent default back behavior (navigation handled above)
    }
  }, [tempExpense, setExpenseName]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const fetchTempExpense = async () => {
      // if the user is logged in and the temp expense is not found
      if (userId && (!tempExpense || isError)) {
        initializeTempExpense(userId);
        await queryClient.invalidateQueries({
          queryKey: ['expenses', 'expenseId', TEMP_EXPENSE_ID],
        });
        await queryClient.invalidateQueries({
          queryKey: ['items', 'expenseId', TEMP_EXPENSE_ID],
        });
      }
    };
    fetchTempExpense();
  }, [userId, tempExpense, initializeTempExpense, isError]);

  useEffect(() => {
    if (tempExpense?.name) {
      setExpenseName(tempExpense.name);
    }
  }, [tempExpense?.name]);

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

  if (isPending) {
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

  if (isError) {
    return <Text>Error loading temp expense</Text>;
  }

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
        <View className="pb-11 pt-5">
          <Input
            placeholder="Enter Expense Name"
            value={expenseName}
            onChangeText={(text) => {
              setExpenseName(text);
              setExpenseNameInStore(text);
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
              <View className="pt-5">
                <CreateItemCard />
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
        onNextPress={async () => {
          setExpenseNameInStore(expenseName);
          await queryClient.invalidateQueries({
            queryKey: ['expenses', 'expenseId', TEMP_EXPENSE_ID],
          });
          router.push('/expense/split-expense');
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

  const handleDelete = useCallback(async () => {
    if (!item) return;
    onDelete(item.id);
    await queryClient.invalidateQueries({
      queryKey: ['expenses', 'expenseId', TEMP_EXPENSE_ID],
    });
    await queryClient.invalidateQueries({
      queryKey: ['items', 'expenseId', TEMP_EXPENSE_ID],
    });
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
          <View className="flex flex-row items-center justify-between rounded-xl bg-background-900 p-4">
            <Text className="font-futuraBold text-lg dark:text-text-50">
              {item.name}
            </Text>
            <Text className="font-futuraDemi text-xl dark:text-text-50">
              ${item.amount.toFixed(2)}
            </Text>
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
  const [tempItemName, setTempItemName] = useState<string>('');
  const [tempItemAmount, setTempItemAmount] = useState<string>('');
  const [recognizing, setRecognizing] = useState(false);

  const addItem = useExpenseCreation.use.addItem();

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
      setTempItemAmount(String(itemAmount));
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
      <Input
        placeholder="Enter Item Amount"
        keyboardType="decimal-pad"
        value={tempItemAmount}
        onChangeText={(text) => {
          let cleaned = text.replace(/[^0-9.]/g, '');

          const firstDot = cleaned.indexOf('.');
          if (firstDot !== -1) {
            cleaned =
              cleaned.slice(0, firstDot + 1) +
              cleaned.slice(firstDot + 1).replace(/\./g, '');
          }

          setTempItemAmount(cleaned);
        }}
      />
      <Button
        label="Add Item"
        onPress={async () => {
          const amount = Number(tempItemAmount);

          if (Number.isNaN(amount)) return;

          addItem({
            id: uuidv4() as ItemIdT,
            name: tempItemName.trim(),
            amount,
            split: {
              mode: 'equal',
              shares: {},
            },
            assignedPersonIds: [],
          });

          await queryClient.invalidateQueries({
            queryKey: ['expenses', 'expenseId', TEMP_EXPENSE_ID],
          });
          await queryClient.invalidateQueries({
            queryKey: ['items', 'expenseId', TEMP_EXPENSE_ID],
          });

          setTempItemName('');
          setTempItemAmount('');
        }}
        disabled={!tempItemName.trim() || !tempItemAmount}
      />
    </View>
  );
}
