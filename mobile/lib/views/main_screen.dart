import 'package:flutter/material.dart';
import 'package:signals_flutter/signals_flutter.dart';
import '../core/theme/app_theme.dart';
import '../viewmodels/navigation_viewmodel.dart';
import 'tasks/tasks_view.dart';
import 'calendar/calendar_view.dart';
import 'notes/notes_view.dart';

/// Dayline Ana Ekranı (SADECE StatelessWidget)
class MainScreen extends StatelessWidget {
  const MainScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final nav = NavigationViewModel.instance;

    return SignalBuilder(
      builder: (context) {
        final currentTab = nav.currentTab.value;

        return Scaffold(
          backgroundColor: AppTheme.bg,
          body: Stack(
            children: [
              // Active Tab View
              switch (currentTab) {
                AppTab.tasks => const TasksView(),
                AppTab.calendar => const CalendarView(),
                AppTab.notes => const NotesView(),
              },

              // FAB (Round Square Floating Action Button - 58x58, radius 20)
              Positioned(
                right: 18,
                bottom: 84 + MediaQuery.of(context).padding.bottom,
                child: GestureDetector(
                  onTap: () => _handleFabTap(context, currentTab),
                  child: Container(
                    width: 58,
                    height: 58,
                    decoration: BoxDecoration(
                      color: AppTheme.accent,
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: AppTheme.cardShadow,
                    ),
                    child: const Icon(
                      Icons.add,
                      size: 28,
                      color: AppTheme.accentInk,
                    ),
                  ),
                ),
              ),

              // Bottom Tab Bar
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: Container(
                  decoration: const BoxDecoration(
                    color: AppTheme.surface,
                    border: Border(top: BorderSide(color: AppTheme.line, width: 1)),
                  ),
                  padding: EdgeInsets.only(
                    bottom: MediaQuery.of(context).padding.bottom,
                    top: 6,
                  ),
                  child: Row(
                    children: [
                      _tabItem(
                        icon: Icons.checklist_rtl_rounded,
                        label: 'Tasks',
                        isActive: currentTab == AppTab.tasks,
                        onTap: () => nav.setTab(AppTab.tasks),
                      ),
                      _tabItem(
                        icon: Icons.calendar_month_outlined,
                        label: 'Calendar',
                        isActive: currentTab == AppTab.calendar,
                        onTap: () => nav.setTab(AppTab.calendar),
                      ),
                      _tabItem(
                        icon: Icons.description_outlined,
                        label: 'Notes',
                        isActive: currentTab == AppTab.notes,
                        onTap: () => nav.setTab(AppTab.notes),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  static Widget _tabItem({
    required IconData icon,
    required String label,
    required bool isActive,
    required VoidCallback onTap,
  }) {
    return Expanded(
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                icon,
                size: 24,
                color: isActive ? AppTheme.accent : AppTheme.muted,
              ),
              const SizedBox(height: 2),
              Text(
                label,
                style: AppTheme.bodyStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: isActive ? AppTheme.accent : AppTheme.muted,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _handleFabTap(BuildContext context, AppTab tab) {
    if (tab == AppTab.tasks) {
      showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (ctx) => const TaskSheetModal(),
      );
    } else if (tab == AppTab.calendar) {
      showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (ctx) => const EventSheetModal(),
      );
    } else if (tab == AppTab.notes) {
      _showNoteChoiceSheet(context);
    }
  }

  void _showNoteChoiceSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 36),
          decoration: const BoxDecoration(
            color: AppTheme.surface,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'New note',
                style: AppTheme.displayStyle(fontSize: 22),
              ),
              const SizedBox(height: 16),

              _choiceTile(
                icon: Icons.subject_rounded,
                title: 'Text note',
                subtitle: 'Anything to remember for later',
                onTap: () {
                  Navigator.pop(ctx);
                  showModalBottomSheet(
                    context: context,
                    isScrollControlled: true,
                    backgroundColor: Colors.transparent,
                    builder: (_) => const NoteSheetModal(noteType: 'text'),
                  );
                },
              ),
              const SizedBox(height: 10),

              _choiceTile(
                icon: Icons.checklist_rounded,
                title: 'Checklist',
                subtitle: 'Shopping lists, packing lists, things to buy',
                onTap: () {
                  Navigator.pop(ctx);
                  showModalBottomSheet(
                    context: context,
                    isScrollControlled: true,
                    backgroundColor: Colors.transparent,
                    builder: (_) => const NoteSheetModal(noteType: 'list'),
                  );
                },
              ),
            ],
          ),
        );
      },
    );
  }

  static Widget _choiceTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppTheme.bg,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppTheme.line),
        ),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: AppTheme.surface,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: AppTheme.accent, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: AppTheme.bodyStyle(fontWeight: FontWeight.bold),
                  ),
                  Text(
                    subtitle,
                    style: AppTheme.bodyStyle(fontSize: 13.5, color: AppTheme.muted),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
