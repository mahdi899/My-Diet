import 'package:flutter/material.dart';

const pine = Color(0xFF205638),
    cream = Color(0xFFF7F8F0),
    sage = Color(0xFFEAF1DC);
const ink = Color(0xFF233C2D),
    muted = Color(0xFF76836E),
    amber = Color(0xFFAC7B24);
ThemeData appTheme() => ThemeData(
  useMaterial3: true,
  fontFamily: 'Vazirmatn',
  scaffoldBackgroundColor: cream,
  colorScheme: ColorScheme.fromSeed(
    seedColor: pine,
    brightness: Brightness.light,
    primary: pine,
    secondary: const Color(0xFF7C9C58),
    surface: Colors.white,
  ),
  textTheme: const TextTheme(
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
      height: 1.6,
    ),
    titleMedium: TextStyle(
      fontSize: 16,
      fontWeight: FontWeight.bold,
      color: ink,
      height: 1.6,
    ),
    bodyLarge: TextStyle(fontSize: 15, color: ink, height: 1.8),
    bodyMedium: TextStyle(fontSize: 13, color: ink, height: 1.8),
    bodySmall: TextStyle(fontSize: 11, color: muted, height: 1.8),
  ),
  appBarTheme: const AppBarTheme(
    backgroundColor: cream,
    foregroundColor: ink,
    surfaceTintColor: Colors.transparent,
    centerTitle: false,
    elevation: 0,
    titleTextStyle: TextStyle(
      fontFamily: 'Vazirmatn',
      fontSize: 20,
      fontWeight: FontWeight.bold,
      color: ink,
    ),
  ),
  filledButtonTheme: FilledButtonThemeData(
    style: FilledButton.styleFrom(
      backgroundColor: pine,
      foregroundColor: Colors.white,
      minimumSize: const Size(0, 52),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
      textStyle: const TextStyle(
        fontFamily: 'Vazirmatn',
        fontSize: 14,
        fontWeight: FontWeight.bold,
      ),
    ),
  ),
  outlinedButtonTheme: OutlinedButtonThemeData(
    style: OutlinedButton.styleFrom(
      foregroundColor: pine,
      minimumSize: const Size(0, 48),
      side: const BorderSide(color: Color(0xFFB7C9A1)),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
    ),
  ),
  inputDecorationTheme: InputDecorationTheme(
    filled: true,
    fillColor: Colors.white,
    contentPadding: const EdgeInsets.all(16),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(15),
      borderSide: const BorderSide(color: Color(0xFFDDE5D4)),
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(15),
      borderSide: const BorderSide(color: Color(0xFFDDE5D4)),
    ),
    labelStyle: const TextStyle(color: muted, fontSize: 13),
  ),
  navigationBarTheme: NavigationBarThemeData(
    backgroundColor: Colors.white,
    indicatorColor: sage,
    labelTextStyle: WidgetStateProperty.resolveWith(
      (s) => TextStyle(
        fontFamily: 'Vazirmatn',
        fontSize: 11,
        color: s.contains(WidgetState.selected) ? pine : muted,
        fontWeight: s.contains(WidgetState.selected)
            ? FontWeight.bold
            : FontWeight.normal,
      ),
    ),
  ),
  dividerTheme: const DividerThemeData(
    color: Color(0xFFE4EADC),
    space: 24,
    thickness: 1,
  ),
);
