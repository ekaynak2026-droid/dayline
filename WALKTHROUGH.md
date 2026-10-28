# Dayline Planner: how it is built, step by step

This guide explains the source code of Dayline in plain language. You don't need to be a programmer to follow it. Each step names the file and the part of the code it talks about, so you can open the file and look along.

## What kind of app this is

Dayline is an **installable web app** (developers call this a "PWA"). It is written with the same three languages as any website:

- **HTML** describes what is on the screen.
- **CSS** describes how it looks (colours, sizes, spacing).
- **JavaScript** describes what happens when you tap things, and it stores your data.

Once it is on a web address, you open it on your phone and choose "Add to Home Screen". From then on it has its own icon, opens full screen without the browser bars, works without internet, and keeps your data on the phone. The same files work on iPhone and Android, and no app store is involved.

## The files

| File | What it does |
|---|---|
| `index.html` | The skeleton: three screens (Tasks, Calendar, Notes), the + button, the tab bar at the bottom. |
| `app.css` | The look: colours for light and dark mode, fonts, sizes, the slide-up panels. |
| `app.js` | The brain: draws each screen, saves your data, handles locked notes, reminders and backups. |
| `manifest.webmanifest` | The app's "ID card": its name, icon and colours, and the instruction to open full screen. Phones read this when you install it. |
| `sw.js` | The "service worker": a small helper that keeps a copy of the app on your phone so it opens offline, and opens the app when you tap a reminder. |
| `icons/` | The app icon in the sizes iPhone and Android ask for. `icon.svg` is the original drawing. |

## Step 1: The skeleton (`index.html`)

The page has one container (`<div class="app">`) holding:

1. Three `<main>` areas, one per tab: `v-tasks`, `v-calendar` and `v-notes`. Only one is visible at a time.
2. The round **+** button (`#fab`). What it does depends on the tab you are on.
3. The tab bar (`<nav class="tabs">`) with three links: `#tasks`, `#calendar`, `#notes`. The part after `#` in the address tells the app which tab to show.
4. A hidden "sheet" (`#sheet`), which is the panel that slides up from the bottom when you add or edit something.
5. A hidden "toast" (`#toast`), the small message that appears for two seconds, such as "Task added".

The `<head>` section links the manifest and icon, and has a few lines that tell the iPhone the app may run full screen.

The screens start out empty. JavaScript fills them in.

## Step 2: The look (`app.css`)

- **Colours as named tokens.** At the top, colours get names like `--accent` (the blue), `--sun` (the yellow used for "today") and `--surface` (card background). Everything else uses these names, so changing the blue in one place changes it everywhere.
- **Dark mode.** The same names are given darker values when your phone is in dark mode (`@media (prefers-color-scheme: dark)`). You don't need to do anything for this.
- **Phone edges.** Modern phones have a notch and a home bar. `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` add exactly enough space so nothing hides behind them.
- **Fonts.** Headings use *Bricolage Grotesque* and text uses *Figtree*, both from Google Fonts. If they can't load, the phone's own font is used.
- **The "Today" card** (`.day.is-today`) is the white card with the yellow date badge. This is what makes today stand out from the other days.

## Step 3: Your data (`app.js`, section "storage")

Everything you enter is kept in one bundle called `S`, which looks roughly like this:

```
tasks:  [ { text: "Pay the electricity bill", date: "2026-10-27", time: "", remind: "", done: false }, ... ]
events: [ { title: "Dentist", date: "2026-10-30", time: "14:30", remind: "60", color: 3 }, ... ]
notes:  [ { type: "list", title: "Shopping list", items: [ { t: "Milk", done: false } ], photo: null }, ... ]
vault:  { the locked notes, scrambled. See step 7 }
```

- Every change calls `save()`, which writes the whole bundle into the phone's built-in app database (**IndexedDB**). This database belongs to Dayline only and survives closing the app and restarting the phone.
- On the first save, the app also asks the phone to treat this storage as "persistent" (`navigator.storage.persist()`), so the phone does not clear it when space gets low.
- When the app starts (the last lines of the file), it reads the bundle back with `idbGet('state')` and draws all three screens.

Nothing is sent to any server. That is why backups (step 10) matter.

## Step 4: The Tasks tab (`renderTasks`)

1. `dayKeys()` makes a list of days running from 14 days ago to 60 days ahead. It also adds any other day that has a task, so nothing is ever hidden.
2. For each day, the code writes a section with a heading ("Today", "Tomorrow", "Thursday 29 October"), that day's events (coloured bar), then its tasks (tick box), then an "Add a task" line.
3. Today's section gets the class `is-today`, which gives it the white card from step 2.
4. When the app opens, `scrollToDay(T)` scrolls so **today sits at the top**, with past days above it and future days below.
5. Tapping the tick box flips `done` and saves. Tapping the text opens the edit panel (`taskSheet`), where you can change the day, add a time or set a reminder.
6. If unfinished tasks are left on earlier days, a yellow strip says "N unfinished from earlier days" with a **Move to today** button. This works like 24me's carry-over.

## Step 5: The Calendar tab (`renderCal`)

1. The month grid always starts on **Monday**. The code finds the 1st of the month, counts how many days it is after Monday (`offset`), and starts the grid that many days earlier, so the first row shows the end of the previous month faded out.
2. Each day box shows the date number and up to two event labels, plus "+N more" if there are more.
3. Today's number has the yellow circle. The day you tapped gets a blue outline.
4. Under the grid, the "agenda" card lists the events on the selected day. It has buttons to add an event, to jump to that day's tasks, or to go back to today.
5. The event panel (`eventSheet`) has a name, date, time (leave it empty for all-day), reminder and colour.
6. **"Also add to my phone's calendar"** builds a small standard calendar file (`.ics`, made by `icsFor`) that iPhone and Android calendars understand. Opening it adds the event, with its alarm, to your phone's own calendar.

## Step 6: The Notes tab (`renderNotes`, `noteSheet`)

- There are two kinds of note: **text** and **checklist**. Either kind can have a **photo** attached. "Photo note" in the menu is a text note that opens the photo picker straight away.
- **Photos are shrunk** before saving (`shrink`). They are resized to at most 1200 pixels and saved as JPEG, so a 4 MB phone photo becomes about 150 KB. That keeps the app fast and the storage small.
- In a checklist, pressing Enter on an item adds a new line under it, like a real list app.
- The chips at the top (All, Checklists, With photos) filter what is shown.

## Step 7: Locked notes (section "locked notes")

This is the most security-sensitive part, so it is done properly:

1. When you first set up locked notes, you choose a **6-digit PIN** and type it twice.
2. The PIN is never stored. Instead, the code turns it into a long secret key using **PBKDF2** (`deriveKey`). This is a standard method that runs the PIN through 310,000 rounds of scrambling, which makes guessing slow on purpose. A random "salt" makes your key different from anyone else's, even with the same PIN.
3. All locked notes are then encrypted together with **AES-GCM** (`sealVault`), the same encryption banks and messaging apps use. What gets saved is unreadable scrambled text, plus a count of how many notes there are.
4. To open them, you type the PIN. The key is rebuilt and decryption is tried (`openVault`). A wrong PIN fails cleanly with "Wrong PIN".
5. While unlocked, the notes exist only in the app's working memory. They **lock again automatically** one minute after you leave the app, or straight away with "Lock now".
6. Moving a note into or out of the locked area re-encrypts the vault.

**Important:** because nothing stores the PIN, a forgotten PIN can't be recovered. "I forgot my PIN" in Settings explains this and offers to delete the locked notes so you can start again.

## Step 8: Reminders (section "reminders")

- Tasks and events can have a reminder: at the time, 10 minutes before, 1 hour before or 1 day before. A task with no time counts as 09:00.
- Every 30 seconds, and whenever you come back to the app, `checkReminders()` looks for reminders that are due. It shows a phone notification (if you allowed them in Settings) and a message inside the app. Each reminder fires once.
- If the phone was off or the app was closed, a missed reminder still shows when you next open the app, as long as it is less than 12 hours late.

**Honest limit:** web apps can't yet schedule an alarm that goes off while the app is fully closed. For an event you must not miss, use "Also add to my phone's calendar" (step 5), and your phone's own calendar will ring for it. A fully closed-app reminder needs either a small server that sends "push" messages or a native store app. That could be a later upgrade.

## Step 9: Working offline and installing (`manifest.webmanifest`, `sw.js`)

- The **manifest** tells the phone the app's name, icon and that it should open full screen. That is what makes "Add to Home Screen" produce a proper app icon.
- The **service worker** (`sw.js`) saves a copy of all the app files on first visit. When you are online it fetches fresh files, so updates arrive by themselves. When you are offline it serves the saved copy, so the app opens anywhere.
- The Tasks screen shows install instructions until the app is installed. On Android there is a one-tap **Install** button.

## Step 10: Backup and restore (`settingsSheet`)

- **Save a backup file** downloads one file (`dayline-backup-2026-10-27.json`) with everything in it. Locked notes stay encrypted inside it. Save it to iCloud Drive or Google Drive.
- **Restore from a backup file** reads such a file, shows what it contains (number of tasks, events and notes) and asks you to confirm before replacing anything.
- This is also how you move to a new phone.

## Step 11: How I tested it

I ran the app in a real browser at phone size (390 × 844 pixels) with an automated script that:

1. Added a task by typing on the Today line, and another with a time and a reminder. ✔
2. Added a calendar event with a time. ✔
3. Made a checklist with two items using the Enter key. ✔
4. Set up a PIN and saved a locked note containing a test password. ✔
5. **Looked inside the stored data to confirm the password is not there in readable form.** It was not; only scrambled text was stored. ✔
6. Reloaded the app and confirmed everything was still there. ✔
7. Typed a wrong PIN (got "Wrong PIN"), then the right one (the locked note appeared). ✔
8. Confirmed the offline helper (service worker) was installed. ✔
9. Checked for errors in the browser console: none. ✔

The test found one bug: a reminder set for a time that had already passed earlier that day fired straight away. I fixed it so reminders only fire for times after the moment you set them.

## Known limits and possible next steps

- Data lives on one phone. Syncing between phone and computer would need an account and a small server.
- Reminders while the app is fully closed need push messages or a store app (see step 8).
- Repeating tasks and events ("every Monday") are not in this first version.
- Sharing a list with someone else (like a family shopping list) is not in this version.

## Step 12: Sync between devices (`sync.js`, `firebase-config.js`)

Added in version 1.1 so the phone and computer show the same data.

- **Where the data goes.** Firebase is Google's online database. Each task, event and note is saved as one record under your account (`users/<your account>/items/<id>`). The rules in Firebase let only you, when signed in, read or write there.
- **Signing in.** Email and password (Firebase Authentication). The Google button was left out on purpose, because Google's sign-in pop-up doesn't work reliably inside home-screen apps on iPhone.
- **Finding what changed.** Rather than changing every button, `sync.js` takes a short "fingerprint" of every item after each save (`fp`) and compares it with the fingerprint from the last sync. Items that changed are uploaded. Items that disappeared are uploaded as "deleted", so they disappear on the other devices too.
- **Receiving changes.** A live connection (`onSnapshot`) gets other devices' changes within seconds and puts them into your lists.
- **First sign-in merges.** The app first reads what is already online, then uploads anything that only exists on this device. So signing in on a second device adds to your data and doesn't wipe it.
- **Locked notes** are synced as the same encrypted bundle that's stored on the phone, so they leave the device already scrambled. A device that has no locked notes yet is not allowed to "upload nothing" over the ones that are online.
- **Offline.** Firebase keeps its own copy on the device and sends queued changes when you're back online. The service worker also saves the Firebase program files, so the app still opens offline.
- **Settings** (`firebase-config.js`) holds the address of your Firebase project. It isn't secret. If it's empty, the app works exactly like version 1.0 and Settings says sync is not set up.

**How I tested sync:** I simulated a phone and a computer, each with its own data, connected to a shared fake online database that answers exactly like Firebase. Results:
1. The phone signed in: its 2 tasks and the locked note were uploaded, and the test password was **not** readable on the server. ✔
2. The computer signed in: both devices then showed all 3 tasks (phone's and computer's merged). ✔
3. Ticking a task on the phone ticked it on the computer. ✔
4. Deleting a task on the computer removed it from the phone. ✔
5. The computer opened the locked notes with the PIN. ✔ Then the phone edited the locked note, and the computer showed the new text. ✔
6. An event added on the computer appeared on the phone. ✔
7. Reopening the app caused **zero** unnecessary uploads. ✔
8. A task added while signed out was uploaded after signing in again. ✔

The test caught one real bug, which I fixed: a device that had no locked notes could, with unlucky timing, upload "no locked notes" and wipe them for the other devices.
