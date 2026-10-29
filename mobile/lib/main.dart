import 'package:flutter/material.dart';
import 'core/theme/app_theme.dart';
import 'views/main_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const DaylineApp());
}

/// Dayline Ana Uygulama Kökü (SADECE StatelessWidget)
class DaylineApp extends StatelessWidget {
  const DaylineApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Dayline Checklist',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      home: const MainScreen(),
    );
  }
}
