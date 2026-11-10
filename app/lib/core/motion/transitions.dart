import 'package:flutter/material.dart';
import 'motion.dart';

/// Fade-through: the old page fades out, the new one fades + scales in.
/// Use for unrelated destinations (tab roots, modal-ish pages).
Route<T> fadeThroughRoute<T>(Widget page, {RouteSettings? settings}) =>
    PageRouteBuilder<T>(
      settings: settings,
      transitionDuration: Motion.page,
      reverseTransitionDuration: Motion.base,
      pageBuilder: (_, _, _) => page,
      transitionsBuilder: (context, animation, secondary, child) {
        if (Motion.reduced(context)) return child;
        final fadeIn = CurvedAnimation(
          parent: animation,
          curve: const Interval(0.25, 1, curve: Curves.easeOut),
        );
        final scaleIn = Tween(
          begin: 0.94,
          end: 1.0,
        ).animate(CurvedAnimation(parent: animation, curve: Motion.emphasized));
        final fadeOutOld = Tween(begin: 1.0, end: 0.0).animate(
          CurvedAnimation(
            parent: secondary,
            curve: const Interval(0, 0.35, curve: Curves.easeIn),
          ),
        );
        return FadeTransition(
          opacity: fadeOutOld,
          child: FadeTransition(
            opacity: fadeIn,
            child: ScaleTransition(scale: scaleIn, child: child),
          ),
        );
      },
    );

/// Shared-axis (horizontal): pages slide a little along the reading direction
/// while cross-fading. RTL-aware: "forward" moves right-to-left under RTL.
Route<T> sharedAxisRoute<T>(
  Widget page, {
  RouteSettings? settings,
  Axis axis = Axis.horizontal,
}) => PageRouteBuilder<T>(
  settings: settings,
  transitionDuration: Motion.page,
  reverseTransitionDuration: Motion.base,
  pageBuilder: (_, _, _) => page,
  transitionsBuilder: (context, animation, secondary, child) {
    if (Motion.reduced(context)) return child;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    // In RTL the "next" page comes from the left (negative x).
    final sign = axis == Axis.horizontal ? (rtl ? -1.0 : 1.0) : 1.0;
    Offset off(double v) =>
        axis == Axis.horizontal ? Offset(sign * v, 0) : Offset(0, v);
    final inCurve = CurvedAnimation(parent: animation, curve: Motion.emphasized);
    final outCurve = CurvedAnimation(
      parent: secondary,
      curve: Motion.emphasized,
    );
    return SlideTransition(
      position: Tween(
        begin: Offset.zero,
        end: off(-0.12),
      ).animate(outCurve),
      child: FadeTransition(
        opacity: Tween(begin: 1.0, end: 0.0).animate(
          CurvedAnimation(
            parent: secondary,
            curve: const Interval(0, 0.5, curve: Curves.easeIn),
          ),
        ),
        child: SlideTransition(
          position: Tween(begin: off(0.12), end: Offset.zero).animate(inCurve),
          child: FadeTransition(
            opacity: CurvedAnimation(
              parent: animation,
              curve: const Interval(0.2, 1, curve: Curves.easeOut),
            ),
            child: child,
          ),
        ),
      ),
    );
  },
);

/// Swaps its [child] with a fade-through (tab body, empty/loaded states).
/// Give each logical page a distinct `key`.
class FadeThroughSwitcher extends StatelessWidget {
  const FadeThroughSwitcher({
    super.key,
    required this.child,
    this.duration = Motion.base,
  });
  final Widget child;
  final Duration duration;

  @override
  Widget build(BuildContext context) => AnimatedSwitcher(
    duration: Motion.of(context, duration),
    switchInCurve: Motion.emphasized,
    switchOutCurve: Curves.easeIn,
    transitionBuilder: (child, animation) => FadeTransition(
      opacity: animation,
      child: ScaleTransition(
        scale: Tween(begin: 0.97, end: 1.0).animate(animation),
        child: child,
      ),
    ),
    child: child,
  );
}

/// Tab-body switcher with a shared-axis slide that follows the direction of
/// [index] change (RTL-aware). Keep a stable `key` per tab on [child].
///
/// ```dart
/// SharedAxisSwitcher(index: tab, child: KeyedSubtree(key: ValueKey(tab), child: pages[tab]))
/// ```
class SharedAxisSwitcher extends StatefulWidget {
  const SharedAxisSwitcher({
    super.key,
    required this.index,
    required this.child,
    this.duration = Motion.base,
  });
  final int index;
  final Widget child;
  final Duration duration;

  @override
  State<SharedAxisSwitcher> createState() => _SharedAxisSwitcherState();
}

class _SharedAxisSwitcherState extends State<SharedAxisSwitcher> {
  int _dir = 1;

  @override
  void didUpdateWidget(SharedAxisSwitcher oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.index != widget.index) {
      _dir = widget.index > oldWidget.index ? 1 : -1;
    }
  }

  @override
  Widget build(BuildContext context) {
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final sign = (rtl ? -1.0 : 1.0) * _dir;
    return AnimatedSwitcher(
      duration: Motion.of(context, widget.duration),
      switchInCurve: Motion.emphasized,
      switchOutCurve: Curves.easeIn,
      layoutBuilder: (current, previous) => Stack(
        alignment: Alignment.topCenter,
        children: [...previous, ?current],
      ),
      transitionBuilder: (child, animation) => FadeTransition(
        opacity: animation,
        child: SlideTransition(
          position: Tween(
            begin: Offset(sign * 0.08, 0),
            end: Offset.zero,
          ).animate(animation),
          child: child,
        ),
      ),
      child: widget.child,
    );
  }
}
