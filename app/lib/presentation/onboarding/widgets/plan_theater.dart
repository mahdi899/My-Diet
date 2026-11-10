import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/tokens.dart';
import '../../widgets/kit/sparkle.dart';
import 'decor_photo.dart';

/// «در حال ساخت برنامه شما».
///
/// The animation is cosmetic and finishes on its own (about 3.2s). Callers
/// must start the real submit immediately and hide this widget as soon as
/// the submit fails — [onFinished] is only the end of the animation.
class PlanBuildTheater extends StatefulWidget {
  const PlanBuildTheater({
    super.key,
    this.title = 'در حال ساخت برنامه شما',
    this.duration = const Duration(milliseconds: 3200),
    this.onFinished,
  });

  final String title;
  final Duration duration;
  final VoidCallback? onFinished;

  @override
  State<PlanBuildTheater> createState() => _PlanBuildTheaterState();
}

class _PlanBuildTheaterState extends State<PlanBuildTheater>
    with SingleTickerProviderStateMixin {
  static const _steps = [
    'خواندن پاسخ‌ها',
    'چیدن وعده‌ها',
    'تنظیم انرژی',
    'بررسی ایمنی',
  ];
  static const _meals = ['صبحانه', 'ناهار', 'شام'];

  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: widget.duration,
  );
  bool _booted = false;
  bool _deferFinish = false;
  int _ticked = 0;

  @override
  void initState() {
    super.initState();
    _c.addListener(_tick);
    _c.addStatusListener((status) {
      if (status != AnimationStatus.completed || !mounted) return;
      final done = widget.onFinished;
      if (done == null) return;
      if (_deferFinish) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) done();
        });
      } else {
        done();
      }
    });
  }

  void _tick() {
    final n = (_c.value * _steps.length).floor().clamp(0, _steps.length);
    if (n != _ticked && _c.value < 1) {
      _ticked = n;
      Haptics.tick();
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_booted) return;
    _booted = true;
    if (Motion.reduced(context)) {
      _deferFinish = true;
      _c.value = 1;
      _deferFinish = false;
    } else {
      _c.forward();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        return SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: constraints.maxHeight - 48),
            child: AnimatedBuilder(
              animation: _c,
              builder: (context, _) {
                final t = _c.value;
                final pulse = 0.5 + 0.5 * math.sin(t * math.pi * 5);
                return Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    SparkleBurst(
                      autoPlay: true,
                      particles: 18,
                      radius: 100,
                      child: SizedBox(
                        width: 168,
                        height: 168,
                        child: Stack(
                          alignment: Alignment.center,
                          children: [
                            Container(
                              width: 150 + 10 * pulse,
                              height: 150 + 10 * pulse,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                boxShadow: [
                                  BoxShadow(
                                    color: AppColors.emerald.withValues(
                                      alpha: 0.18 + 0.22 * pulse,
                                    ),
                                    blurRadius: 28 + 16 * pulse,
                                    spreadRadius: 2,
                                  ),
                                ],
                              ),
                            ),
                            CustomPaint(
                              size: const Size.square(158),
                              painter: _PulseRingPainter(t, pulse),
                            ),
                            ClipOval(
                              child: SizedBox(
                                width: 108,
                                height: 108,
                                child: _RotatingMeals(t: t),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 28),
                    Text(
                      widget.title,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 18),
                    for (var i = 0; i < _steps.length; i++)
                      _CheckRow(
                        label: _steps[i],
                        on: t >= (i + 0.2) / _steps.length,
                      ),
                  ],
                );
              },
            ),
          ),
        );
      },
    );
  }
}

class _RotatingMeals extends StatelessWidget {
  const _RotatingMeals({required this.t});
  final double t;

  @override
  Widget build(BuildContext context) {
    final pos = t * _PlanBuildTheaterState._meals.length;
    final i = pos.floor().clamp(0, _PlanBuildTheaterState._meals.length - 1);
    final next = (i + 1) % _PlanBuildTheaterState._meals.length;
    final frac = (pos - pos.floor()).clamp(0.0, 1.0);
    final atEnd = t >= 0.999;
    return Stack(
      fit: StackFit.expand,
      children: [
        Opacity(
          opacity: atEnd ? 1 : (1 - frac),
          child: DecorPhoto(label: _PlanBuildTheaterState._meals[i], radius: 0),
        ),
        if (!atEnd)
          Opacity(
            opacity: frac,
            child: DecorPhoto(
              label: _PlanBuildTheaterState._meals[next],
              radius: 0,
            ),
          ),
      ],
    );
  }
}

class _CheckRow extends StatelessWidget {
  const _CheckRow({required this.label, required this.on});
  final String label;
  final bool on;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 5),
    child: Opacity(
      opacity: on ? 1 : 0.38,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            on ? Icons.check_circle_rounded : Icons.circle_outlined,
            size: 18,
            color: on ? AppColors.emerald : AppColors.muted,
          ),
          const SizedBox(width: 8),
          Text(label, style: const TextStyle(fontSize: 13.5, height: 1.5)),
        ],
      ),
    ),
  );
}

class _PulseRingPainter extends CustomPainter {
  _PulseRingPainter(this.t, this.pulse);
  final double t, pulse;

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = size.width / 2 - 8;
    final track = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 8
      ..color = AppColors.mint;
    final arc = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 8
      ..strokeCap = StrokeCap.round
      ..shader = const SweepGradient(
        colors: [AppColors.lime, AppColors.emerald],
        transform: GradientRotation(-math.pi / 2),
      ).createShader(Offset.zero & size);
    canvas.drawCircle(c, r, track);
    canvas.drawArc(
      Rect.fromCircle(center: c, radius: r),
      -math.pi / 2,
      math.pi * 2 * t.clamp(0.0, 1.0),
      false,
      arc,
    );
    canvas.drawCircle(
      c,
      r + 6 + 4 * pulse,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.4
        ..color = AppColors.emerald.withValues(alpha: 0.25 + 0.25 * pulse),
    );
  }

  @override
  bool shouldRepaint(_PulseRingPainter old) => old.t != t || old.pulse != pulse;
}
