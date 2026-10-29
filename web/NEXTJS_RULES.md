# Dayline Web (Next.js) - Architecture & LLM Guidelines

> **IMPORTANT:** Any LLM (ChatGPT, Claude, Gemini, Cursor, Copilot, etc.) contributing to this repository MUST strictly follow the architectural rules and constraints specified below without exception.

---

## ⛔ 1. STRICT & NON-NEGOTIABLE ARCHITECTURAL RULES

### 🌐 RULE 1: ADHERE STRICTLY TO NEXT.JS APP ROUTER
- The project is built on **Next.js App Router (`src/app`)**. The legacy `pages/` directory structure must NEVER be used.
- Any component that handles user interaction, state, hooks (`useState`, `useEffect`), or browser APIs (`localStorage`, `window`) MUST include the **`'use client';`** directive at the very top of the file.

### 🎨 RULE 2: UI STYLING & DESIGN SYSTEM (TAILWIND CSS)
- Style components exclusively using **Tailwind CSS utility classes**. Do not add custom raw CSS files.
- Preserve Dayline's minimalist, clean design aesthetic:
  - Background color: `bg-[#EDF0F3]` (light grey-blue)
  - Card & surface color: `bg-white`
  - Border color: `border-slate-200`
  - Accent / Primary brand color: `bg-blue-600`, `text-blue-600`, `hover:bg-blue-700`
  - Typography: `text-slate-900` (headings), `text-slate-700` (body), `text-slate-400` (muted/metadata)
  - Border radius: `rounded-2xl` for cards, `rounded-xl` for buttons and inputs.
- Use **`lucide-react`** for all iconography (do not install alternative icon packages).

### 🗄️ RULE 3: DATA & STATE MANAGEMENT (OFFLINE-FIRST)
- Data persists locally in the browser's **IndexedDB** (database `dayline`, key `state`, files under `file:<id>`), in the same format as the original Dayline PWA, so existing users keep their data. (localStorage is only a fallback when IndexedDB is unavailable.)
- Do not touch storage inside components. Always go through **`src/lib/store.ts`** (`app.S`, `save()`, `useApp()`).
- Sync (`src/lib/sync.ts`, Firebase Firestore), locked notes (`src/lib/vault.ts`, PBKDF2 + AES-GCM), files (`src/lib/files.ts`) and reminders (`src/lib/device.ts`) keep the original app's formats. Changing a stored shape breaks sync with existing devices.
- The file viewer's styles live in `globals.css` because they style converted Word/Excel HTML that Tailwind classes cannot reach.
- All entities must strictly conform to TypeScript interfaces in **`src/types/index.ts`** (`Task`, `CalendarEvent`, `Note`).

---

## 📁 2. DIRECTORY STRUCTURE

```text
web/
├── src/
│   ├── app/                # Pages & App Router entry points
│   │   ├── globals.css     # Global styles & Tailwind directives
│   │   ├── layout.tsx      # Root layout & document metadata
│   │   └── page.tsx        # Main view controller (tab state & views)
│   ├── components/         # Modular, reusable UI components
│   │   ├── navigation.tsx  # Bottom tab bar (Tasks, Calendar, Notes)
│   │   ├── tasks-view.tsx  # Task list, completion toggle, creation modal
│   │   ├── calendar-view.tsx # Timeline & calendar event management
│   │   └── notes-view.tsx  # Note list & pin/delete controls
│   ├── lib/
│   │   ├── store.ts        # App state + IndexedDB persistence (same format as Dayline PWA)
│   │   ├── sync.ts         # Firebase sync between devices
│   │   ├── vault.ts        # PIN-locked encrypted notes
│   │   ├── files.ts        # Attached files and photos
│   │   ├── device.ts       # Reminders, install, calendar (.ics) export
│   │   └── config.ts       # Build settings (test copy vs main app, Firebase config)
│   └── types/
│       └── index.ts        # TypeScript data definitions
├── package.json
└── NEXTJS_RULES.md         # This guideline document
```

---

## 📋 3. COMPONENT TEMPLATE

When authoring interactive components, follow this structure:

```tsx
'use client';

import React, { useState } from 'react';
import { Task } from '@/types';
import { Plus } from 'lucide-react';

interface ExampleComponentProps {
  items: Task[];
  onAction: (id: string) => void;
}

export const ExampleComponent: React.FC<ExampleComponentProps> = ({ items, onAction }) => {
  const [active, setActive] = useState(false);

  return (
    <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
      <h3 className="font-bold text-slate-900 text-base">Example Component</h3>
      <button
        onClick={() => setActive(!active)}
        className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition"
      >
        Action
      </button>
    </div>
  );
};
```

---

## 💬 4. LLM PROMPT TEMPLATES

### Template 1: Adding a Feature
```text
Please adhere strictly to the rules and architecture defined in web/NEXTJS_RULES.md.
Implement the following feature in the Dayline Next.js web application:
[SPECIFY FEATURE: e.g., "Add an .ics download button next to each calendar event to allow importing into external calendars."]

Mandatory constraints:
1. Follow Next.js App Router and TypeScript best practices.
2. Mark interactive components with 'use client';.
3. Adhere to Tailwind CSS styling and Dayline's minimalist theme (#EDF0F3, rounded-2xl, border-slate-200).
4. Provide the complete code for all modified or created files.
```

### Template 2: Troubleshooting & Bug Fixing
```text
I encountered this error when building/running the Next.js application:
[PASTE ERROR LOG HERE]

Fix this error in compliance with the guidelines in web/NEXTJS_RULES.md. Output the complete updated file(s).
```

---

## 🛠️ 5. COMMON CLI COMMANDS

```bash
# 1. Navigate to the web folder
cd web

# 2. Install dependencies (if needed)
npm install

# 3. Start local development server (runs on http://localhost:3000)
npm run dev

# 4. Create production build and check for type/lint errors
npm run build
```
