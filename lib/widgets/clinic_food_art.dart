import 'dart:math' as math;
import 'package:flutter/material.dart';

/// Code-drawn food illustrations: no network assets or font glyphs.
class ClinicFoodArt extends StatelessWidget {
  const ClinicFoodArt({super.key, this.kind = 0, this.size = 150});
  final int kind;
  final double size;
  @override
  Widget build(BuildContext context) => ExcludeSemantics(
    child: SizedBox(
      width: size,
      height: size,
      child: CustomPaint(painter: _FoodPainter(kind)),
    ),
  );
}

class _FoodPainter extends CustomPainter {
  const _FoodPainter(this.kind);
  final int kind;
  @override
  void paint(Canvas c, Size s) {
    c.save();
    c.scale(s.width / 180, s.height / 180);
    if (kind == 0) {
      plate(c);
    } else if (kind == 1) {
      tomato(c, 89, 95, 46);
      leaf(c, 123, 38, .7, -.6);
      leaf(c, 145, 61, .5, .5);
    } else {
      carrot(c, 84, 92, 1.25, -.5);
      leaf(c, 127, 119, .9, .8);
    }
    c.restore();
  }

  void leaf(Canvas c, double x, double y, double scale, double angle) {
    c.save();
    c.translate(x, y);
    c.rotate(angle);
    c.scale(scale);
    final p = Path()
      ..moveTo(0, 30)
      ..cubicTo(-40, 0, -28, -35, 0, -39)
      ..cubicTo(29, -21, 37, 6, 0, 30);
    c.drawPath(p, Paint()..color = const Color(0xFF75A654));
    c.drawPath(
      Path()
        ..moveTo(0, 26)
        ..lineTo(0, -25),
      Paint()
        ..color = const Color(0xFF3E723B)
        ..strokeWidth = 2
        ..style = PaintingStyle.stroke,
    );
    c.restore();
  }

  void tomato(Canvas c, double x, double y, double radius) {
    c.drawCircle(
      Offset(x + 3, y + 7),
      radius,
      Paint()..color = const Color(0xFF1C472C).withValues(alpha: .12),
    );
    c.drawCircle(
      Offset(x, y),
      radius,
      Paint()..color = const Color(0xFFE98865),
    );
    c.drawOval(
      Rect.fromCenter(
        center: Offset(x - 10, y - 10),
        width: radius * .7,
        height: radius,
      ),
      Paint()..color = const Color(0xFFF6AA85),
    );
    final star = Path();
    for (var i = 0; i < 10; i++) {
      final a = -math.pi / 2 + i * math.pi / 5;
      final r = i.isEven ? radius * .48 : radius * .17;
      final p = Offset(x + math.cos(a) * r, y - radius * .8 + math.sin(a) * r);
      if (i == 0) {
        star.moveTo(p.dx, p.dy);
      } else {
        star.lineTo(p.dx, p.dy);
      }
    }
    star.close();
    c.drawPath(star, Paint()..color = const Color(0xFF397C45));
  }

  void carrot(Canvas c, double x, double y, double scale, double angle) {
    c.save();
    c.translate(x, y);
    c.rotate(angle);
    c.scale(scale);
    final body = Path()
      ..moveTo(-17, -26)
      ..quadraticBezierTo(0, -40, 18, -25)
      ..quadraticBezierTo(18, 0, 0, 53)
      ..quadraticBezierTo(-15, 14, -17, -26);
    c.drawPath(body, Paint()..color = const Color(0xFFEFA653));
    final line = Paint()
      ..color = const Color(0xFFCD7E38)
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round;
    for (var i = 0; i < 4; i++) {
      c.drawLine(
        Offset(-9 + i * 2.0, -16 + i * 13.0),
        Offset(2 + i * 1.0, -18 + i * 13.0),
        line,
      );
    }
    leaf(c, -11, -43, .42, -.65);
    leaf(c, 9, -44, .45, .5);
    c.restore();
  }

  void plate(Canvas c) {
    c.drawOval(
      const Rect.fromLTWH(17, 137, 153, 29),
      Paint()..color = Colors.black.withValues(alpha: .12),
    );
    c.drawCircle(
      const Offset(90, 86),
      76,
      Paint()..color = const Color(0xFFF7F5E8),
    );
    c.drawCircle(
      const Offset(90, 86),
      63,
      Paint()..color = const Color(0xFFDFE8CD),
    );
    c.drawCircle(
      const Offset(90, 86),
      57,
      Paint()..color = const Color(0xFFEDF1DC),
    );
    leaf(c, 64, 65, .8, -1.2);
    leaf(c, 88, 52, .7, .4);
    leaf(c, 110, 69, .8, 1.1);
    leaf(c, 65, 100, .65, -1.8);
    leaf(c, 110, 111, .6, 1.4);
    for (final p in [
      const Offset(54, 83),
      const Offset(104, 43),
      const Offset(125, 91),
    ]) {
      c.drawCircle(p, 15, Paint()..color = const Color(0xFF518D4F));
      c.drawCircle(p, 11, Paint()..color = const Color(0xFFC5DC94));
      for (var i = 0; i < 5; i++) {
        final a = i * math.pi * 2 / 5;
        c.drawOval(
          Rect.fromCenter(
            center: p + Offset(math.cos(a) * 5, math.sin(a) * 5),
            width: 2,
            height: 4,
          ),
          Paint()..color = const Color(0xFFF5EFC8),
        );
      }
    }
    tomato(c, 93, 98, 19);
    tomato(c, 60, 120, 13);
    carrot(c, 117, 63, .48, .8);
    for (final p in [
      const Offset(76, 79),
      const Offset(125, 119),
      const Offset(80, 124),
      const Offset(48, 54),
    ]) {
      c.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromCenter(center: p, width: 13, height: 11),
          const Radius.circular(3),
        ),
        Paint()..color = const Color(0xFFF0CA76),
      );
    }
    final fork = Paint()
      ..color = const Color(0xFFCAD7BB)
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round;
    c.save();
    c.translate(7, 41);
    c.rotate(-.22);
    c.drawLine(const Offset(0, 0), const Offset(0, 94), fork);
    for (var i = -1; i <= 1; i++) {
      c.drawLine(Offset(i * 5.0, -5), Offset(i * 5.0, 17), fork);
    }
    c.drawArc(
      const Rect.fromLTWH(-5, 10, 10, 13),
      0,
      math.pi,
      false,
      fork..style = PaintingStyle.stroke,
    );
    c.restore();
  }

  @override
  bool shouldRepaint(covariant _FoodPainter old) => old.kind != kind;
}
