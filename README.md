# 🗓️ Dayline Checklist (Monorepo)

**Dayline Checklist** is a modern, minimalist personal planner application unifying daily tasks, a monthly calendar, and quick notes.

Prototype Reference: [https://ekaynak2026-droid.github.io/dayline/#tasks](https://ekaynak2026-droid.github.io/dayline/#tasks)

---

## 📁 Monorepo Structure

```text
Dayline-Checklist/
├── mobile/                 # 📱 Mobile Application (Flutter)
│   ├── lib/
│   │   ├── core/           # Theming, constants, utilities
│   │   ├── models/         # Immutable data models
│   │   ├── services/       # Local storage (SharedPreferences)
│   │   ├── viewmodels/     # MVVM ViewModels & Signals reactive state
│   │   ├── views/          # 100% StatelessWidget UI layer
│   │   └── main.dart       # App entry point
│   ├── FLUTTER_RULES.md    # ⚠️ Flutter Architecture & LLM Guidelines
│   └── pubspec.yaml
│
├── web/                    # 🌐 Web Application (Next.js 16)
│   ├── src/
│   │   ├── app/            # App Router (layout, page, globals)
│   │   ├── components/     # UI Components (Tasks, Calendar, Notes, Nav)
│   │   ├── lib/            # LocalStorage persistence service
│   │   └── types/          # TypeScript interface definitions
│   ├── NEXTJS_RULES.md     # ⚠️ Next.js Architecture & LLM Guidelines
│   └── package.json
│
├── LLM_PROMPT_GUIDE.md     # 🤖 Master LLM Prompting & Engineering Guide
├── .gitignore
└── README.md
```

---

## 🚀 Quick Start

### 1. 🌐 Web Application (Next.js)
```bash
cd web
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

### 2. 📱 Mobile Application (Flutter)
```bash
cd mobile
flutter pub get
flutter analyze
flutter run
```

---

## 🤖 AI / LLM Workflow

When using language models (ChatGPT, Claude, Gemini, Cursor, Copilot) to add features or fix bugs, always reference the corresponding rules document:
- For Flutter development: [`mobile/FLUTTER_RULES.md`](./mobile/FLUTTER_RULES.md)
- For Next.js development: [`web/NEXTJS_RULES.md`](./web/NEXTJS_RULES.md)
- For master templates and guardrails: [`LLM_PROMPT_GUIDE.md`](./LLM_PROMPT_GUIDE.md)
