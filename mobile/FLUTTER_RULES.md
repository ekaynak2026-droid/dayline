# Dayline Mobile (Flutter) - Architecture & LLM Guidelines

> **IMPORTANT:** Any LLM (ChatGPT, Claude, Gemini, Cursor, Copilot, etc.) contributing to this repository MUST strictly follow the architectural rules and constraints specified below without exception.

---

## ⛔ 1. STRICT & NON-NEGOTIABLE ARCHITECTURAL RULES

### 🚫 RULE 1: NEVER USE `StatefulWidget`
- **ALL WIDGETS MUST BE `StatelessWidget`.**
- Creating or using `StatefulWidget`, `State<T>`, `setState()`, `initState()`, `dispose()`, or `didUpdateWidget()` is **STRICTLY PROHIBITED**.
- Any UI state mutations, transitions, or side effects must be managed through **Signals**.

### ⚡ RULE 2: STATE MANAGEMENT EXCLUSIVELY VIA `signals_flutter`
- No other state management library (Bloc, Provider, Riverpod, GetX) may be introduced.
- State variables must be defined inside ViewModels using `signal<T>(initialValue)`.
- Derived/computed values must be declared using `late final ... = computed(() => ...)`.
- Recreative UI binding must be done using **`SignalBuilder(builder: (context) { ... })`** or `.watch(context)`.  
  *(Note: Legacy `Watch` widget is deprecated in signals_flutter 7.x; always use `SignalBuilder`).*

### 🏛️ RULE 3: STRICT MVVM ARCHITECTURE
Code must strictly conform to the following directory layout:
```text
lib/
├── core/           # Theming, constants, utilities (e.g. app_theme.dart)
├── models/         # Pure data models (JSON serialization, copyWith, immutable)
├── services/       # Local storage (SharedPreferences), external I/O
├── viewmodels/     # Business logic, Signals reactive state, actions (Singleton pattern)
├── views/          # UI layer composed ONLY of StatelessWidget
└── main.dart       # Application entry point
```

- **Views must NEVER contain business logic, filtering algorithms, or computation.**
- Views only observe ViewModels via `SignalBuilder` and trigger actions (e.g., `TaskViewModel.instance.toggleTask(id)`).
- ViewModels are implemented as singletons (`TaskViewModel.instance`) for predictable shared state.

---

## 📋 2. CODE TEMPLATES (LLM MUST ADHERE EXACTLY)

### A) Model Template (`lib/models/xxx_model.dart`)
```dart
import 'dart:convert';

class ExampleModel {
  final String id;
  final String title;
  final bool isCompleted;

  const ExampleModel({
    required this.id,
    required this.title,
    this.isCompleted = false,
  });

  ExampleModel copyWith({
    String? id,
    String? title,
    bool? isCompleted,
  }) {
    return ExampleModel(
      id: id ?? this.id,
      title: title ?? this.title,
      isCompleted: isCompleted ?? this.isCompleted,
    );
  }

  Map<String, dynamic> toMap() => {
    'id': id,
    'title': title,
    'isCompleted': isCompleted,
  };

  factory ExampleModel.fromMap(Map<String, dynamic> map) => ExampleModel(
    id: map['id'] ?? '',
    title: map['title'] ?? '',
    isCompleted: map['isCompleted'] ?? false,
  );

  String toJson() => json.encode(toMap());
  factory ExampleModel.fromJson(String source) => ExampleModel.fromMap(json.decode(source));
}
```

### B) ViewModel Template (`lib/viewmodels/xxx_viewmodel.dart`)
```dart
import 'package:signals_flutter/signals_flutter.dart';
import '../models/example_model.dart';
import '../services/storage_service.dart';

class ExampleViewModel {
  static final ExampleViewModel instance = ExampleViewModel._internal();
  ExampleViewModel._internal() {
    loadItems();
  }

  // 1. Reactive State Signals
  final items = signal<List<ExampleModel>>([]);
  final isLoading = signal<bool>(false);

  // 2. Computed / Derived Signals
  late final completedItems = computed(
    () => items.value.where((x) => x.isCompleted).toList(),
  );

  // 3. Actions & Business Logic
  Future<void> loadItems() async {
    isLoading.value = true;
    try {
      // Fetch or restore items...
    } finally {
      isLoading.value = false;
    }
  }

  void addItem(ExampleModel item) {
    items.value = [...items.value, item];
  }

  void toggleItem(String id) {
    items.value = items.value.map((x) {
      return x.id == id ? x.copyWith(isCompleted: !x.isCompleted) : x;
    }).toList();
  }
}
```

### C) View Template (`lib/views/xxx/xxx_view.dart`)
```dart
import 'package:flutter/material.dart';
import 'package:signals_flutter/signals_flutter.dart';
import '../../viewmodels/example_viewmodel.dart';

/// NOTE: ALWAYS a StatelessWidget!
class ExampleView extends StatelessWidget {
  const ExampleView({super.key});

  @override
  Widget build(BuildContext context) {
    final vm = ExampleViewModel.instance;

    return Scaffold(
      appBar: AppBar(title: const Text('Example')),
      body: SignalBuilder(
        builder: (context) {
          if (vm.isLoading.value) {
            return const Center(child: CircularProgressIndicator());
          }

          final list = vm.items.value;
          return ListView.builder(
            itemCount: list.length,
            itemBuilder: (context, index) {
              final item = list[index];
              return ListTile(
                title: Text(item.title),
                trailing: Checkbox(
                  value: item.isCompleted,
                  onChanged: (_) => vm.toggleItem(item.id),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
```

---

## 💬 3. LLM PROMPT TEMPLATES

Use the following prompt templates when delegating Flutter tasks to an LLM:

### Template 1: Adding a New Feature
```text
Please adhere strictly to the rules and architecture defined in mobile/FLUTTER_RULES.md.
Implement the following feature in the Dayline Flutter app:
[SPECIFY FEATURE: e.g., "Add priority levels (Low, Medium, High) to tasks with color badges."]

Mandatory constraints:
1. ONLY StatelessWidget may be used. StatefulWidget is strictly forbidden.
2. State management must reside in the ViewModel using signals_flutter.
3. UI must reactively rebuild using SignalBuilder.
4. Output the complete, production-ready code for all modified or created files.
```

### Template 2: Troubleshooting & Bug Fixing
```text
I encountered this issue in the Dayline Flutter project:
[PASTE ERROR LOG HERE]

Resolve this issue while strictly preserving the StatelessWidget and Signals architecture described in mobile/FLUTTER_RULES.md. Provide the complete updated files.
```

---

## 🛠️ 4. COMMON CLI COMMANDS

```bash
# 1. Navigate to the mobile folder
cd mobile

# 2. Fetch dependencies
flutter pub get

# 3. Analyze for rule compliance & errors (must report 'No issues found!')
flutter analyze

# 4. Run tests
flutter test

# 5. Launch the application
flutter run
```
