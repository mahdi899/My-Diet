import 'package:flutter/material.dart';
import '../theme.dart';

class SabzineMark extends StatelessWidget {
  const SabzineMark({super.key, this.size = 104});
  final double size;

  @override
  Widget build(BuildContext context) => Semantics(
    image: true,
    label: 'نشان رژیم من',
    child: SizedBox.square(
      dimension: size,
      child: CustomPaint(painter: _MarkPainter()),
    ),
  );
}

class _MarkPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / 108, size.height / 108);
    final stroke = Paint()
      ..color = pine
      ..strokeWidth = 3.4
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke;
    canvas.drawPath(
      Path()
        ..moveTo(53, 85)
        ..lineTo(53, 51),
      stroke,
    );
    canvas.drawPath(
      Path()
        ..moveTo(53, 51)
        ..cubicTo(31, 53, 22, 35, 26, 21)
        ..cubicTo(47, 19, 63, 32, 55, 52),
      stroke,
    );
    canvas.drawPath(
      Path()
        ..moveTo(55, 72)
        ..cubicTo(55, 48, 72, 32, 88, 33)
        ..cubicTo(90, 53, 78, 74, 55, 72),
      stroke,
    );
    canvas.drawPath(
      Path()
        ..moveTo(54, 52)
        ..lineTo(36, 31)
        ..moveTo(55, 72)
        ..lineTo(78, 44),
      stroke..strokeWidth = 2.6,
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _MarkPainter oldDelegate) => false;
}
