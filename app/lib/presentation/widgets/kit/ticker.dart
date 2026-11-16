import 'package:flutter/material.dart';
import '../../../core/format/digits.dart';
import '../../../core/motion/motion.dart';

/// Animated count-up number rendered with Persian digits.
///
/// Note: shares its name with Flutter's scheduler `Ticker`; if you also import
/// `package:flutter/scheduler.dart`, use `hide Ticker` (or `kit.Ticker`).
///
/// ```dart
/// Ticker(value: 1850, suffix: ' کیلوکالری', style: textTheme.headlineMedium)
/// Ticker(value: 72.4, fractionDigits: 1, suffix: ' کیلو')
/// ```
class Ticker extends StatelessWidget {
  const Ticker({
    super.key,
    required this.value,
    this.style,
    this.duration = const Duration(milliseconds: 1000),
    this.curve = Motion.emphasized,
    this.fractionDigits = 0,
    this.prefix = '',
    this.suffix = '',
    this.grouped = false,
    this.from = 0,
    this.textAlign,
  });

  final num value;
  final TextStyle? style;
  final Duration duration;
  final Curve curve;
  final int fractionDigits;
  final String prefix, suffix;

  /// Insert Persian thousands separators (۱٬۲۵۰).
  final bool grouped;

  /// Start value for the first animation.
  final num from;
  final TextAlign? textAlign;

  /// Formats [v] like the ticker does (Persian digits, optional grouping).
  static String format(num v, {int fractionDigits = 0, bool grouped = false}) {
    return persianNumber(v, fractionDigits: fractionDigits, grouped: grouped);
  }

  @override
  Widget build(BuildContext context) {
    final reduce = Motion.reduced(context);
    final base = DefaultTextStyle.of(context).style;
    final s = (style ?? base).copyWith(
      fontFeatures: const [FontFeature.tabularFigures()],
    );
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: from.toDouble(), end: value.toDouble()),
      duration: reduce ? Duration.zero : duration,
      curve: curve,
      builder: (context, v, _) => Text(
        '$prefix${format(v, fractionDigits: fractionDigits, grouped: grouped)}$suffix',
        style: s,
        textAlign: textAlign,
        textDirection: TextDirection.rtl,
      ),
    );
  }
}
