import 'package:flutter/material.dart';
import 'tokens.dart';

/// Shared Persian type roles. Only the bundled regular and bold weights are
/// used; paragraph leading leaves room for Persian dots and vowel marks.
abstract final class AppTypography {
  static const fontFamily = 'Vazirmatn';
  static const pageTitle = TextStyle(
    fontFamily: fontFamily,
    fontSize: 26,
    height: 1.5,
    fontWeight: FontWeight.bold,
    color: AppColors.ink,
  );
  static const sectionTitle = TextStyle(
    fontFamily: fontFamily,
    fontSize: 18,
    height: 1.6,
    fontWeight: FontWeight.bold,
    color: AppColors.ink,
  );
  static const cardTitle = TextStyle(
    fontFamily: fontFamily,
    fontSize: 16,
    height: 1.6,
    fontWeight: FontWeight.bold,
    color: AppColors.ink,
  );
  static const body = TextStyle(
    fontFamily: fontFamily,
    fontSize: 14,
    height: 1.8,
    color: AppColors.ink,
  );
  static const supporting = TextStyle(
    fontFamily: fontFamily,
    fontSize: 12,
    height: 1.8,
    color: AppColors.muted,
  );
  static const button = TextStyle(
    fontFamily: fontFamily,
    fontSize: 14,
    height: 1.6,
    fontWeight: FontWeight.bold,
  );
  static const number = TextStyle(
    fontFamily: fontFamily,
    fontSize: 28,
    height: 1.4,
    fontWeight: FontWeight.bold,
    color: AppColors.ink,
    fontFeatures: [FontFeature.tabularFigures()],
  );
  static const quantity = TextStyle(
    fontFamily: fontFamily,
    fontSize: 14,
    height: 1.7,
    fontWeight: FontWeight.bold,
    color: AppColors.emeraldDark,
    fontFeatures: [FontFeature.tabularFigures()],
  );

  static const textTheme = TextTheme(
    displayLarge: TextStyle(
      fontSize: 44,
      height: 1.4,
      fontWeight: FontWeight.bold,
      color: AppColors.ink,
    ),
    displayMedium: TextStyle(
      fontSize: 40,
      height: 1.4,
      fontWeight: FontWeight.bold,
      color: AppColors.ink,
    ),
    displaySmall: TextStyle(
      fontSize: 36,
      height: 1.4,
      fontWeight: FontWeight.bold,
      color: AppColors.ink,
    ),
    headlineLarge: TextStyle(
      fontSize: 30,
      height: 1.5,
      fontWeight: FontWeight.bold,
      color: AppColors.ink,
    ),
    headlineMedium: pageTitle,
    headlineSmall: TextStyle(
      fontSize: 22,
      height: 1.5,
      fontWeight: FontWeight.bold,
      color: AppColors.ink,
    ),
    titleLarge: TextStyle(
      fontSize: 20,
      height: 1.6,
      fontWeight: FontWeight.bold,
      color: AppColors.ink,
    ),
    titleMedium: cardTitle,
    titleSmall: TextStyle(
      fontSize: 14,
      height: 1.6,
      fontWeight: FontWeight.bold,
      color: AppColors.ink,
    ),
    bodyLarge: TextStyle(fontSize: 16, height: 1.8, color: AppColors.ink),
    bodyMedium: body,
    bodySmall: supporting,
    labelLarge: button,
    labelMedium: TextStyle(
      fontSize: 12,
      height: 1.6,
      fontWeight: FontWeight.bold,
      color: AppColors.inkSoft,
    ),
    labelSmall: TextStyle(fontSize: 11, height: 1.6, color: AppColors.muted),
  );
}
