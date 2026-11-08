import 'package:flutter/material.dart';

/// Decorative geometry only; it does not represent patient data or charts.
class ClinicPattern extends StatelessWidget {
  const ClinicPattern({
    super.key,
    required this.child,
    this.variant = 0,
    this.color = Colors.white,
    this.opacity = .12,
    this.radius = 0,
  });
  final Widget child;
  final int variant;
  final Color color;
  final double opacity, radius;
  @override
  Widget build(BuildContext context) => ClipRRect(
    borderRadius: BorderRadius.circular(radius),
    child: Stack(
      children: [
        Positioned.fill(
          child: IgnorePointer(
            child: ExcludeSemantics(
              child: CustomPaint(
                painter: _PatternPainter(
                  variant,
                  color.withValues(alpha: opacity),
                ),
              ),
            ),
          ),
        ),
        child,
      ],
    ),
  );
}

class _PatternPainter extends CustomPainter {
  const _PatternPainter(this.variant, this.color);
  final int variant;
  final Color color;
  @override
  void paint(Canvas canvas, Size size) {
    final pen = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    if (variant == 0) {
      final origin = Offset(-size.width * .08, size.height * .45);
      for (var i = 0; i < 9; i++) {
        canvas.drawCircle(origin, 48 + i * 19.0, pen);
      }
      final dots = Paint()..color = color;
      for (var x = 0; x < 5; x++) {
        for (var y = 0; y < 4; y++) {
          canvas.drawCircle(
            Offset(size.width - 18 - x * 10.0, 15 + y * 10.0),
            1.3,
            dots,
          );
        }
      }
      final leaf = Path()
        ..moveTo(size.width * .21, size.height * .1)
        ..quadraticBezierTo(
          size.width * .45,
          -8,
          size.width * .34,
          size.height * .32,
        )
        ..quadraticBezierTo(
          size.width * .18,
          size.height * .34,
          size.width * .21,
          size.height * .1,
        );
      canvas.drawPath(leaf, pen);
    } else if (variant == 1) {
      for (var i = -3; i < 10; i++) {
        final x = i * 20.0;
        canvas.drawLine(
          Offset(x, size.height),
          Offset(x + size.height * .6, 0),
          pen,
        );
      }
    } else {
      final dot = Paint()..color = color;
      for (var x = 0; x < size.width * .45; x += 12) {
        for (var y = 8; y < size.height; y += 12) {
          canvas.drawCircle(Offset(x.toDouble(), y.toDouble()), 1.2, dot);
        }
      }
      canvas.drawCircle(Offset(0, size.height), size.height * .8, pen);
      canvas.drawCircle(Offset(0, size.height), size.height * .58, pen);
    }
  }

  @override
  bool shouldRepaint(covariant _PatternPainter old) =>
      old.variant != variant || old.color != color;
}
