import 'package:flutter/material.dart';
import 'tokens.dart';

export 'tokens.dart';

// Legacy names kept so existing screens keep compiling; they now map onto the
// «رژیم من» palette (see tokens.dart for the full set).
const pine = AppColors.emeraldDeep,
    cream = AppColors.bg,
    sage = AppColors.mint;
const ink = AppColors.ink, muted = AppColors.muted, amber = Color(0xFFB7791F);

const _font = 'Vazirmatn';

/// Light theme of «رژیم من».
ThemeData appTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: AppColors.emerald,
    brightness: Brightness.light,
    primary: AppColors.emeraldDeep,
    onPrimary: Colors.white,
    secondary: AppColors.lime,
    onSecondary: AppColors.ink,
    tertiary: AppColors.amber,
    surface: AppColors.surface,
    onSurface: AppColors.ink,
    error: AppColors.danger,
  );
  const radius = AppRadius.md;
  OutlineInputBorder border(Color c, [double w = 1]) => OutlineInputBorder(
    borderRadius: BorderRadius.circular(radius),
    borderSide: BorderSide(color: c, width: w),
  );
  return ThemeData(
    useMaterial3: true,
    fontFamily: _font,
    scaffoldBackgroundColor: AppColors.bg,
    colorScheme: scheme,
    textTheme: const TextTheme(
      displaySmall: TextStyle(
        fontSize: 36,
        fontWeight: FontWeight.bold,
        color: ink,
        height: 1.5,
      ),
      headlineLarge: TextStyle(
        fontSize: 30,
        fontWeight: FontWeight.bold,
        color: ink,
        height: 1.6,
      ),
      headlineMedium: TextStyle(
        fontSize: 24,
        fontWeight: FontWeight.bold,
        color: ink,
        height: 1.6,
      ),
      titleLarge: TextStyle(
        fontSize: 20,
        fontWeight: FontWeight.bold,
        color: ink,
        height: 1.7,
      ),
      titleMedium: TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.bold,
        color: ink,
        height: 1.7,
      ),
      bodyLarge: TextStyle(fontSize: 15, color: ink, height: 1.8),
      bodyMedium: TextStyle(fontSize: 13, color: ink, height: 1.8),
      bodySmall: TextStyle(fontSize: 11, color: muted, height: 1.8),
      labelLarge: TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.bold,
        height: 1.7,
      ),
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.bg,
      foregroundColor: ink,
      surfaceTintColor: Colors.transparent,
      centerTitle: false,
      elevation: 0,
      scrolledUnderElevation: 0,
      titleTextStyle: TextStyle(
        fontFamily: _font,
        fontSize: 20,
        fontWeight: FontWeight.bold,
        color: ink,
      ),
    ),
    cardTheme: CardThemeData(
      color: Colors.white,
      elevation: 0,
      margin: EdgeInsets.zero,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: AppRadius.card),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: pine,
        foregroundColor: Colors.white,
        minimumSize: const Size(0, 54),
        shape: const StadiumBorder(),
        textStyle: const TextStyle(
          fontFamily: _font,
          fontSize: 14,
          fontWeight: FontWeight.bold,
        ),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: pine,
        minimumSize: const Size(0, 50),
        side: const BorderSide(color: Color(0xFFCFE3D6)),
        shape: const StadiumBorder(),
        textStyle: const TextStyle(
          fontFamily: _font,
          fontWeight: FontWeight.bold,
        ),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: pine,
        shape: const StadiumBorder(),
        textStyle: const TextStyle(
          fontFamily: _font,
          fontWeight: FontWeight.bold,
        ),
      ),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: Colors.white,
      selectedColor: AppColors.mint,
      side: const BorderSide(color: AppColors.line),
      shape: const StadiumBorder(),
      labelStyle: const TextStyle(fontFamily: _font, fontSize: 12, color: ink),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      border: border(AppColors.line),
      enabledBorder: border(AppColors.line),
      focusedBorder: border(AppColors.emerald, 1.6),
      labelStyle: const TextStyle(color: muted, fontSize: 13),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: AppColors.ink,
      contentTextStyle: const TextStyle(
        fontFamily: _font,
        color: Colors.white,
        height: 1.6,
      ),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: AppColors.surface,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: AppRadius.sheet),
      showDragHandle: true,
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(
      color: AppColors.emerald,
      linearTrackColor: AppColors.mint,
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      indicatorColor: sage,
      labelTextStyle: WidgetStateProperty.resolveWith(
        (s) => TextStyle(
          fontFamily: _font,
          fontSize: 11,
          color: s.contains(WidgetState.selected) ? pine : muted,
          fontWeight: s.contains(WidgetState.selected)
              ? FontWeight.bold
              : FontWeight.normal,
        ),
      ),
    ),
    dividerTheme: const DividerThemeData(
      color: AppColors.line,
      space: 24,
      thickness: 1,
    ),
  );
}
