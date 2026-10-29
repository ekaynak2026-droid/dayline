import 'package:signals_flutter/signals_flutter.dart';
import 'package:uuid/uuid.dart';
import '../models/task_model.dart';
import '../services/storage_service.dart';

class TaskViewModel {
  static final TaskViewModel instance = TaskViewModel._internal();
  TaskViewModel._internal() {
    loadTasks();
  }

  // --- Signals State ---
  final tasks = signal<List<TaskModel>>([]);
  final isLoading = signal<bool>(false);

  // --- Computed Signals ---
  late final todayIso = computed(() {
    final now = DateTime.now();
    return _formatIso(now);
  });

  late final overdueCount = computed(() {
    final today = todayIso.value;
    return tasks.value.where((t) => !t.done && t.date.compareTo(today) < 0).length;
  });

  late final dayKeys = computed(() {
    final today = DateTime.now();
    final set = <String>{};

    for (int i = -14; i <= 60; i++) {
      set.add(_formatIso(today.add(Duration(days: i))));
    }

    for (final t in tasks.value) {
      set.add(t.date);
    }

    final list = set.toList()..sort();
    return list;
  });

  // --- Actions ---
  Future<void> loadTasks() async {
    isLoading.value = true;
    try {
      final loaded = await StorageService.loadTasks();
      if (loaded.isEmpty) {
        final today = _formatIso(DateTime.now());
        tasks.value = [
          TaskModel(
            id: const Uuid().v4(),
            text: "Welcome to Dayline! 👋",
            date: today,
            time: "09:00",
            done: true,
          ),
          TaskModel(
            id: const Uuid().v4(),
            text: "Tap the + button below to add tasks, events or notes",
            date: today,
            time: "10:30",
            done: false,
          ),
          TaskModel(
            id: const Uuid().v4(),
            text: "Try switching between Tasks, Calendar and Notes",
            date: today,
            done: false,
          ),
        ];
        await _save();
      } else {
        tasks.value = loaded;
      }
    } finally {
      isLoading.value = false;
    }
  }

  void toggleTask(String id) {
    tasks.value = tasks.value.map((t) {
      if (t.id == id) {
        return t.copyWith(done: !t.done);
      }
      return t;
    }).toList();
    _save();
  }

  void addTask({
    required String text,
    required String date,
    String? time,
    String? remind,
  }) {
    final newTask = TaskModel(
      id: const Uuid().v4(),
      text: text,
      date: date,
      time: time,
      remind: remind,
      done: false,
    );
    tasks.value = [...tasks.value, newTask];
    _save();
  }

  void updateTask(TaskModel updated) {
    tasks.value = tasks.value.map((t) => t.id == updated.id ? updated : t).toList();
    _save();
  }

  void deleteTask(String id) {
    tasks.value = tasks.value.where((t) => t.id != id).toList();
    _save();
  }

  void moveOverdueToToday() {
    final today = todayIso.value;
    tasks.value = tasks.value.map((t) {
      if (!t.done && t.date.compareTo(today) < 0) {
        return t.copyWith(date: today);
      }
      return t;
    }).toList();
    _save();
  }

  static String _formatIso(DateTime d) {
    final year = d.year;
    final month = d.month.toString().padLeft(2, '0');
    final day = d.day.toString().padLeft(2, '0');
    return '$year-$month-$day';
  }

  Future<void> _save() async {
    await StorageService.saveTasks(tasks.value);
  }
}
