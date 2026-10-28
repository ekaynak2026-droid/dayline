# Setting up sync for Dayline (one time, about 10 minutes)

Sync uses **Firebase**, Google's free online database for apps. You set it up once, then send me one block of settings. After that, you sign in to Dayline on each device with the same email and password.

You'll need a Google account (for example your Gmail). Firebase's free plan is far bigger than a personal planner will ever use, and no credit card is needed.

## 1. Create a Firebase project
1. Go to **https://console.firebase.google.com** and sign in with your Google account.
2. Click **Create a project** (or "Add project").
3. Name it `dayline`, then click **Continue**.
4. When it asks about **Google Analytics**, switch it **off**. Then click **Create project** and wait for it to finish.

## 2. Register Dayline as a web app
1. On the project's home page, click the **web icon `</>`** (under "Get started by adding Firebase to your app").
2. Under App nickname, type `Dayline`. Leave "Firebase Hosting" **unticked**. Click **Register app**.
3. You'll see a block of code that contains `const firebaseConfig = { ... }`. **Copy that whole block and paste it to me in our chat.** It looks like this:
   ```
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "dayline-xxxx.firebaseapp.com",
     projectId: "dayline-xxxx",
     storageBucket: "...",
     messagingSenderId: "...",
     appId: "1:...:web:..."
   };
   ```
   These values aren't secret. They tell the app where your database is, and your password and the rules in step 4 are what protect your data.
4. Click **Continue to console**.

## 3. Turn on email sign-in
1. In the left menu, open **Build → Authentication** (it may be under "All products"), then click **Get started**.
2. On the **Sign-in method** tab, click **Email/Password**.
3. Switch on the first switch (**Email/Password**), leave "Email link" off, and click **Save**.

## 4. Create the database and lock it to you
1. In the left menu, open **Build → Firestore Database**, then click **Create database**.
2. Choose a location near you (for example `eur3 (europe-west)`) and click **Next**.
3. Choose **Start in production mode** and click **Create**.
4. Open the **Rules** tab. Delete everything in the box and paste in this:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId}/{document=**} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```
5. Click **Publish**. This rule means only you, signed in, can read or change your data.

## 5. Send me the settings, then sign in
1. Paste the `firebaseConfig` block from step 2 into our chat. I'll add it to the app and publish the update.
2. **On your phone** (the device that has your tasks): open Dayline, go to ⚙︎ **Settings → Sync between devices**, type your email and a password (at least 6 characters), and tap **Create account**. Your tasks, events and notes are uploaded.
3. **On your computer:** open Dayline, go to ⚙︎ **Settings**, type the same email and password, and tap **Sign in**. Everything from the phone appears, and anything already on the computer is added too.

From then on, a change on one device shows up on the other within a few seconds. Changes made without internet are sent as soon as you're back online.

## Good to know
- **Locked notes** are uploaded still encrypted. Google can't read them, and neither can anyone else without your PIN. Use the same PIN on every device.
- If the same item is changed on two devices at almost the same moment, the change saved last wins.
- Signing out keeps your data on that device. It just stops syncing.
- Forgot your sync password? Tap **Forgot password** in Settings and Firebase emails you a reset link.
- Backup files still work, and they're still a good idea now and then.
