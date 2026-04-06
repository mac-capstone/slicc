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

### Firestore

```js
// User collection
{
  [userId: UserId]: {
    username: string; // unique
    displayName: string;
    friends: UserId[];
    createdAt?: Date;
    updatedAt?: Date;
  };
}

    // subcollection: users/{userId}/settings/private
    settings: {
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

// friendRequests collection -- dedicated request documents (workflow state)
{
  [requestId: string]: {
    fromUserId: UserId;
    toUserId: UserId;
    status: "pending" | "accepted" | "declined" | "cancelled";
    createdAt: Date;
    updatedAt?: Date;
  };
}

// friendships collection -- separate representation of confirmed friendships (one doc per pair)
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

### Realtime Database

Paths are rooted at the default RTDB URL (`databaseURL` in Firebase config). Message ids are Firebase **`push()`** keys under each group.

```js
// ── groups/{groupId}/messages/{pushId} ───────────────────────────────────────
{
  senderId: UserId | "system";
  type: "text" | "location" | "system";

  // type="text" - AES-256-GCM ciphertext; decryptable only by group members
  encryptedContent?: string;
  nonce?: string; // base64 AES-GCM IV
  keyVersion?: number;
  // Encrypted image messages saved to Firebase Storage with path `groups/{groupId}/{uuid}.jpg`
  imagePath?: string,
  mimeType?: string,
  fileName?: string,

  // type="location" - public place data (Explore page)
  locationPayload?: {
    name: string;
    address: string;
    coordinates: { lat: number; lng: number };
    mapsUrl: string;
    category?: string;
    imageUrl?: string;
    rating?: number; // 0–5
    priceLevel?: string; // "$" | "$$" | "$$$"
  };

  // type="system" - human-readable line (e.g. "Alice joined")
  systemText?: string;

  sentAt: number; // server timestamp (ms) once committed
  readBy: UserId[];
  // emoji -> userIds who reacted (updated via transaction)
  reactions?: Record<string, UserId[]>;
}

// ── groups/{groupId}/keyBundles/{userId} ───────────────────────────────────
// Each member holds an encrypted copy of the group's symmetric key.
// Wrapped via ECDH (sender priv + recipient pub -> AES-GCM).
{
  encryptedGroupKey: string; // base64 - AES-256-GCM ciphertext of the 32-byte group key
  senderPublicKey: string; // JWK - ECDH public key for the wrapping key
  nonce: string; // base64 IV for the AES-GCM wrap
  keyVersion: number; // unix-ms when the group key was created; do not rotate casually
  updatedAt: number; // ms
}

// ── groups/{groupId}/availability/{userId}  (When2Meet-style scheduler) ───
// TODO: slots are local wall-clock "YYYY-MM-DDTHH:MM" with no TZ offset.
//       For cross-timezone groups, prefer UTC ("…Z") and convert on display.
{
  slots: string[]; // ISO-8601 date-time strings "YYYY-MM-DDTHH:MM"
  updatedAt: number; // ms
}
```

## Friend requests (Firebase)

- Deploy composite indexes from the repo root: `firebase deploy --only firestore:indexes` (see `firestore.indexes.json`). The app queries `friendRequests` with `toUserId` + `status`.
- **What the client does (one transaction each):**
  - **Accept** (`src/api/social/friend-requests.ts`, `completeFriendshipInTransaction`): updates the `friendRequests` doc to `accepted`, creates `friendships/{pairId}` with sorted `userIds`, and updates **both** `users/{fromUserId}` and `users/{toUserId}` with `friends: arrayUnion(…)` (reciprocal entries).
  - **Unfriend** (`src/api/social/friendships.ts`, `unfriendUser`): deletes `friendships/{pairId}`, deletes forward/reverse `friendRequests` docs when they exist, and updates **both** `users/{currentUserId}` and `users/{friendUserId}` with `friends: arrayRemove(…)`.
- **Security rules:** Firestore evaluates **every write** in a transaction; `request.auth.uid` is the signed-in user. A simple **owner-only** rule on `users/{uid}` (e.g. `allow update: if request.auth.uid == uid`) authorizes that user’s document only. It does **not** authorize the same client session to update the **other** participant’s `users/{otherUid}` in the same transaction, so those client flows will fail until you either:
  - **Relax or specialize rules** — e.g. still require owner-only updates for most fields, but allow a **narrow** update to another user’s `friends` (and maybe `updatedAt`) when a `get()` on the matching `friendRequests` / `friendships` data proves the actor is the other party and the operation matches the intended state transition; or
  - **Move symmetric updates server-side** — e.g. Cloud Function or trusted backend using the Admin SDK after an authorized client write to `friendRequests` / `friendships` only.
- Allow **deletion** of `friendships/{pairId}` when `request.auth.uid` is one of the `userIds` on that document. Define create/update rules for `friendRequests` and `friendships` separately (e.g. sender creates pending requests, recipient accepts or declines, both parties may unfriend per the flows above).

## 📄 License

MIT © 2025
