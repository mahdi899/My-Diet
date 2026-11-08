import 'dart:math' as math;
import 'package:flutter/material.dart';

void showMealCelebration(BuildContext context) {
  if (MediaQuery.disableAnimationsOf(context)) return;
  final overlay = Overlay.of(context, rootOverlay: true);
  late final OverlayEntry entry;
  entry = OverlayEntry(
    builder: (_) => Positioned.fill(
      child: MealCelebration(
        onComplete: () {
          entry.remove();
          entry.dispose();
        },
      ),
    ),
  );
  overlay.insert(entry);
}

class MealCelebration extends StatefulWidget {
  const MealCelebration({super.key, required this.onComplete});
  final VoidCallback onComplete;
  @override
  State<MealCelebration> createState() => _MealCelebrationState();
}

class _MealCelebrationState extends State<MealCelebration>
    with SingleTickerProviderStateMixin {
  late final AnimationController animation =
      AnimationController(
        vsync: this,
        duration: const Duration(milliseconds: 2200),
      )..addStatusListener((s) {
        if (s == AnimationStatus.completed) widget.onComplete();
      });
  @override
  void initState() {
    super.initState();
    animation.forward();
  }

  @override
  void dispose() {
    animation.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => IgnorePointer(
    child: ExcludeSemantics(
      child: AnimatedBuilder(
        animation: animation,
        builder: (context, _) =>
            CustomPaint(painter: _PartyPainter(animation.value)),
      ),
    ),
  );
}

class _PartyPainter extends CustomPainter {
  _PartyPainter(this.progress);
  final double progress;
  static const colors = [
    Color(0xFFF4BB49),
    Color(0xFFEE8CA5),
    Color(0xFF6CC5C0),
    Color(0xFFA693D8),
    Color(0xFF9BCD76),
    Color(0xFFEA9565),
  ];
  @override
  void paint(Canvas canvas, Size size) {
    final random = math.Random(731), time = progress * 2.2;
    final fade = (progress < .75 ? 1.0 : (1 - progress) / .25).clamp(0.0, 1.0);
    for (var i = 0; i < 70; i++) {
      final angle = -math.pi + random.nextDouble() * math.pi;
      final speed = 160 + random.nextDouble() * 270;
      final x = size.width * .5 + math.cos(angle) * speed * time;
      final y =
          size.height * .52 +
          math.sin(angle) * speed * time +
          140 * time * time;
      final paint = Paint()
        ..color = colors[i % colors.length].withValues(alpha: fade);
      canvas.save();
      canvas.translate(x, y);
      canvas.rotate(time * (random.nextDouble() * 8 - 4));
      if (i % 3 == 0) {
        paint.style = PaintingStyle.stroke;
        paint.strokeWidth = 3;
        canvas.drawPath(
          Path()
            ..moveTo(-3, -10)
            ..quadraticBezierTo(6, -4, 0, 1)
            ..quadraticBezierTo(-6, 6, 3, 12),
          paint,
        );
      } else {
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            Rect.fromCenter(
              center: Offset.zero,
              width: 5 + random.nextDouble() * 4,
              height: 10 + random.nextDouble() * 7,
            ),
            const Radius.circular(1),
          ),
          paint,
        );
      }
      canvas.restore();
    }
    for (var i = 0; i < 6; i++) {
      final x = size.width * (.08 + i * .168) + math.sin(time * 2 + i) * 12;
      final y = size.height + 50 - progress * (size.height + 230) + i % 3 * 45;
      final color = colors[i].withValues(alpha: fade);
      final rect = Rect.fromCenter(center: Offset(x, y), width: 36, height: 46);
      canvas.drawOval(rect, Paint()..color = color);
      canvas.drawOval(
        Rect.fromCenter(center: Offset(x - 7, y - 9), width: 6, height: 12),
        Paint()..color = Colors.white.withValues(alpha: .45 * fade),
      );
      canvas.drawPath(
        Path()
          ..moveTo(x, y + 21)
          ..lineTo(x - 4, y + 28)
          ..lineTo(x + 4, y + 28)
          ..close(),
        Paint()..color = color,
      );
      canvas.drawPath(
        Path()
          ..moveTo(x, y + 28)
          ..cubicTo(x + 10, y + 45, x - 9, y + 57, x, y + 77),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1
          ..color = const Color(0xFF809078).withValues(alpha: .6 * fade),
      );
    }
  }

  @override
  bool shouldRepaint(covariant _PartyPainter oldDelegate) =>
      oldDelegate.progress != progress;
}
