import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../../core/theme/theme.dart';
import '../../../core/format/digits.dart';
import '../../../core/motion/motion.dart';

String bmiLabel(double bmi) {
  if (bmi < 18.5) return 'کم‌وزن';
  if (bmi < 25) return 'محدودهٔ سالم';
  if (bmi < 30) return 'اضافه‌وزن';
  return 'چاقی';
}

/// Half-circle BMI gauge. The needle sweeps in when it appears.
class BmiGauge extends StatelessWidget {
  const BmiGauge({super.key, required this.bmi});
  final double bmi;

  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
    tween: Tween(begin: 0, end: bmi.clamp(12, 40)),
    duration: Motion.slow * 2,
    curve: Motion.curve,
    builder: (context, value, _) => Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: 240,
          height: 130,
          child: CustomPaint(painter: _GaugePainter(value)),
        ),
        Text(
          faNumber(double.parse(bmi.toStringAsFixed(1))),
          style: const TextStyle(
            fontSize: 34,
            fontWeight: FontWeight.bold,
            color: pine,
          ),
        ),
        Text(
          'شاخص توده بدنی · ${bmiLabel(bmi)}',
          style: const TextStyle(color: muted, fontSize: 12),
        ),
      ],
    ),
  );
}

class _GaugePainter extends CustomPainter {
  _GaugePainter(this.bmi);
  final double bmi;

  static const _bands = [
    (12.0, 18.5, Color(0xFF6FA8DC)),
    (18.5, 25.0, Color(0xFF7CB36B)),
    (25.0, 30.0, Color(0xFFE0A93B)),
    (30.0, 40.0, Color(0xFFD9694B)),
  ];

  double _angle(double v) => math.pi + (v - 12) / 28 * math.pi;

  @override
  void paint(Canvas canvas, Size size) {
    final c = Offset(size.width / 2, size.height - 8);
    final r = size.width / 2 - 14;
    final rect = Rect.fromCircle(center: c, radius: r);
    for (final (from, to, color) in _bands) {
      canvas.drawArc(
        rect,
        _angle(from) + 0.012,
        _angle(to) - _angle(from) - 0.024,
        false,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 18
          ..color = color,
      );
    }
    final a = _angle(bmi);
    final tip = c + Offset(math.cos(a), math.sin(a)) * (r - 26);
    canvas.drawLine(
      c,
      tip,
      Paint()
        ..color = ink
        ..strokeWidth = 4
        ..strokeCap = StrokeCap.round,
    );
    canvas.drawCircle(c, 9, Paint()..color = ink);
  }

  @override
  bool shouldRepaint(_GaugePainter old) => old.bmi != bmi;
}
