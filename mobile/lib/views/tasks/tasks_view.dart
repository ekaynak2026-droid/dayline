import 'package:flutter/material.dart';
import 'package:signals_flutter/signals_flutter.dart';
import 'package:intl/intl.dart';
import '../../core/theme/app_theme.dart';
import '../../models/task_model.dart';
import '../../models/event_model.dart';
import '../../viewmodels/task_viewmodel.dart';
import '../../viewmodels/calendar_viewmodel.dart';

/// Dayline Orijinal Tasarımlı Tasks Ekranı (SADECE StatelessWidget)
class TasksView extends StatelessWidget {
  final ScrollController? scrollController;

  const TasksView({super.key, this.scrollController});

  @override
  Widget build(BuildContext context) {
    final vm = TaskViewModel.instance;
    final calVm = CalendarViewModel.instance;

    return Scaffold(
      backgroundColor: AppTheme.bg,
      body: SafeArea(
        bottom: false,
        child: CustomScrollView(
          controller: scrollController,
          slivers: [
            // Top App Bar
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 10),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Tasks',
                      style: AppTheme.displayStyle(fontSize: 30, fontWeight: FontWeight.w800),
                    ),
                    Row(
                      children: [
                        // Today button
                        GestureDetector(
                          onTap: () {
                            if (scrollController?.hasClients == true) {
                              scrollController!.animateTo(
                                0,
                                duration: const Duration(milliseconds: 300),
                                curve: Curves.easeOut,
                              );
                            }
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                            decoration: BoxDecoration(
                              color: AppTheme.surface,
                              borderRadius: BorderRadius.circular(999),
                              border: Border.all(color: AppTheme.line),
                            ),
                            child: Text(
                              'Today',
                              style: AppTheme.bodyStyle(fontSize: 14, fontWeight: FontWeight.w600),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        // Settings Gear button
                        Container(
                          width: 38,
                          height: 38,
                          decoration: BoxDecoration(
                            color: AppTheme.surface,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: AppTheme.line),
                          ),
                          child: const Icon(Icons.settings_outlined, size: 20, color: AppTheme.muted),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            // Timeline Days
            SignalBuilder(
              builder: (context) {
                final days = vm.dayKeys.value;
                final allTasks = vm.tasks.value;
                final allEvents = calVm.events.value;
                final todayStr = vm.todayIso.value;
                final overdue = vm.overdueCount.value;

                return SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) {
                      final dateKey = days[index];
                      final isToday = dateKey == todayStr;
                      final date = DateTime.tryParse(dateKey) ?? DateTime.now();
                      final now = DateTime.now();
                      final todayDate = DateTime(now.year, now.month, now.day);
                      final diffDays = DateTime(date.year, date.month, date.day).difference(todayDate).inDays;
                      final isPast = diffDays < 0;

                      final dayTasks = allTasks.where((t) => t.date == dateKey).toList()
                        ..sort((a, b) => (a.time ?? '99').compareTo(b.time ?? '99'));

                      final dayEvents = allEvents.where((e) => e.date == dateKey).toList()
                        ..sort((a, b) => (a.time ?? '99').compareTo(b.time ?? '99'));

                      String name = diffDays == 0
                          ? 'Today'
                          : diffDays == 1
                              ? 'Tomorrow'
                              : diffDays == -1
                                  ? 'Yesterday'
                                  : DateFormat('EEEE').format(date);

                      String sub = diffDays.abs() <= 1
                          ? DateFormat('E, d MMM').format(date)
                          : DateFormat('d MMMM').format(date);

                      return _DaySection(
                        dateKey: dateKey,
                        name: name,
                        sub: sub,
                        isToday: isToday,
                        isPast: isPast,
                        overdue: isToday ? overdue : 0,
                        tasks: dayTasks,
                        events: dayEvents,
                      );
                    },
                    childCount: days.length,
                  ),
                );
              },
            ),

            // Bottom padding for FAB and Nav Bar
            const SliverToBoxAdapter(child: SizedBox(height: 100)),
          ],
        ),
      ),
    );
  }
}

/// Her bir günü temsil eden bölüm (SADECE StatelessWidget)
class _DaySection extends StatelessWidget {
  final String dateKey;
  final String name;
  final String sub;
  final bool isToday;
  final bool isPast;
  final int overdue;
  final List<TaskModel> tasks;
  final List<EventModel> events;

  const _DaySection({
    required this.dateKey,
    required this.name,
    required this.sub,
    required this.isToday,
    required this.isPast,
    required this.overdue,
    required this.tasks,
    required this.events,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: isToday
          ? const EdgeInsets.symmetric(horizontal: 16, vertical: 8)
          : const EdgeInsets.symmetric(horizontal: 16),
      padding: isToday
          ? const EdgeInsets.fromLTRB(16, 16, 16, 10)
          : const EdgeInsets.symmetric(vertical: 8),
      decoration: BoxDecoration(
        color: isToday ? AppTheme.surface : Colors.transparent,
        borderRadius: isToday ? BorderRadius.circular(20) : null,
        boxShadow: isToday ? AppTheme.cardShadow : null,
        border: !isToday
            ? const Border(bottom: BorderSide(color: AppTheme.line, width: 1))
            : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Day Header
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                name,
                style: AppTheme.displayStyle(
                  fontSize: isToday ? 28 : 18,
                  fontWeight: isToday ? FontWeight.w800 : FontWeight.w600,
                  color: isPast ? AppTheme.muted : AppTheme.ink,
                ),
              ),
              const SizedBox(width: 8),
              if (isToday)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppTheme.sun,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    sub,
                    style: AppTheme.bodyStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFF3A2C00),
                    ),
                  ),
                )
              else
                Text(
                  sub,
                  style: AppTheme.bodyStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: AppTheme.muted,
                  ),
                ),
            ],
          ),

          // Overdue Banner
          if (isToday && overdue > 0)
            Container(
              margin: const EdgeInsets.symmetric(vertical: 8),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
              decoration: BoxDecoration(
                color: AppTheme.sunSoft,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '$overdue unfinished from earlier days',
                    style: AppTheme.bodyStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.sunInk,
                    ),
                  ),
                  GestureDetector(
                    onTap: () => TaskViewModel.instance.moveOverdueToToday(),
                    child: Text(
                      'Move to today',
                      style: AppTheme.bodyStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.sunInk,
                      ).copyWith(decoration: TextDecoration.underline),
                    ),
                  ),
                ],
              ),
            ),

          // Events
          ...events.map((ev) => _EventRow(event: ev)),

          // Tasks
          ...tasks.map((t) => _TaskRow(task: t)),

          // Inline Quick Add
          _InlineAddTask(dateKey: dateKey, isToday: isToday),
        ],
      ),
    );
  }
}

/// Etkinlik Satırı
class _EventRow extends StatelessWidget {
  final EventModel event;

  const _EventRow({required this.event});

  @override
  Widget build(BuildContext context) {
    final swatchColor = AppTheme.swatchColors[(event.color - 1).clamp(0, 3)];

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppTheme.line, width: 0.5)),
      ),
      child: Row(
        children: [
          Container(
            width: 24,
            height: 6,
            decoration: BoxDecoration(
              color: swatchColor,
              borderRadius: BorderRadius.circular(3),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              event.title,
              style: AppTheme.bodyStyle(fontWeight: FontWeight.w600),
            ),
          ),
          if (event.time != null && event.time!.isNotEmpty)
            Text(
              event.time!,
              style: AppTheme.bodyStyle(fontSize: 13, color: AppTheme.muted),
            ),
        ],
      ),
    );
  }
}

/// Görev Satırı (Dayline kare checkbox stili)
class _TaskRow extends StatelessWidget {
  final TaskModel task;

  const _TaskRow({required this.task});

  @override
  Widget build(BuildContext context) {
    final vm = TaskViewModel.instance;

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppTheme.line, width: 0.5)),
      ),
      child: Row(
        children: [
          // Square Checkbox
          GestureDetector(
            onTap: () => vm.toggleTask(task.id),
            child: Container(
              width: 24,
              height: 24,
              decoration: BoxDecoration(
                color: task.done ? AppTheme.accent : Colors.transparent,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: task.done ? AppTheme.accent : AppTheme.muted,
                  width: 2,
                ),
              ),
              child: task.done
                  ? const Icon(Icons.check, size: 16, color: AppTheme.accentInk)
                  : null,
            ),
          ),
          const SizedBox(width: 12),

          // Title
          Expanded(
            child: GestureDetector(
              onTap: () => _showTaskSheet(context, task),
              child: Text(
                task.text,
                style: AppTheme.bodyStyle(
                  color: task.done ? AppTheme.done : AppTheme.ink,
                ).copyWith(
                  decoration: task.done ? TextDecoration.lineThrough : null,
                ),
              ),
            ),
          ),

          // Bell reminder icon
          if (task.remind != null && task.remind!.isNotEmpty)
            const Padding(
              padding: EdgeInsets.only(right: 6),
              child: Icon(Icons.notifications_none, size: 16, color: AppTheme.muted),
            ),

          // Time
          if (task.time != null && task.time!.isNotEmpty)
            Text(
              task.time!,
              style: AppTheme.bodyStyle(fontSize: 13, color: AppTheme.muted),
            ),
        ],
      ),
    );
  }

  void _showTaskSheet(BuildContext context, TaskModel task) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => TaskSheetModal(task: task),
    );
  }
}

/// Satır içi hızlı görev ekleme
class _InlineAddTask extends StatelessWidget {
  final String dateKey;
  final bool isToday;

  const _InlineAddTask({required this.dateKey, required this.isToday});

  @override
  Widget build(BuildContext context) {
    final controller = TextEditingController();

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          const SizedBox(
            width: 24,
            child: Text(
              '+',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 20, color: AppTheme.muted, height: 1),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: TextField(
              controller: controller,
              style: AppTheme.bodyStyle(),
              decoration: InputDecoration(
                border: InputBorder.none,
                isDense: true,
                hintText: isToday ? 'Add a task for today' : 'Add a task',
                hintStyle: AppTheme.bodyStyle(color: AppTheme.muted),
              ),
              onSubmitted: (val) {
                if (val.trim().isNotEmpty) {
                  TaskViewModel.instance.addTask(text: val.trim(), date: dateKey);
                  controller.clear();
                }
              },
            ),
          ),
        ],
      ),
    );
  }
}

/// Task Ekleme / Düzenleme Modal Sheet (SADECE StatelessWidget)
class TaskSheetModal extends StatelessWidget {
  final TaskModel? task;
  final String? initialDate;

  const TaskSheetModal({super.key, this.task, this.initialDate});

  @override
  Widget build(BuildContext context) {
    final isNew = task == null;
    final textCtrl = TextEditingController(text: task?.text ?? '');
    final dateCtrl = TextEditingController(
      text: task?.date ?? initialDate ?? TaskViewModel.instance.todayIso.value,
    );
    final timeCtrl = TextEditingController(text: task?.time ?? '');

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
            isNew ? 'New task' : 'Edit task',
            style: AppTheme.displayStyle(fontSize: 22),
          ),
          const SizedBox(height: 16),

          Text(
            'TASK',
            style: AppTheme.bodyStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: AppTheme.muted,
            ),
          ),
          const SizedBox(height: 6),
          TextField(
            controller: textCtrl,
            autofocus: isNew,
            decoration: _inputDecoration('What do you need to do?'),
          ),
          const SizedBox(height: 12),

          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'DAY',
                      style: AppTheme.bodyStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.muted,
                      ),
                    ),
                    const SizedBox(height: 6),
                    TextField(
                      controller: dateCtrl,
                      decoration: _inputDecoration('YYYY-MM-DD'),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'TIME (OPTIONAL)',
                      style: AppTheme.bodyStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.muted,
                      ),
                    ),
                    const SizedBox(height: 6),
                    TextField(
                      controller: timeCtrl,
                      decoration: _inputDecoration('e.g. 14:30'),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Actions
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              if (!isNew)
                TextButton(
                  onPressed: () {
                    TaskViewModel.instance.deleteTask(task!.id);
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
                  final txt = textCtrl.text.trim();
                  if (txt.isNotEmpty) {
                    if (isNew) {
                      TaskViewModel.instance.addTask(
                        text: txt,
                        date: dateCtrl.text.trim(),
                        time: timeCtrl.text.trim().isEmpty ? null : timeCtrl.text.trim(),
                      );
                    } else {
                      TaskViewModel.instance.updateTask(
                        task!.copyWith(
                          text: txt,
                          date: dateCtrl.text.trim(),
                          time: timeCtrl.text.trim().isEmpty ? null : timeCtrl.text.trim(),
                        ),
                      );
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
