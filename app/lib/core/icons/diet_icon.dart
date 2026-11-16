import 'package:flutter/material.dart';

import '../theme/tokens.dart';

/// The approved rounded, two-colour botanical icon family, drawn as vectors.
enum DietIconKind { home, coach, plan, water, meal, progress }

class DietIcon extends StatelessWidget {
  const DietIcon(
    this.kind, {
    super.key,
    this.size = 24,
    this.color,
    this.selected = false,
    this.monochrome = false,
    this.semanticLabel,
  });
  final DietIconKind kind;
  final double size;
  final Color? color;
  final bool selected, monochrome;

  /// Omit for icons next to text; their enclosing control supplies the label.
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final stroke = color ?? AppColors.emeraldDark;
    final drawing = SizedBox.square(
      dimension: size,
      child: CustomPaint(
        painter: _DietIconPainter(
          kind,
          stroke,
          monochrome ? stroke : color ?? AppColors.emerald,
          monochrome
              ? Colors.transparent
              : color?.withValues(alpha: selected ? .22 : .1) ?? AppColors.mint,
          selected,
          size >= 40,
        ),
      ),
    );
    return semanticLabel == null
        ? ExcludeSemantics(child: drawing)
        : Semantics(image: true, label: semanticLabel, child: drawing);
  }
}

class _DietIconPainter extends CustomPainter {
  const _DietIconPainter(
    this.kind,
    this.ink,
    this.accent,
    this.tint,
    this.selected,
    this.detailed,
  );
  final DietIconKind kind;
  final Color ink, accent, tint;
  final bool selected, detailed;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / 32, size.height / 32);
    final line = Paint()
      ..color = ink
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.2
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final fill = Paint()..color = tint;
    void shape(Path p) {
      canvas.drawPath(p, fill);
      canvas.drawPath(p, line);
    }

    void segment(double x, double y, double dx, double dy) =>
        canvas.drawLine(Offset(x, y), Offset(dx, dy), line);
    void leaf(Path p) => canvas.drawPath(p, Paint()..color = accent);

    switch (kind) {
      case DietIconKind.home:
        shape(
          Path()
            ..moveTo(4.5, 16)
            ..lineTo(12.4, 9.1)
            ..quadraticBezierTo(14.1, 7.5, 16.2, 9)
            ..lineTo(27.7, 17)
            ..quadraticBezierTo(29.4, 18.4, 27.2, 19.2)
            ..lineTo(27.2, 26)
            ..quadraticBezierTo(27.2, 29, 24.2, 29)
            ..lineTo(20, 29)
            ..lineTo(20, 23)
            ..cubicTo(20, 18.5, 13, 18.5, 13, 23)
            ..lineTo(13, 29)
            ..lineTo(8, 29)
            ..quadraticBezierTo(5, 29, 5, 26)
            ..lineTo(5, 19.2)
            ..quadraticBezierTo(2.5, 18.8, 4.5, 16)
            ..close(),
        );
        segment(23.8, 13, 22.7, 6.2);
        leaf(
          Path()
            ..moveTo(23.1, 7.5)
            ..cubicTo(17.6, 8, 17, 3.5, 17.7, 2.7)
            ..cubicTo(22.1, 2.6, 23.6, 4.6, 23.1, 7.5)
            ..close(),
        );
        leaf(
          Path()
            ..moveTo(23.2, 6.5)
            ..cubicTo(22, 2.9, 26.1, 1.1, 29, 1.8)
            ..cubicTo(29.4, 5.4, 26, 7.3, 23.2, 6.5)
            ..close(),
        );
      case DietIconKind.coach:
        shape(
          Path()
            ..moveTo(13, 4)
            ..lineTo(20, 4)
            ..cubicTo(26, 4, 29, 8, 29, 14)
            ..cubicTo(29, 21, 25, 25, 18, 25)
            ..lineTo(11, 25)
            ..lineTo(3, 29)
            ..lineTo(5.1, 21.1)
            ..cubicTo(3.6, 19, 3, 16.9, 3, 14)
            ..cubicTo(3, 8, 6.8, 4, 13, 4)
            ..close(),
        );
        segment(14.8, 21.1, 17.2, 12);
        leaf(
          Path()
            ..moveTo(15.3, 18)
            ..cubicTo(9.4, 18.6, 8.2, 14.9, 8.7, 11.7)
            ..cubicTo(13, 11.2, 16.3, 14.3, 15.3, 18)
            ..close(),
        );
        leaf(
          Path()
            ..moveTo(16, 15.8)
            ..cubicTo(15.7, 10.3, 20.2, 8.9, 24.1, 9)
            ..cubicTo(24.5, 13.7, 20.8, 17.3, 16, 15.8)
            ..close(),
        );
      case DietIconKind.plan:
        final body = RRect.fromRectAndRadius(
          const Rect.fromLTRB(3.5, 6, 28.5, 29),
          const Radius.circular(5),
        );
        canvas.drawRRect(body, fill);
        canvas.drawRRect(body, line);
        segment(4, 12, 28, 12);
        for (final x in [10.0, 22.0]) {
          final binding = RRect.fromRectAndRadius(
            Rect.fromLTRB(x - 1.4, 2.6, x + 1.4, 9),
            const Radius.circular(1.4),
          );
          canvas.drawRRect(binding, Paint()..color = AppColors.surface);
          canvas.drawRRect(binding, line);
        }
        final bars = Paint()
          ..color = accent
          ..strokeWidth = 2
          ..strokeCap = StrokeCap.round;
        for (final y in [16.0, 20.5, 25.0]) {
          canvas.drawLine(Offset(detailed ? 14 : 8, y), Offset(20, y), bars);
        }
        if (detailed) {
          // Larger instances retain the meal-row detail of the concept sheet.
          canvas.drawArc(
            const Rect.fromLTWH(7, 14, 5, 4),
            3.14,
            3.14,
            false,
            line..strokeWidth = 1.1,
          );
          segment(7, 16, 12, 16);
          canvas.drawPath(
            Path()
              ..moveTo(7, 19)
              ..quadraticBezierTo(9.5, 23, 12, 19)
              ..close(),
            line,
          );
          canvas.drawPath(
            Path()
              ..moveTo(7, 24)
              ..quadraticBezierTo(9.5, 28, 12, 24)
              ..close(),
            line,
          );
          line.strokeWidth = 2.2;
        }
        canvas.drawPath(
          Path()
            ..moveTo(22, 23.5)
            ..lineTo(24, 25.3)
            ..lineTo(27, 21.5),
          line..color = accent,
        );
      case DietIconKind.water:
        final glass = Path()
          ..moveTo(5, 7)
          ..lineTo(8.1, 26)
          ..quadraticBezierTo(8.5, 29, 16, 29)
          ..quadraticBezierTo(23.5, 29, 23.9, 26)
          ..lineTo(27, 7)
          ..close();
        canvas.drawPath(glass, fill);
        canvas.save();
        canvas.clipPath(glass);
        canvas.drawPath(
          Path()
            ..moveTo(4, 20)
            ..cubicTo(11, 14, 18, 24, 28, 18)
            ..lineTo(28, 31)
            ..lineTo(4, 31)
            ..close(),
          Paint()..color = accent.withValues(alpha: selected ? .4 : .24),
        );
        canvas.restore();
        canvas.drawPath(
          Path()
            ..moveTo(5, 7)
            ..lineTo(8.1, 26)
            ..quadraticBezierTo(8.5, 29, 16, 29)
            ..quadraticBezierTo(23.5, 29, 23.9, 26)
            ..lineTo(27, 7),
          line,
        );
        canvas.drawOval(const Rect.fromLTRB(5, 3, 27, 10), line);
        leaf(
          Path()
            ..moveTo(20, 11)
            ..cubicTo(18.9, 13, 17.4, 14.4, 17.4, 15.5)
            ..cubicTo(17.4, 19, 22.6, 19, 22.6, 15.5)
            ..cubicTo(22.6, 14.4, 21.1, 13, 20, 11)
            ..close(),
        );
      case DietIconKind.meal:
        shape(
          Path()
            ..moveTo(3.3, 21)
            ..cubicTo(4.3, 27, 9, 30, 16, 30)
            ..cubicTo(23, 30, 27.7, 27, 28.7, 21)
            ..close(),
        );
        canvas.drawArc(
          const Rect.fromLTRB(3.3, 17.6, 28.7, 24),
          0,
          3.14,
          false,
          line,
        );
        // A fork and a leaf serving share the bowl's curved rim.
        canvas.save();
        canvas.translate(10, 11);
        canvas.rotate(-.62);
        canvas.drawPath(
          Path()
            ..moveTo(-4, -7)
            ..lineTo(-4, 0)
            ..quadraticBezierTo(0, 5, 4, 0)
            ..lineTo(4, -7),
          line,
        );
        segment(0, -7, 0, 12);
        canvas.restore();
        leaf(
          Path()
            ..moveTo(18, 20)
            ..cubicTo(15, 12, 23, 9, 29, 10)
            ..cubicTo(29, 17, 24, 21, 18, 20)
            ..close(),
        );
        canvas.drawPath(
          Path()
            ..moveTo(18.8, 20)
            ..quadraticBezierTo(21, 16.8, 25.2, 13.5),
          Paint()
            ..color = tint == Colors.transparent ? ink : AppColors.mint
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.2
            ..strokeCap = StrokeCap.round,
        );
      case DietIconKind.progress:
        for (final rect in [
          const Rect.fromLTRB(3, 26, 10, 30),
          const Rect.fromLTRB(13, 21, 20, 30),
          const Rect.fromLTRB(23, 14, 30, 30),
        ]) {
          canvas.drawRRect(
            RRect.fromRectAndRadius(rect, const Radius.circular(2)),
            fill,
          );
        }
        canvas.drawPath(
          Path()
            ..moveTo(5, 24)
            ..quadraticBezierTo(16, 21, 26, 11),
          line,
        );
        for (final p in [
          const Offset(5, 24),
          const Offset(16, 19),
          const Offset(26, 11),
        ]) {
          canvas.drawCircle(
            p,
            2.7,
            Paint()
              ..color = tint == Colors.transparent ? AppColors.surface : tint,
          );
          canvas.drawCircle(p, 2.7, line);
        }
        segment(26, 8, 25.8, 4);
        leaf(
          Path()
            ..moveTo(25.8, 5)
            ..cubicTo(20, 5.7, 19.3, 1.7, 20, 1)
            ..cubicTo(24, .8, 26, 2.5, 25.8, 5)
            ..close(),
        );
        leaf(
          Path()
            ..moveTo(26, 4)
            ..cubicTo(25.5, 1, 29, .3, 31, 1)
            ..cubicTo(31, 4.3, 28.8, 5, 26, 4)
            ..close(),
        );
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _DietIconPainter old) =>
      old.kind != kind ||
      old.ink != ink ||
      old.accent != accent ||
      old.tint != tint ||
      old.selected != selected ||
      old.detailed != detailed;
}
