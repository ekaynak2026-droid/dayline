import 'package:shared_preferences/shared_preferences.dart';
import '../models/task_model.dart';
import '../models/event_model.dart';
import '../models/note_model.dart';

class StorageService {
  static const String _tasksKey = 'dayline_tasks';
  static const String _eventsKey = 'dayline_events';
  static const String _notesKey = 'dayline_notes';

  // --- Tasks ---
  static Future<List<TaskModel>> loadTasks() async {
    final prefs = await SharedPreferences.getInstance();
    final jsonList = prefs.getStringList(_tasksKey) ?? [];
    return jsonList.map((str) => TaskModel.fromJson(str)).toList();
  }

  static Future<void> saveTasks(List<TaskModel> tasks) async {
    final prefs = await SharedPreferences.getInstance();
    final jsonList = tasks.map((t) => t.toJson()).toList();
    await prefs.setStringList(_tasksKey, jsonList);
  }

  // --- Events ---
  static Future<List<EventModel>> loadEvents() async {
    final prefs = await SharedPreferences.getInstance();
    final jsonList = prefs.getStringList(_eventsKey) ?? [];
    return jsonList.map((str) => EventModel.fromJson(str)).toList();
  }

  static Future<void> saveEvents(List<EventModel> events) async {
    final prefs = await SharedPreferences.getInstance();
    final jsonList = events.map((e) => e.toJson()).toList();
    await prefs.setStringList(_eventsKey, jsonList);
  }

  // --- Notes ---
  static Future<List<NoteModel>> loadNotes() async {
    final prefs = await SharedPreferences.getInstance();
    final jsonList = prefs.getStringList(_notesKey) ?? [];
    return jsonList.map((str) => NoteModel.fromJson(str)).toList();
  }

  static Future<void> saveNotes(List<NoteModel> notes) async {
    final prefs = await SharedPreferences.getInstance();
    final jsonList = notes.map((n) => n.toJson()).toList();
    await prefs.setStringList(_notesKey, jsonList);
  }
}

