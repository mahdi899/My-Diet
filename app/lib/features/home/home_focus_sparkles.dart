import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/theme/tokens.dart';

/// Soft stars that drift across a card. Still when motion is reduced or in tests.
class HomeFocusSparkles extends StatefulWidget {
  const HomeFocusSparkles({super.key});

  @override
  State<HomeFocusSparkles> createState() => _HomeFocusSparklesState();
}

class _HomeFocusSparklesState extends State<HomeFocusSparkles>
    with SingleTickerProviderStateMixin {
  late final AnimationController _life = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 9000),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final play =
        TickerMode.valuesOf(context).enabled &&
        !MediaQuery.disableAnimationsOf(context);
    if (play) {
      if (!_life.isAnimating) _life.repeat();
    } else if (_life.isAnimating) {
      _life.stop();
    }
  }

  @override
  void dispose() {
    _life.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: IgnorePointer(
        child: RepaintBoundary(
          child: AnimatedBuilder(
            animation: _life,
            builder: (context, _) => CustomPaint(
              painter: _StarPainter(_life.value),
              child: const SizedBox.expand(),
            ),
          ),
        ),
      ),
    );
  }
}

class _StarPainter extends CustomPainter {
  const _StarPainter(this.t);
  final double t;

  static const _colors = [
    Colors.white,
    AppColors.lime,
    Color(0xFFFFF6D8),
    AppColors.emerald,
  ];

  @override
  void paint(Canvas canvas, Size size) {
    if (size.isEmpty) return;
    final paint = Paint()..isAntiAlias = true;
    for (var i = 0; i < 18; i++) {
      final seed = i * 97.0;
      final phase = (seed % 100) / 100;
      final life = (t + phase) % 1.0;
      final fade = math.sin(life * math.pi);
      if (fade < 0.08) continue;
      final x = (0.08 + (i * 53 % 84) / 100) * size.width;
      final y = (0.08 + (i * 37 % 78) / 100) * size.height;
      final drift = math.sin((t + phase) * math.pi * 2) * 4;
      final pos = Offset(x + drift, y - life * 10);
      final radius = 1.4 + (i % 4) * 0.7;
      paint.color = _colors[i % _colors.length].withValues(
        alpha: 0.18 + 0.45 * fade,
      );
      canvas.save();
      canvas.translate(pos.dx, pos.dy);
      canvas.rotate(life * 0.8);
      _star(canvas, paint, radius);
      canvas.restore();
    }
  }

  void _star(Canvas canvas, Paint paint, double radius) {
    final path = Path();
    for (var i = 0; i < 4; i++) {
      final angle = i * math.pi / 2;
      path.moveTo(0, 0);
      path.lineTo(math.cos(angle) * radius, math.sin(angle) * radius);
    }
    paint.strokeWidth = 1.1;
    paint.style = PaintingStyle.stroke;
    canvas.drawPath(path, paint);
    paint.style = PaintingStyle.fill;
    canvas.drawCircle(Offset.zero, radius * 0.28, paint);
  }

  @override
  bool shouldRepaint(_StarPainter oldDelegate) => oldDelegate.t != t;
}
