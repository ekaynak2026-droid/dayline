import 'package:signals_flutter/signals_flutter.dart';

enum AppTab { tasks, calendar, notes }

class NavigationViewModel {
  static final NavigationViewModel instance = NavigationViewModel._internal();
  NavigationViewModel._internal();

  final currentTab = signal<AppTab>(AppTab.tasks);

  void setTab(AppTab tab) {
    currentTab.value = tab;
  }
}

