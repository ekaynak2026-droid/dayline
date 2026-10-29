import 'package:flutter/material.dart';
import 'package:signals_flutter/signals_flutter.dart';
import '../../core/theme/app_theme.dart';
import '../../models/note_model.dart';
import '../../viewmodels/notes_viewmodel.dart';

/// Dayline Orijinal Tasarımlı Notes Ekranı (SADECE StatelessWidget)
class NotesView extends StatelessWidget {
  const NotesView({super.key});

  @override
  Widget build(BuildContext context) {
    final vm = NotesViewModel.instance;
    final filterSignal = signal<String>('all'); // 'all' or 'list'

    return Scaffold(
      backgroundColor: AppTheme.bg,
      body: SafeArea(
        bottom: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header
              Text(
                'Notes',
                style: AppTheme.displayStyle(fontSize: 30, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 14),

              // Filter Chips
              SignalBuilder(
                builder: (context) {
                  final filter = filterSignal.value;

                  return Row(
                    children: [
                      _chip(
                        label: 'All',
                        isSelected: filter == 'all',
                        onTap: () => filterSignal.value = 'all',
                      ),
                      const SizedBox(width: 8),
                      _chip(
                        label: 'Checklists',
                        isSelected: filter == 'list',
                        onTap: () => filterSignal.value = 'list',
                      ),
                    ],
                  );
                },
              ),
              const SizedBox(height: 16),

              // 2-Column Notes Grid
              SignalBuilder(
                builder: (context) {
                  final filter = filterSignal.value;
                  final allNotes = vm.sortedNotes.value;
                  final notes = filter == 'list'
                      ? allNotes.where((n) => n.type == 'list').toList()
                      : allNotes;

                  if (notes.isEmpty) {
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 40),
                      child: Center(
                        child: Text(
                          'No notes found. Tap + to create one.',
                          style: AppTheme.bodyStyle(color: AppTheme.muted),
                        ),
                      ),
                    );
                  }

                  return LayoutBuilder(
                    builder: (context, constraints) {
                      final itemWidth = (constraints.maxWidth - 10) / 2;

                      return Wrap(
                        spacing: 10,
                        runSpacing: 10,
                        children: notes.map((note) {
                          return SizedBox(
                            width: itemWidth,
                            child: _NoteCard(note: note),
                          );
                        }).toList(),
                      );
                    },
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  static Widget _chip({
    required String label,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.ink : AppTheme.surface,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: isSelected ? AppTheme.ink : AppTheme.line),
        ),
        child: Text(
          label,
          style: AppTheme.bodyStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: isSelected ? AppTheme.bg : AppTheme.ink,
          ),
        ),
      ),
    );
  }
}

/// 2-Kolonlu Griddeki Not Kartı (SADECE StatelessWidget)
class _NoteCard extends StatelessWidget {
  final NoteModel note;

  const _NoteCard({required this.note});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => _showEditNoteSheet(context, note),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppTheme.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppTheme.line),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              note.title.isNotEmpty ? note.title : 'Untitled',
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: AppTheme.displayStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 6),

            if (note.type == 'list' && note.items.isNotEmpty)
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: note.items.take(4).map((item) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 3),
                    child: Row(
                      children: [
                        Container(
                          width: 10,
                          height: 10,
                          decoration: BoxDecoration(
                            color: item.done ? AppTheme.done : Colors.transparent,
                            borderRadius: BorderRadius.circular(2.5),
                            border: Border.all(
                              color: item.done ? AppTheme.done : AppTheme.muted,
                              width: 1.2,
                            ),
                          ),
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            item.t,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppTheme.bodyStyle(
                              fontSize: 13,
                              color: item.done ? AppTheme.done : AppTheme.ink,
                            ).copyWith(
                              decoration: item.done ? TextDecoration.lineThrough : null,
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              )
            else
              Text(
                note.body,
                maxLines: 5,
                overflow: TextOverflow.ellipsis,
                style: AppTheme.bodyStyle(
                  fontSize: 13.5,
                  color: AppTheme.muted,
                ),
              ),
          ],
        ),
      ),
    );
  }

  void _showEditNoteSheet(BuildContext context, NoteModel note) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => NoteSheetModal(note: note),
    );
  }
}

/// Not Ekleme / Düzenleme Modal Sheet
class NoteSheetModal extends StatelessWidget {
  final NoteModel? note;
  final String noteType;

  const NoteSheetModal({super.key, this.note, this.noteType = 'text'});

  @override
  Widget build(BuildContext context) {
    final isNew = note == null;
    final type = note?.type ?? noteType;
    final titleCtrl = TextEditingController(text: note?.title ?? '');
    final bodyCtrl = TextEditingController(text: note?.body ?? '');

    return Container(
      padding: EdgeInsets.only(
        top: 20,
        left: 20,
        right: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      decoration: const BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            isNew
                ? (type == 'list' ? 'New checklist' : 'New note')
                : 'Edit note',
            style: AppTheme.displayStyle(fontSize: 22),
          ),
          const SizedBox(height: 16),

          Text(
            'TITLE',
            style: AppTheme.bodyStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: AppTheme.muted,
            ),
          ),
          const SizedBox(height: 6),
          TextField(
            controller: titleCtrl,
            autofocus: isNew,
            decoration: _inputDecoration(type == 'list' ? 'e.g. Shopping list' : 'e.g. Where I parked'),
          ),
          const SizedBox(height: 12),

          Text(
            type == 'list' ? 'ITEMS' : 'NOTE',
            style: AppTheme.bodyStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: AppTheme.muted,
            ),
          ),
          const SizedBox(height: 6),
          TextField(
            controller: bodyCtrl,
            maxLines: 5,
            decoration: _inputDecoration(type == 'list' ? 'Add items separated by commas or lines' : 'Write anything…'),
          ),
          const SizedBox(height: 20),

          // Actions
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              if (!isNew)
                TextButton(
                  onPressed: () {
                    NotesViewModel.instance.deleteNote(note!.id);
                    Navigator.pop(context);
                  },
                  child: const Text('Delete', style: TextStyle(color: AppTheme.danger)),
                ),
              const Spacer(),
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancel', style: TextStyle(color: AppTheme.muted)),
              ),
              const SizedBox(width: 8),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.accent,
                  foregroundColor: AppTheme.accentInk,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                ),
                onPressed: () {
                  final t = titleCtrl.text.trim();
                  final b = bodyCtrl.text.trim();
                  if (t.isNotEmpty || b.isNotEmpty) {
                    if (isNew) {
                      NotesViewModel.instance.addNote(
                        title: t.isEmpty ? 'Untitled' : t,
                        body: b,
                      );
                    } else {
                      NotesViewModel.instance.notes.value = NotesViewModel.instance.notes.value.map((n) {
                        return n.id == note!.id ? n.copyWith(title: t, body: b) : n;
                      }).toList();
                    }
                    Navigator.pop(context);
                  }
                },
                child: const Text('Save', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ],
      ),
    );
  }

  static InputDecoration _inputDecoration(String hint) {
    return InputDecoration(
      hintText: hint,
      filled: true,
      fillColor: AppTheme.bg,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppTheme.line),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppTheme.line),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppTheme.accent, width: 1.5),
      ),
    );
  }
}
