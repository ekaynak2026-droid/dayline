import 'package:signals_flutter/signals_flutter.dart';
import 'package:uuid/uuid.dart';
import '../models/note_model.dart';
import '../services/storage_service.dart';

class NotesViewModel {
  static final NotesViewModel instance = NotesViewModel._internal();
  NotesViewModel._internal() {
    loadNotes();
  }

  // --- Signals State ---
  final notes = signal<List<NoteModel>>([]);

  // --- Computed ---
  late final sortedNotes = computed(() {
    final list = [...notes.value];
    list.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    return list;
  });

  // --- Metotlar ---
  Future<void> loadNotes() async {
    final loaded = await StorageService.loadNotes();
    if (loaded.isEmpty) {
      notes.value = [
        NoteModel(
          id: const Uuid().v4(),
          type: 'text',
          title: "Dayline Ideas",
          body: "A clean, minimalist personal planner for today's tasks, calendar, and quick notes.",
          updatedAt: DateTime.now(),
        ),
        NoteModel(
          id: const Uuid().v4(),
          type: 'list',
          title: "Quick Grocery List",
          items: const [
            ChecklistItem(t: "Oat milk", done: true),
            ChecklistItem(t: "Fresh sourdough", done: false),
            ChecklistItem(t: "Coffee beans", done: false),
          ],
          updatedAt: DateTime.now().subtract(const Duration(hours: 1)),
        ),
      ];
      await _save();
    } else {
      notes.value = loaded;
    }
  }

  void addNote({
    required String title,
    String body = '',
    String type = 'text',
    List<ChecklistItem> items = const [],
  }) {
    final newNote = NoteModel(
      id: const Uuid().v4(),
      type: type,
      title: title,
      body: body,
      items: items,
      updatedAt: DateTime.now(),
    );
    notes.value = [newNote, ...notes.value];
    _save();
  }

  void deleteNote(String id) {
    notes.value = notes.value.where((n) => n.id != id).toList();
    _save();
  }

  Future<void> _save() async {
    await StorageService.saveNotes(notes.value);
  }
}
