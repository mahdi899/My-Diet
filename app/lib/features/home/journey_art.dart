import 'dart:math' as math;
import 'package:flutter/material.dart';

/// The path is drawn by the UI so its markers follow the actual streak snapshot.
/// The adjacent text supplies the accessible count and qualifying rule.
class JourneyPath extends StatelessWidget {
  const JourneyPath({super.key, required this.completed, required this.total});
  final int completed, total;

  @override
  Widget build(BuildContext context) => ExcludeSemantics(
    child: SizedBox(
      height: 96,
      child: CustomPaint(
        painter: _JourneyPathPainter(completed, total),
        child: const SizedBox.expand(),
      ),
    ),
  );
}

class _JourneyPathPainter extends CustomPainter {
  const _JourneyPathPainter(this.completed, this.total);
  final int completed, total;

  @override
  void paint(Canvas canvas, Size size) {
    const forest = Color(0xFF07543A);
    final ground = Paint()..color = const Color(0xFFD9E9BD);
    final soil = Path()
      ..moveTo(0, size.height)
      ..quadraticBezierTo(
        size.width * .14,
        size.height * .5,
        size.width * .35,
        size.height * .84,
      )
      ..quadraticBezierTo(
        size.width * .64,
        size.height * .6,
        size.width,
        size.height * .78,
      )
      ..lineTo(size.width, size.height)
      ..close();
    canvas.drawPath(soil, ground);

    Offset at(double t) => Offset(
      size.width * (.25 + .7 * t),
      size.height * (.74 - .46 * (1 - math.cos(t * math.pi)) / 2),
    );
    final path = Path()..moveTo(at(0).dx, at(0).dy);
    for (var step = 1; step <= 40; step++) {
      final point = at(step / 40);
      path.lineTo(point.dx, point.dy);
    }
    canvas.drawPath(
      path,
      Paint()
        ..color = const Color(0xFF8DAF69)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2,
    );
    final count = total.clamp(1, 30);
    final radius = (size.width / (count * 3.4)).clamp(1.6, 4.5);
    for (var i = 0; i < count; i++) {
      final point = at(count == 1 ? .5 : i / (count - 1));
      canvas.drawCircle(
        point,
        radius,
        Paint()..color = i < completed ? forest : const Color(0xFFFAFCF3),
      );
      canvas.drawCircle(
        point,
        radius,
        Paint()
          ..color = forest
          ..style = PaintingStyle.stroke
          ..strokeWidth = count > 12 ? 1 : 1.5,
      );
    }
    canvas.save();
    canvas.translate(size.width * .12, size.height * .85);
    canvas.drawPath(
      Path()
        ..moveTo(0, 0)
        ..quadraticBezierTo(3, -20, 0, -39),
      Paint()
        ..color = forest
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.4
        ..strokeCap = StrokeCap.round,
    );
    canvas.drawPath(
      Path()
        ..moveTo(1, -21)
        ..quadraticBezierTo(-18, -22, -18, -39)
        ..quadraticBezierTo(-2, -38, 1, -21),
      Paint()..color = const Color(0xFF7EAE48),
    );
    canvas.drawPath(
      Path()
        ..moveTo(1, -28)
        ..quadraticBezierTo(0, -49, 20, -50)
        ..quadraticBezierTo(20, -30, 1, -28),
      Paint()..color = const Color(0xFFB8D849),
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(_JourneyPathPainter oldDelegate) =>
      completed != oldDelegate.completed || total != oldDelegate.total;
}
