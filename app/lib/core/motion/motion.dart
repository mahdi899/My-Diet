import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// One place for timing so every screen moves with the same feel.
abstract final class Motion {
  static const quick = Duration(milliseconds: 180);
  static const base = Duration(milliseconds: 320);
  static const slow = Duration(milliseconds: 560);
  static const page = Duration(milliseconds: 420);
  static const curve = Curves.easeOutCubic;
  static const spring = Curves.easeOutBack;
  static const emphasized = Cubic(0.2, 0.0, 0.0, 1.0);

  /// True when the user asked the OS to reduce motion.
  static bool reduced(BuildContext context) =>
      MediaQuery.maybeDisableAnimationsOf(context) ?? false;

  /// [d], or zero when motion is reduced.
  static Duration of(BuildContext context, Duration d) =>
      reduced(context) ? Duration.zero : d;
}

/// Light taps for choices, a firmer one for commitments.
abstract final class Haptics {
  static void tap() => HapticFeedback.selectionClick();
  static void confirm() => HapticFeedback.mediumImpact();
  static void success() => HapticFeedback.heavyImpact();
  static void tick() => HapticFeedback.lightImpact();
}

/// Fades and lifts its child into place; use `index` to stagger a list.
class Reveal extends StatelessWidget {
  const Reveal({super.key, required this.child, this.index = 0, this.dy = 18});
  final Widget child;
  final int index;
  final double dy;

  @override
  Widget build(BuildContext context) {
    final reduce = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    if (reduce) return child;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Motion.base + Duration(milliseconds: 60 * index.clamp(0, 8)),
      curve: Motion.curve,
      builder: (context, t, child) => Opacity(
        opacity: t,
        child: Transform.translate(
          offset: Offset(0, dy * (1 - t)),
          child: child,
        ),
      ),
      child: child,
    );
  }
}

/// Shared page transition: a soft slide from the reading direction plus fade.
Route<T> softRoute<T>(Widget page) => PageRouteBuilder<T>(
  transitionDuration: Motion.page,
  reverseTransitionDuration: Motion.base,
  pageBuilder: (_, _, _) => page,
  transitionsBuilder: (_, animation, _, child) {
    final curved = CurvedAnimation(parent: animation, curve: Motion.curve);
    return FadeTransition(
      opacity: curved,
      child: SlideTransition(
        position: Tween(
          begin: const Offset(-0.06, 0),
          end: Offset.zero,
        ).animate(curved),
        child: child,
      ),
    );
  },
);
