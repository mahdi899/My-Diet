import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';

/// Camera hole reported by the device. Insets alone are not a camera.
Rect? topCameraBounds(MediaQueryData media) {
  for (final feature in media.displayFeatures) {
    final bounds = feature.bounds;
    if (feature.type == ui.DisplayFeatureType.cutout &&
        !bounds.isEmpty &&
        bounds.top >= 0 &&
        bounds.bottom <= media.viewPadding.top + 8 &&
        bounds.right <= media.size.width &&
        bounds.left >= 0) {
      return bounds;
    }
  }
  return null;
}

/// A ring that fills around the front camera as onboarding advances.
/// Without a reported cutout, nothing is drawn and the page uses a slim bar.
class CameraProgressRing extends StatelessWidget {
  const CameraProgressRing({super.key, required this.progress});

  final double progress;

  /// Keeps the arc across question changes instead of restarting at zero.
  static double _shown = 0;

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    final cutout = topCameraBounds(media);
    if (cutout == null) return const SizedBox.shrink();
    final hole = math.min(cutout.width, cutout.height);
    final lensCenter = Offset(
      cutout.center.dx,
      cutout.height > cutout.width
          ? cutout.bottom - hole / 2
          : cutout.center.dy,
    );
    final diameter = hole + 12;
    final frame = Rect.fromCenter(
      center: lensCenter,
      width: diameter,
      height: diameter,
    );
    return Positioned.fromRect(
      rect: frame,
      child: IgnorePointer(
        child: Semantics(
          label: 'پیشرفت',
          value: '${(progress.clamp(0, 1) * 100).round()}%',
          child: TweenAnimationBuilder<double>(
            tween: Tween(
              begin: _shown,
              end: () {
                final next = progress.clamp(0, 1).toDouble();
                _shown = next;
                return next;
              }(),
            ),
            duration: media.disableAnimations ? Duration.zero : Motion.slow,
            curve: Curves.easeOutCubic,
            builder: (context, value, _) => CustomPaint(
              painter: _CutoutRingPainter(value),
            ),
          ),
        ),
      ),
    );
  }
}

class _CutoutRingPainter extends CustomPainter {
  _CutoutRingPainter(this.progress);

  final double progress;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    const stroke = 3.8;
    final radius = math.min(size.width, size.height) / 2 - stroke;
    final circle = Rect.fromCircle(center: center, radius: radius);
    canvas.drawCircle(
      center,
      radius,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke + 2.4
        ..color = Colors.white,
    );
    canvas.drawCircle(
      center,
      radius,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..color = const Color(0xFFD7E0D4),
    );
    canvas.drawArc(
      circle,
      -math.pi / 2,
      math.pi * 2 * progress.clamp(0, 1),
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round
        ..strokeWidth = stroke
        ..color = const Color(0xFF063D2C),
    );
  }

  @override
  bool shouldRepaint(_CutoutRingPainter old) => old.progress != progress;
}
