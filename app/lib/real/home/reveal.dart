import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../theme.dart';
import '../core/motion.dart';

/// The moment the doctor's approval lands. A short, warm celebration, then straight to the plan.
class PlanReveal extends StatefulWidget {
  const PlanReveal({super.key, required this.onDone});
  final VoidCallback onDone;
  @override
  State<PlanReveal> createState() => _PlanRevealState();
}

class _PlanRevealState extends State<PlanReveal>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2600),
  )..forward();

  @override
  void initState() {
    super.initState();
    Haptics.success();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: pine,
    body: SafeArea(
      child: AnimatedBuilder(
        animation: _c,
        builder: (context, _) {
          final t = _c.value;
          final pop = Curves.elasticOut.transform((t * 2).clamp(0, 1));
          final text = Curves.easeOut.transform(((t - 0.35) * 2).clamp(0, 1));
          return Stack(
            children: [
              Positioned.fill(child: CustomPaint(painter: _Sparks(t))),
              Center(
                child: Padding(
                  padding: const EdgeInsets.all(28),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Transform.scale(
                        scale: pop,
                        child: Container(
                          width: 110,
                          height: 110,
                          decoration: const BoxDecoration(
                            color: Colors.white,
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.verified,
                            size: 60,
                            color: pine,
                          ),
                        ),
                      ),
                      const SizedBox(height: 28),
                      Opacity(
                        opacity: text,
                        child: Transform.translate(
                          offset: Offset(0, 16 * (1 - text)),
                          child: Column(
                            children: [
                              const Text(
                                'برنامه‌ات تأیید شد',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 28,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              const SizedBox(height: 10),
                              Text(
                                'دکتر تغذیه برنامه‌ات رو بررسی و تأیید کرد.\nاز همین امروز می‌تونی شروع کنی.',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  color: Colors.white.withValues(alpha: 0.85),
                                  height: 2,
                                ),
                              ),
                              const SizedBox(height: 32),
                              FilledButton(
                                style: FilledButton.styleFrom(
                                  backgroundColor: Colors.white,
                                  foregroundColor: pine,
                                ),
                                onPressed: widget.onDone,
                                child: const Text('ببینم برنامه چیه'),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    ),
  );
}

class _Sparks extends CustomPainter {
  _Sparks(this.t);
  final double t;
  static final _rng = math.Random(7);
  static final _seeds = List.generate(
    36,
    (_) => (_rng.nextDouble(), _rng.nextDouble(), _rng.nextDouble()),
  );

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height * 0.4);
    for (final (a, b, c) in _seeds) {
      final angle = a * math.pi * 2;
      final reach =
          (0.2 + b * 0.6) *
          size.shortestSide *
          Curves.easeOut.transform(t.clamp(0, 1));
      final pos = center + Offset(math.cos(angle), math.sin(angle)) * reach;
      final fade = (1 - t).clamp(0.0, 1.0);
      canvas.drawCircle(
        pos,
        2 + c * 4,
        Paint()
          ..color =
              (c > 0.5 ? const Color(0xFFFFD98A) : const Color(0xFFB5D88A))
                  .withValues(alpha: fade),
      );
    }
  }

  @override
  bool shouldRepaint(_Sparks old) => old.t != t;
}
