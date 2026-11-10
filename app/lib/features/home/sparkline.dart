import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/theme/tokens.dart';

/// Small filled line of recorded weights.
class SparklinePainter extends CustomPainter {
  SparklinePainter(List<double> values) : values = List<double>.from(values);

  final List<double> values;

  @override
  void paint(Canvas canvas, Size size) {
    if (values.isEmpty) return;
    if (values.length == 1) {
      canvas.drawCircle(
        Offset(size.width / 2, size.height / 2),
        4,
        Paint()..color = AppColors.emerald,
      );
      return;
    }
    final low = values.reduce(math.min);
    final high = values.reduce(math.max);
    final span = (high - low).abs() < 0.15 ? 1.0 : high - low;
    final bottom = low - span * 0.25;
    final top = high + span * 0.25;

    Offset at(int index) {
      final x = size.width * index / (values.length - 1);
      final y = size.height * (1 - (values[index] - bottom) / (top - bottom));
      return Offset(x, y);
    }

    final path = Path()..moveTo(at(0).dx, at(0).dy);
    for (var i = 1; i < values.length; i++) {
      path.lineTo(at(i).dx, at(i).dy);
    }
    final fill = Path.from(path)
      ..lineTo(at(values.length - 1).dx, size.height)
      ..lineTo(at(0).dx, size.height)
      ..close();
    canvas.drawPath(
      fill,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            AppColors.emerald.withValues(alpha: 0.22),
            AppColors.emerald.withValues(alpha: 0),
          ],
        ).createShader(Offset.zero & size),
    );
    canvas.drawPath(
      path,
      Paint()
        ..color = AppColors.emerald
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.4
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
    final last = at(values.length - 1);
    canvas.drawCircle(last, 4.5, Paint()..color = Colors.white);
    canvas.drawCircle(last, 3, Paint()..color = AppColors.emerald);
  }

  @override
  bool shouldRepaint(SparklinePainter oldDelegate) => true;
}
