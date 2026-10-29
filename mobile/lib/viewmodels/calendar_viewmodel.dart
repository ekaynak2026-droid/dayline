import 'package:signals_flutter/signals_flutter.dart';
import 'package:uuid/uuid.dart';
import '../models/event_model.dart';
import '../services/storage_service.dart';

class CalendarViewModel {
  static final CalendarViewModel instance = CalendarViewModel._internal();
  CalendarViewModel._internal() {
    loadEvents();
  }

  // --- Signals State ---
  final events = signal<List<EventModel>>([]);
  final selectedDate = signal<String>(
    DateTime.now().toIso8601String().substring(0, 10),
  );

  // --- Computed ---
  late final eventsForSelectedDate = computed(() {
    return events.value
        .where((e) => e.date == selectedDate.value)
        .toList();
  });

  // --- Metotlar ---
  Future<void> loadEvents() async {
    final loaded = await StorageService.loadEvents();
    if (loaded.isEmpty) {
      final today = DateTime.now().toIso8601String().substring(0, 10);
      events.value = [
        EventModel(
          id: const Uuid().v4(),
          title: "Ekip Toplantısı",
          date: today,
          time: "14:00",
          color: 1,
        ),
      ];
      await _save();
    } else {
      events.value = loaded;
    }
  }

  void selectDate(String date) {
    selectedDate.value = date;
  }

  void addEvent({
    required String title,
    required String date,
    String? time,
    String? remind,
    int color = 1,
  }) {
    final newEvent = EventModel(
      id: const Uuid().v4(),
      title: title,
      date: date,
      time: time,
      remind: remind,
      color: color,
    );
    events.value = [...events.value, newEvent];
    _save();
  }

  void deleteEvent(String id) {
    events.value = events.value.where((e) => e.id != id).toList();
    _save();
  }

  Future<void> _save() async {
    await StorageService.saveEvents(events.value);
  }
}

