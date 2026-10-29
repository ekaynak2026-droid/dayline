import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  // Dayline Exact Color Tokens
  static const Color bg = Color(0xFFEDF0F3);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color ink = Color(0xFF14212B);
  static const Color muted = Color(0xFF5D6B77);
  static const Color line = Color(0xFFD9DFE5);
  static const Color accent = Color(0xFF2F5BEA);
  static const Color accentInk = Color(0xFFFFFFFF);
  static const Color sun = Color(0xFFFFC93C);
  static const Color sunSoft = Color(0xFFFFF5D6);
  static const Color sunInk = Color(0xFF5A4300);
  static const Color done = Color(0xFF98A3AD);
  static const Color danger = Color(0xFFC2362B);

  // Swatch / Category Colors (c1, c2, c3, c4)
  static const Color c1 = Color(0xFF2F5BEA);
  static const Color c2 = Color(0xFF1E9668);
  static const Color c3 = Color(0xFFDB5F33);
  static const Color c4 = Color(0xFF8650D6);

  static const List<Color> swatchColors = [c1, c2, c3, c4];

  // Box shadow token
  static final List<BoxShadow> cardShadow = [
    BoxShadow(
      color: const Color(0xFF14212B).withValues(alpha: 0.10),
      blurRadius: 20,
      offset: const Offset(0, 8),
    ),
  ];

  static TextStyle displayStyle({
    double fontSize = 24,
    FontWeight fontWeight = FontWeight.w800,
    Color color = ink,
    double letterSpacing = -0.02,
  }) {
    return GoogleFonts.bricolageGrotesque(
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: color,
      letterSpacing: letterSpacing,
    );
  }

  static TextStyle bodyStyle({
    double fontSize = 15,
    FontWeight fontWeight = FontWeight.w400,
    Color color = ink,
  }) {
    return GoogleFonts.figtree(
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: color,
    );
  }

  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      scaffoldBackgroundColor: bg,
      colorScheme: const ColorScheme.light(
        primary: accent,
        surface: surface,
        onSurface: ink,
      ),
      textTheme: GoogleFonts.figtreeTextTheme().apply(
        bodyColor: ink,
        displayColor: ink,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: bg,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
      ),
    );
  }
}
