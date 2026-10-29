import 'package:flutter/material.dart';
import 'package:signals_flutter/signals_flutter.dart';
import 'package:intl/intl.dart';
import '../../core/theme/app_theme.dart';
import '../../models/event_model.dart';
import '../../viewmodels/calendar_viewmodel.dart';
import '../../viewmodels/task_viewmodel.dart';
import '../../viewmodels/navigation_viewmodel.dart';

/// Dayline Orijinal Tasarımlı Calendar Ekranı (SADECE StatelessWidget)
class CalendarView extends StatelessWidget {
  const CalendarView({super.key});

  @override
  Widget build(BuildContext context) {
    final vm = CalendarViewModel.instance;
    final taskVm = TaskViewModel.instance;
    final nav = NavigationViewModel.instance;

    // Ay takibi için signal (Yıl ve Ay)
    final now = DateTime.now();
    final calYear = signal<int>(now.year);
    final calMonth = signal<int>(now.month);

    return Scaffold(
      backgroundColor: AppTheme.bg,
      body: SafeArea(
        bottom: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header: Month, Year, and Nav Arrows
              SignalBuilder(
                builder: (context) {
                  final y = calYear.value;
                  final m = calMonth.value;
                  final monthName = DateFormat('MMMM').format(DateTime(y, m));

                  return Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      RichText(
                        text: TextSpan(
                          children: [
                            TextSpan(
                              text: '$monthName ',
                              style: AppTheme.displayStyle(fontSize: 30, fontWeight: FontWeight.w800),
                            ),
                            TextSpan(
                              text: '$y',
                              style: AppTheme.displayStyle(
                                fontSize: 30,
                                fontWeight: FontWeight.w600,
                                color: AppTheme.muted,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Row(
                        children: [
                          _navButton(
                            icon: Icons.chevron_left,
                            onTap: () {
                              if (m == 1) {
                                calYear.value = y - 1;
                                calMonth.value = 12;
                              } else {
                                calMonth.value = m - 1;
                              }
                            },
                          ),
                          const SizedBox(width: 4),
                          _navButton(
                            icon: Icons.chevron_right,
                            onTap: () {
                              if (m == 12) {
                                calYear.value = y + 1;
                                calMonth.value = 1;
                              } else {
                                calMonth.value = m + 1;
                              }
                            },
                          ),
                        ],
                      ),
                    ],
                  );
                },
              ),
              const SizedBox(height: 14),

              // Weekday Labels
              Row(
                children: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((w) {
                  return Expanded(
                    child: Text(
                      w,
                      textAlign: TextAlign.center,
                      style: AppTheme.bodyStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.muted,
                      ),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 8),

              // Calendar Grid (7 Kolon)
              SignalBuilder(
                builder: (context) {
                  final y = calYear.value;
                  final m = calMonth.value;
                  final firstDay = DateTime(y, m, 1);
                  final offset = (firstDay.weekday - 1) % 7; // Pazartesi 0
                  final totalDaysInMonth = DateTime(y, m + 1, 0).day;
                  final weeks = ((offset + totalDaysInMonth) / 7).ceil();

                  final start = firstDay.subtract(Duration(days: offset));
                  final selectedIso = vm.selectedDate.value;
                  final todayIso = TaskViewModel.instance.todayIso.value;
                  final allEvents = vm.events.value;

                  return Column(
                    children: List.generate(weeks, (weekIdx) {
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 3),
                        child: Row(
                          children: List.generate(7, (dayIdx) {
                            final cellDate = start.add(Duration(days: weekIdx * 7 + dayIdx));
                            final cellIso = _formatIso(cellDate);
                            final isOut = cellDate.month != m;
                            final isToday = cellIso == todayIso;
                            final isSelected = cellIso == selectedIso;
                            final cellEvents = allEvents.where((e) => e.date == cellIso).toList();

                            return Expanded(
                              child: GestureDetector(
                                onTap: () {
                                  vm.selectDate(cellIso);
                                  if (cellDate.month != m) {
                                    calYear.value = cellDate.year;
                                    calMonth.value = cellDate.month;
                                  }
                                },
                                child: Container(
                                  height: 70,
                                  margin: const EdgeInsets.symmetric(horizontal: 1.5),
                                  padding: const EdgeInsets.all(4),
                                  decoration: BoxDecoration(
                                    color: AppTheme.surface,
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(
                                      color: isSelected ? AppTheme.accent : Colors.transparent,
                                      width: 2,
                                    ),
                                  ),
                                  child: Opacity(
                                    opacity: isOut ? 0.4 : 1.0,
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.stretch,
                                      children: [
                                        // Day number badge
                                        Center(
                                          child: Container(
                                            width: 24,
                                            height: 24,
                                            alignment: Alignment.center,
                                            decoration: BoxDecoration(
                                              color: isToday ? AppTheme.sun : Colors.transparent,
                                              shape: BoxShape.circle,
                                            ),
                                            child: Text(
                                              '${cellDate.day}',
                                              style: TextStyle(
                                                fontSize: 13,
                                                fontWeight: isToday ? FontWeight.w800 : FontWeight.w600,
                                                color: isToday ? const Color(0xFF3A2C00) : AppTheme.ink,
                                              ),
                                            ),
                                          ),
                                        ),
                                        const SizedBox(height: 2),

                                        // Events indicators (up to 2)
                                        ...cellEvents.take(2).map((ev) {
                                          final swatchColor =
                                              AppTheme.swatchColors[(ev.color - 1).clamp(0, 3)];
                                          return Container(
                                            margin: const EdgeInsets.only(bottom: 1.5),
                                            padding: const EdgeInsets.symmetric(horizontal: 3, vertical: 1),
                                            decoration: BoxDecoration(
                                              color: swatchColor.withValues(alpha: 0.18),
                                              borderRadius: BorderRadius.circular(3),
                                              border: Border(
                                                left: BorderSide(color: swatchColor, width: 2.5),
                                              ),
                                            ),
                                            child: Text(
                                              ev.title,
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                              style: const TextStyle(
                                                fontSize: 9,
                                                fontWeight: FontWeight.w600,
                                                color: AppTheme.ink,
                                              ),
                                            ),
                                          );
                                        }),
                                        if (cellEvents.length > 2)
                                          Text(
                                            '+${cellEvents.length - 2} more',
                                            textAlign: TextAlign.center,
                                            style: const TextStyle(fontSize: 9, color: AppTheme.muted),
                                          ),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            );
                          }),
                        ),
                      );
                    }),
                  );
                },
              ),
              const SizedBox(height: 18),

              // Agenda Section
              SignalBuilder(
                builder: (context) {
                  final selIso = vm.selectedDate.value;
                  final todayIso = TaskViewModel.instance.todayIso.value;
                  final selDate = DateTime.tryParse(selIso) ?? DateTime.now();
                  final selEvents = vm.eventsForSelectedDate.value;
                  final openTasks =
                      taskVm.tasks.value.where((t) => t.date == selIso && !t.done).length;

                  final title = (selIso == todayIso ? 'Today, ' : '') +
                      DateFormat('EEEE, d MMMM').format(selDate);

                  return Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppTheme.surface,
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: AppTheme.cardShadow,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          style: AppTheme.displayStyle(fontSize: 19, fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(height: 8),

                        if (selEvents.isEmpty)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            child: Text(
                              'Nothing pinned on this day yet.',
                              style: AppTheme.bodyStyle(fontSize: 14, color: AppTheme.muted),
                            ),
                          )
                        else
                          ...selEvents.map((ev) {
                            final swatchColor =
                                AppTheme.swatchColors[(ev.color - 1).clamp(0, 3)];
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
                                      ev.title,
                                      style: AppTheme.bodyStyle(fontWeight: FontWeight.w600),
                                    ),
                                  ),
                                  Text(
                                    ev.time ?? 'All day',
                                    style: AppTheme.bodyStyle(fontSize: 13, color: AppTheme.muted),
                                  ),
                                ],
                              ),
                            );
                          }),

                        const SizedBox(height: 12),

                        // Action Links
                        Wrap(
                          spacing: 16,
                          runSpacing: 8,
                          children: [
                            GestureDetector(
                              onTap: () => _showAddEventSheet(context, selIso),
                              child: Text(
                                '+ Add event',
                                style: AppTheme.bodyStyle(
                                  fontWeight: FontWeight.w700,
                                  color: AppTheme.accent,
                                ),
                              ),
                            ),
                            if (openTasks > 0)
                              GestureDetector(
                                onTap: () => nav.setTab(AppTab.tasks),
                                child: Text(
                                  'See $openTasks open task${openTasks > 1 ? 's' : ''}',
                                  style: AppTheme.bodyStyle(
                                    fontWeight: FontWeight.w700,
                                    color: AppTheme.accent,
                                  ),
                                ),
                              ),
                            if (selIso != todayIso)
                              GestureDetector(
                                onTap: () {
                                  vm.selectDate(todayIso);
                                  final now = DateTime.now();
                                  calYear.value = now.year;
                                  calMonth.value = now.month;
                                },
                                child: Text(
                                  'Back to today',
                                  style: AppTheme.bodyStyle(
                                    fontWeight: FontWeight.w700,
                                    color: AppTheme.accent,
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ],
                    ),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  static Widget _navButton({required IconData icon, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: AppTheme.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppTheme.line),
        ),
        child: Icon(icon, size: 18, color: AppTheme.ink),
      ),
    );
  }

  static String _formatIso(DateTime d) {
    final y = d.year;
    final m = d.month.toString().padLeft(2, '0');
    final day = d.day.toString().padLeft(2, '0');
    return '$y-$m-$day';
  }

  void _showAddEventSheet(BuildContext context, String date) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => EventSheetModal(initialDate: date),
    );
  }
}

/// Event Ekleme / Düzenleme Sheet
class EventSheetModal extends StatelessWidget {
  final EventModel? event;
  final String? initialDate;

  const EventSheetModal({super.key, this.event, this.initialDate});

  @override
  Widget build(BuildContext context) {
    final isNew = event == null;
    final titleCtrl = TextEditingController(text: event?.title ?? '');
    final dateCtrl = TextEditingController(
      text: event?.date ?? initialDate ?? CalendarViewModel.instance.selectedDate.value,
    );
    final timeCtrl = TextEditingController(text: event?.time ?? '');
    final colorSignal = signal<int>(event?.color ?? 1);

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
            isNew ? 'New event' : 'Edit event',
            style: AppTheme.displayStyle(fontSize: 22),
          ),
          const SizedBox(height: 16),

          Text(
            'EVENT',
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
            decoration: _inputDecoration('e.g. Dentist, Birthday, Flight'),
          ),
          const SizedBox(height: 12),

          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'DATE',
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
                      'TIME (EMPTY = ALL DAY)',
                      style: AppTheme.bodyStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.muted,
                      ),
                    ),
                    const SizedBox(height: 6),
                    TextField(
                      controller: timeCtrl,
                      decoration: _inputDecoration('e.g. 15:00'),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Swatches
          Text(
            'COLOUR',
            style: AppTheme.bodyStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: AppTheme.muted,
            ),
          ),
          const SizedBox(height: 8),
          SignalBuilder(
            builder: (context) {
              final selectedColor = colorSignal.value;
              return Row(
                children: List.generate(4, (index) {
                  final colorIdx = index + 1;
                  final color = AppTheme.swatchColors[index];
                  final isSel = selectedColor == colorIdx;

                  return GestureDetector(
                    onTap: () => colorSignal.value = colorIdx,
                    child: Container(
                      width: 32,
                      height: 32,
                      margin: const EdgeInsets.only(right: 10),
                      decoration: BoxDecoration(
                        color: color,
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: isSel ? AppTheme.ink : AppTheme.surface,
                          width: isSel ? 2 : 1,
                        ),
                      ),
                    ),
                  );
                }),
              );
            },
          ),
          const SizedBox(height: 20),

          // Actions
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              if (!isNew)
                TextButton(
                  onPressed: () {
                    CalendarViewModel.instance.deleteEvent(event!.id);
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
                  final txt = titleCtrl.text.trim();
                  if (txt.isNotEmpty) {
                    CalendarViewModel.instance.addEvent(
                      title: txt,
                      date: dateCtrl.text.trim(),
                      time: timeCtrl.text.trim().isEmpty ? null : timeCtrl.text.trim(),
                      color: colorSignal.value,
                    );
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
