import 'dart:async';

import 'package:flutter/material.dart';
import 'motion.dart';

/// Delay for the [index]-th item of a staggered entrance (capped).
Duration staggerDelay(
  int index, {
  Duration step = const Duration(milliseconds: 60),
  int max = 10,
}) => step * index.clamp(0, max);

/// Fade + rise entrance; no-op under reduce-motion.
///
/// ```dart
/// Text('سلام').rise()                       // single
/// for (final (i, m) in meals.indexed) MealCard(m).rise(index: i) // stagger
/// ```
extension RiseX on Widget {
  Widget rise({
    int index = 0,
    Duration? delay,
    double dy = 0.08,
    Duration duration = Motion.slow,
    Curve curve = Motion.emphasized,
  }) => _Rise(
    index: index,
    delay: delay,
    dy: dy,
    duration: duration,
    curve: curve,
    child: this,
  );

  /// Scale-in (pop) entrance, e.g. for badges and checkmarks.
  Widget pop({
    int index = 0,
    Duration? delay,
    Duration duration = Motion.base,
  }) => _Pop(index: index, delay: delay, duration: duration, child: this);
}

class _Rise extends StatefulWidget {
  const _Rise({
    required this.child,
    required this.index,
    required this.delay,
    required this.dy,
    required this.duration,
    required this.curve,
  });
  final Widget child;
  final int index;
  final Duration? delay;
  final double dy;
  final Duration duration;
  final Curve curve;

  @override
  State<_Rise> createState() => _RiseState();
}

class _RiseState extends State<_Rise> {
  Timer? _timer;
  var _go = false;

  @override
  void initState() {
    super.initState();
    final delay = widget.delay ?? staggerDelay(widget.index);
    if (delay == Duration.zero) {
      _go = true;
    } else {
      _timer = Timer(delay, () {
        if (mounted) setState(() => _go = true);
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (Motion.reduced(context)) return widget.child;
    if (!_go) return Opacity(opacity: 0, child: widget.child);
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Motion.of(context, widget.duration),
      curve: widget.curve,
      child: widget.child,
      builder: (context, t, child) => Opacity(
        opacity: t,
        child: FractionalTranslation(
          translation: Offset(0, widget.dy * (1 - t)),
          child: child,
        ),
      ),
    );
  }
}

class _Pop extends StatefulWidget {
  const _Pop({
    required this.child,
    required this.index,
    required this.delay,
    required this.duration,
  });
  final Widget child;
  final int index;
  final Duration? delay;
  final Duration duration;

  @override
  State<_Pop> createState() => _PopState();
}

class _PopState extends State<_Pop> {
  Timer? _timer;
  var _go = false;

  @override
  void initState() {
    super.initState();
    final delay = widget.delay ?? staggerDelay(widget.index);
    if (delay == Duration.zero) {
      _go = true;
    } else {
      _timer = Timer(delay, () {
        if (mounted) setState(() => _go = true);
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (Motion.reduced(context)) return widget.child;
    if (!_go) return Opacity(opacity: 0, child: widget.child);
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Motion.of(context, widget.duration),
      curve: Motion.spring,
      child: widget.child,
      builder: (context, t, child) => Opacity(
        opacity: t,
        child: Transform.scale(scale: 0.6 + 0.4 * t, child: child),
      ),
    );
  }
}

/// Wraps each child with [RiseX.rise], index-staggered.
List<Widget> staggered(
  Iterable<Widget> children, {
  int startIndex = 0,
  double dy = 0.08,
}) => [
  for (final (i, w) in children.indexed) w.rise(index: startIndex + i, dy: dy),
];

/// A [Column]/[Row] whose children rise in one after another.
class Stagger extends StatelessWidget {
  const Stagger({
    super.key,
    required this.children,
    this.axis = Axis.vertical,
    this.spacing = 0,
    this.crossAxisAlignment = CrossAxisAlignment.stretch,
    this.mainAxisSize = MainAxisSize.min,
  });
  final List<Widget> children;
  final Axis axis;
  final double spacing;
  final CrossAxisAlignment crossAxisAlignment;
  final MainAxisSize mainAxisSize;

  @override
  Widget build(BuildContext context) {
    final items = <Widget>[];
    for (final (i, w) in children.indexed) {
      if (i > 0 && spacing > 0) {
        items.add(
          axis == Axis.vertical
              ? SizedBox(height: spacing)
              : SizedBox(width: spacing),
        );
      }
      items.add(w.rise(index: i));
    }
    return axis == Axis.vertical
        ? Column(
            mainAxisSize: mainAxisSize,
            crossAxisAlignment: crossAxisAlignment,
            children: items,
          )
        : Row(
            mainAxisSize: mainAxisSize,
            crossAxisAlignment: crossAxisAlignment,
            children: items,
          );
  }
}
