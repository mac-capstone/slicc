<h1 align="center">
<img alt="logo" src="./assets/icon.png" width="124px" style="border-radius:10px"/><br/>
Unnamed App </h1>

> This Project is based on [Obytes starter](https://starter.obytes.com)

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

    createdAt?: Date;
    updatedAt?: Date;
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
    expenseIds: ExpenseId[];
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
    // subcollection
    people: {
      [userId: UserId]: {
        subtotal: number;
      }
    }
    // items subcollection
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

## ✍️ Documentation

- [Rules and Conventions](https://starter.obytes.com/getting-started/rules-and-conventions/)
- [Project structure](https://starter.obytes.com/getting-started/project-structure)
- [Environment vars and config](https://starter.obytes.com/getting-started/environment-vars-config)
- [UI and Theming](https://starter.obytes.com/ui-and-theme/ui-theming)
- [Components](https://starter.obytes.com/ui-and-theme/components)
- [Forms](https://starter.obytes.com/ui-and-theme/Forms)
- [Data fetching](https://starter.obytes.com/guides/data-fetching)
- [Contribute to starter](https://starter.obytes.com/how-to-contribute/)

## 📄 License

MIT © 2025
