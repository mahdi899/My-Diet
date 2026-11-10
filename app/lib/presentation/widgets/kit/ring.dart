import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/tokens.dart';

/// Animated progress ring. [value] is 0..1 (values above 1 draw a full ring).
/// Animates from 0 on first build and between values afterwards.
///
/// ```dart
/// Ring(value: eaten / goal, size: 140, child: Ticker(value: eaten))
/// ```
class Ring extends StatelessWidget {
  const Ring({
    super.key,
    required this.value,
    this.size = 120,
    this.strokeWidth = 12,
    this.colors = const [AppColors.lime, AppColors.emerald],
    this.trackColor = AppColors.mint,
    this.child,
    this.duration = const Duration(milliseconds: 1100),
    this.curve = Motion.emphasized,
    this.delay = Duration.zero,
    this.startAngle = -math.pi / 2,
  });

  final double value;
  final double size;
  final double strokeWidth;

  /// One colour = solid; several = sweep gradient along the arc.
  final List<Color> colors;
  final Color trackColor;
  final Widget? child;
  final Duration duration;
  final Curve curve;
  final Duration delay;
  final double startAngle;

  @override
  Widget build(BuildContext context) {
    final target = value.isNaN ? 0.0 : value.clamp(0.0, 1.0);
    final reduce = Motion.reduced(context);
    return SizedBox(
      width: size,
      height: size,
      child: _Delayed(
        delay: reduce ? Duration.zero : delay,
        builder: (go) => TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: go ? target : 0),
          duration: reduce ? Duration.zero : duration,
          curve: curve,
          builder: (context, t, child) => CustomPaint(
            painter: RingPainter(
              progress: t,
              strokeWidth: strokeWidth,
              colors: colors,
              trackColor: trackColor,
              startAngle: startAngle,
            ),
            child: child,
          ),
          child: Center(child: child),
        ),
      ),
    );
  }
}

class _Delayed extends StatefulWidget {
  const _Delayed({required this.delay, required this.builder});
  final Duration delay;
  final Widget Function(bool go) builder;
  @override
  State<_Delayed> createState() => _DelayedState();
}

class _DelayedState extends State<_Delayed> {
  late bool go = widget.delay == Duration.zero;

  @override
  void initState() {
    super.initState();
    if (!go) {
      Future<void>.delayed(widget.delay, () {
        if (mounted) setState(() => go = true);
      });
    }
  }

  @override
  Widget build(BuildContext context) => widget.builder(go);
}

/// Paints a track plus a round-capped (gradient) arc. Reusable on its own,
/// e.g. for concentric macro rings inside a [Stack].
class RingPainter extends CustomPainter {
  RingPainter({
    required this.progress,
    required this.strokeWidth,
    required this.colors,
    required this.trackColor,
    this.startAngle = -math.pi / 2,
  });

  final double progress;
  final double strokeWidth;
  final List<Color> colors;
  final Color trackColor;
  final double startAngle;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final r = (math.min(size.width, size.height) - strokeWidth) / 2;
    final c = rect.center;
    final arcRect = Rect.fromCircle(center: c, radius: r);
    canvas.drawCircle(
      c,
      r,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth
        ..color = trackColor,
    );
    if (progress <= 0.001) return;
    final sweep = 2 * math.pi * progress;
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round;
    if (colors.length == 1) {
      paint.color = colors.first;
    } else {
      // Gradient follows the arc: rotate so it starts at [startAngle].
      paint.shader = SweepGradient(
        startAngle: 0,
        endAngle: math.max(sweep, 0.01),
        colors: colors,
        transform: GradientRotation(startAngle),
      ).createShader(arcRect);
    }
    canvas.drawArc(arcRect, startAngle, sweep, false, paint);
  }

  @override
  bool shouldRepaint(RingPainter old) =>
      old.progress != progress ||
      old.strokeWidth != strokeWidth ||
      old.trackColor != trackColor ||
      old.startAngle != startAngle ||
      old.colors != colors;
}
