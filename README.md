<h1 align="center">
<img alt="logo" src="./assets/icon.png" width="124px" style="border-radius:10px"/><br/>
slicc </h1>

slicc is a cross-platform mobile app (iOS & Android) built with React Native and Expo that helps groups of people organize shared events and split expenses. Users can create and join groups, schedule one-time or recurring events, and track costs with fine-grained bill splitting, assigning individual line items to specific participants with flexible split modes. A built-in notification system keeps members in the loop with group invites, event invites, and upcoming-event reminders.

## Prerequiste

- [Expo dev environment](https://docs.expo.dev/get-started/set-up-your-environment/?mode=development-build&platform=android&device=simulated&buildEnv=local)
- [Node.js LTS release](https://nodejs.org/en/)
- [Pnpm](https://pnpm.io/installation)
- Android Studio SDK Tools NDK Version 27.1.12297006

### Windows only

- Download the latest ninja release from [here](https://github.com/ninja-build/ninja/releases/latest)
- Save the folder path where ninja.exe is as `NINJA_HOME` env variable or follow the steps below
- Unzip and place the ninja.exe file in "C:\ninja\ninja.exe" (same path as `-DCMAKE_MAKE_PROGRAM=${path}` in `android\app\build.gradle`)

## Env variables (wip)

## Run the app

Clone the repo to your machine and install deps :

```sh
pnpm install
```

To run the app on ios

```sh
pnpm ios
```

To run the app on android

```sh
pnpm android
```

## Common Commands for Deguging

make sure running react-native 0.81.X

```
pnpm ls react-native
```

run a fresh build (general)

```
rm -rf node_modules
```

run a fresh build (android)
**Using the automated script (recommended):**

```sh
pnpm clean:android
# Then reinstall and rebuild:
pnpm install
pnpm android
```

**Or manually:**

```
rm -rf android/.gradle android/app/.cxx android/app/build
cd android && ./gradlew clean && cd ..
```

run a fresh build (ios)

```
rm -rf Podfile.lock
```

Run on real device (android)

- connect device using usb
- settings > developer settings > enable usb debugging
- `pnpm android --device` select your device

## Contribution Guide

### Before Committing

- Run `pnpm run lint:fix` to fix linting issues

### PR Title

Make sure to inclue the relevent linear issue(s) in the PR Title. example - `[CAP-50] User Login`

### Branch Name

Branch Name should be of the form `name/title`.example - `ankush/user-login`

### Commit Messages

- `fix:` - for bug fixes
- `feat:` - for new features
- `perf:` - for performance improvements
- `docs:` - for documentation changes
- `style:` - for formatting changes
- `refactor:` - for code refactoring
- `test:`- for adding missing tests
- `chore:` - for maintenance tasks
  Use lowercase for commit messages. example - `feat: add login`

## Schema

```js
// User collection
{
  [userId: UserId]: {
    username: string; // unique
    displayName: string;
  	friends: UserId[];
    settings: { // sub col
      private: {
        locationPreference?: string;
        bankPreference?: string;
        dietaryPreferences?: string[];
        eTransferEmail?: string;
      }
    }

    // subcollection: users/{userId}/e2eKeys/identity
    // Only the PUBLIC key lives here -- private key never leaves the device (MMKV)
    e2eKeys: {
      identity: {
        publicKey: string;  // JWK JSON string for ECDH P-256 public key
        updatedAt: Date;
      }
    }
  };
}

// Groups collection
{
  [groupId: GroupId]: {
    name: string;
    description?: string;
    owner: UserId;
    admins: UserId[];
  	members: UserId[];
	  events: EventId[];
    createdAt?: Date;
    updatedAt?: Date;

    // subcollection: groups/{groupId}/messages/{messageId}
    messages: {
      [messageId: string]: {
        senderId: UserId | "system";
        type: "text" | "location" | "system";

        // type="text" -- AES-256-GCM ciphertext; decryptable only by group members
        encryptedContent?: string;
        nonce?: string;        // base64 AES-GCM IV
        keyVersion?: number;   // which group key version encrypted this message

        // type="location" -- public place data shared from the Explore page
        locationPayload?: {
          name: string;
          address: string;
          coordinates: { lat: number; lng: number };
          mapsUrl: string;
          category?: string;
          imageUrl?: string;
          rating?: number;     // 0–5
          priceLevel?: string; // "$" | "$$" | "$$$"
        };

        // type="system" -- human-readable event text (e.g. "Alice joined")
        systemText?: string;

        sentAt: Date;
        readBy: UserId[];
      }
    }

    // subcollection: groups/{groupId}/keyBundles/{userId}
    // Each member holds an encrypted copy of the group's symmetric key.
    // Wrapped via ECDH-derived key (sender priv + recipient pub -> AES-GCM).
    keyBundles: {
      [userId: UserId]: {
        encryptedGroupKey: string; // base64 -- AES-256-GCM ciphertext of the 32-byte group key
        senderPublicKey: string;   // JWK -- ECDH public key used to derive the wrapping key
        nonce: string;             // base64 -- IV for the AES-GCM wrap
        keyVersion: number;        // unix-ms timestamp; rotate on membership changes
        updatedAt: Date;
      }
    }

    // subcollection: groups/{groupId}/availability/{userId}
    // When2Meet-style scheduler -- each user stores their available 30-min slots.
    // TODO: slots are local wall-clock time ("YYYY-MM-DDTHH:MM") with no timezone offset.
    //       For cross-timezone groups, store in UTC ("YYYY-MM-DDTHH:MMZ") and convert
    //       to each viewer's local time on display (e.g. using Intl.DateTimeFormat or date-fns-tz).
    availability: {
      [userId: UserId]: {
        slots: string[];   // ISO-8601 date-time strings "YYYY-MM-DDTHH:MM"
        updatedAt?: Date;
      }
    }
  };
}

// Events collection
{
  [eventId: EventId]: {
    name: string;
    createdBy: UserId;
    description?: string;
    details?: string;
    startDate?: Date;
    endDate?: Date;
    isRecurring?: boolean;
    recurringInterval?: number;
    recurringUnit?: 'day' | 'week' | 'month' | 'year';
    recurringEndDate?: Date;
    location?: string;
    locationUrl?: string;
    groupId?: GroupId;
    participants: UserId[];
    createdAt?: Date;
    updatedAt?: Date;
  };
}

// Expenses collection
{
  [expenseId: ExpenseId]: {
    name: string;
    date: Date;
    createdBy: UserId;
    eventId?: EventId;
    totalAmount: number;
    remainingAmount?: number;
    participantCount?: number;
    createdAt?: Date;
    updatedAt?: Date;

    // subcollection: expenses/{expenseId}/people/{userId}
    people: {
      [userId: UserId]: {
        subtotal: number;
        paid: number;
      }
    }

    // subcollection: expenses/{expenseId}/items/{itemId}
    items: {
      [itemId: ItemId]: {
        name: string;
        amount: number;
        split: { mode: string; shares: Record<string, number> };
        assignedPersonIds: UserId[];
      }
    }
  };
}

// friendRequests collection — dedicated request documents (workflow state)
{
  [requestId: string]: {
    fromUserId: UserId;
    toUserId: UserId;
    status: "pending" | "accepted" | "declined" | "cancelled";
    createdAt: Date;
    updatedAt?: Date;
  };
}

// friendships collection — separate representation of confirmed friendships (one doc per pair)
{
  [friendshipId: string]: {
    userIds: [UserId, UserId];
    createdAt: Date;
    acceptedFromRequestId?: string;
  };
}

// notifications collection
{
  [notificationId: NotificationId]: {
    type:
      | "groupInvite"
      | "eventInvite"
      | "reminder"
      | "eventComingUp"

    senderId: UserId;
    receiverId: UserId;

    isRead: boolean;
    createdAt: Date;
    readAt?: Date;
  };
}
```

## Friend requests (Firebase)

- Deploy composite indexes from the repo root: `firebase deploy --only firestore:indexes` (see `firestore.indexes.json`). The app queries `friendRequests` with `toUserId` + `status`.
- Configure **security rules** for `friendRequests` and `friendships` so users can only create/read/update documents that involve their own `uid` (create outgoing requests, read/update incoming pending requests, create friendships on accept). Without rules, client writes will fail in production.

## 📄 License

MIT © 2025
