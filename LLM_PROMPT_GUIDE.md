# 🤖 Dayline Checklist - LLM Prompting & Engineering Guide

This guide ensures that any AI coding assistant (ChatGPT, Claude, Gemini, Cursor, Copilot, etc.) contributes to the **Dayline Checklist** monorepo while strictly preserving architectural boundaries, code quality, and conventions.

---

## 🎯 GOLDEN RULE: Always Reference the Applicable Rules File

Language models are prone to defaulting to generic conventions (e.g., creating `StatefulWidget` in Flutter, or omitting `'use client'` in Next.js App Router).  
**Always prefix your prompt with a direct reference to the corresponding rules document.**

- For Flutter tasks: Reference [`mobile/FLUTTER_RULES.md`](./mobile/FLUTTER_RULES.md)
- For Next.js tasks: Reference [`web/NEXTJS_RULES.md`](./web/NEXTJS_RULES.md)

---

## 📱 1. FLUTTER (MOBILE) PROMPT TEMPLATES

> **Rule Reference:** [`mobile/FLUTTER_RULES.md`](./mobile/FLUTTER_RULES.md)

### Template 1: Feature Implementation
```text
We are working on the Dayline Checklist Flutter mobile app.
Reference file: mobile/FLUTTER_RULES.md

Strictly complying with the architecture rules in mobile/FLUTTER_RULES.md, please implement the following feature:
[DESCRIBE FEATURE: e.g., "Add category tags (#work, #personal, #study) to tasks with filter chips."]

Mandatory constraints:
1. ONLY StatelessWidget may be used. StatefulWidget is strictly forbidden.
2. State management must reside in the ViewModel using signals_flutter.
3. UI must reactively rebuild using SignalBuilder.
4. Output the complete, full code for all modified or created files.
```

### Template 2: Bug Fixing & Refactoring
```text
In the Dayline Flutter project, running 'flutter analyze' / 'flutter run' produced this issue:

[PASTE ERROR LOG HERE]

How should this be fixed while strictly honoring the StatelessWidget and Signals architecture in mobile/FLUTTER_RULES.md? Provide the full, updated source file.
```

---

## 🌐 2. NEXT.JS (WEB) PROMPT TEMPLATES

> **Rule Reference:** [`web/NEXTJS_RULES.md`](./web/NEXTJS_RULES.md)

### Template 1: Feature Implementation
```text
We are working on the Dayline Checklist Next.js web application.
Reference file: web/NEXTJS_RULES.md

Strictly complying with the architecture rules in web/NEXTJS_RULES.md, please implement the following feature:
[DESCRIBE FEATURE: e.g., "Add an export/import JSON backup feature in the settings view."]

Mandatory constraints:
1. Conform to the Next.js App Router structure.
2. Add 'use client'; to interactive components.
3. Keep styling consistent using Tailwind CSS and the Dayline theme (#EDF0F3, rounded-2xl, border-slate-200).
4. Provide the complete code for all affected files.
```

### Template 2: Bug Fixing & Refactoring
```text
In the Dayline Next.js project, 'npm run build' produced this error:

[PASTE ERROR LOG HERE]

Fix this error in accordance with web/NEXTJS_RULES.md without breaking the existing structure. Provide the full updated file(s).
```

---

## ⚠️ COMMON LLM PITFALLS & GUARDRAILS

| LLM Tendency | Why It Fails | How to Instruct the LLM |
| :--- | :--- | :--- |
| **Using `StatefulWidget` in Flutter** | Violates the strict project constraint requiring 100% `StatelessWidget`. | "Do not use StatefulWidget. Re-implement using StatelessWidget + signals_flutter SignalBuilder." |
| **Calling `setState()` in Flutter** | Signals manage reactivity; `setState()` is forbidden. | "setState is disallowed. Update the signal value in the ViewModel instead." |
| **Omitting `'use client'` in Next.js** | Client hooks (`useState`, `useEffect`, `localStorage`) fail during SSR/build. | "Add 'use client'; at the very first line of the file." |
| **Truncating code (`// ... existing code ...`)** | Leads to incomplete implementations or copy-paste ambiguity. | "Provide the complete, unabbreviated code from top to bottom." |

---

## 💡 VERIFICATION CHECKS

After applying changes from any LLM, verify the build health:

- **Mobile:** Run `cd mobile && flutter analyze` (Must return `No issues found!`)
- **Web:** Run `cd web && npm run build` (Must return `Compiled successfully`)
