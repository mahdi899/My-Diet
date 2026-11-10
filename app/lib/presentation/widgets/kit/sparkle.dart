import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/tokens.dart';

/// Lightweight confetti/sparkle burst painted from the centre of [child].
///
/// Either bump [trigger] (any change plays once) or call
/// `GlobalKey<SparkleBurstState>.currentState!.play()`. Set [autoPlay] to
/// burst when first shown. Silent under reduce-motion.
class SparkleBurst extends StatefulWidget {
  const SparkleBurst({
    super.key,
    this.child,
    this.trigger,
    this.autoPlay = false,
    this.particles = 26,
    this.radius = 120,
    this.duration = const Duration(milliseconds: 1100),
    this.colors = const [
      AppColors.lime,
      AppColors.amber,
      AppColors.emerald,
      AppColors.coral,
      Colors.white,
    ],
  });

  final Widget? child;
  final Object? trigger;
  final bool autoPlay;
  final int particles;

  /// How far particles travel (logical px).
  final double radius;
  final Duration duration;
  final List<Color> colors;

  @override
  State<SparkleBurst> createState() => SparkleBurstState();
}

class SparkleBurstState extends State<SparkleBurst>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: widget.duration,
  );
  List<_Particle> _ps = const [];
  int _seed = 1;

  @override
  void initState() {
    super.initState();
    if (widget.autoPlay) {
      WidgetsBinding.instance.addPostFrameCallback((_) => play());
    }
  }

  @override
  void didUpdateWidget(SparkleBurst oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.trigger != oldWidget.trigger) play();
  }

  /// Plays one burst.
  void play() {
    if (!mounted || Motion.reduced(context)) return;
    final rnd = math.Random(_seed++);
    _ps = List.generate(widget.particles, (i) {
      final a = rnd.nextDouble() * 2 * math.pi;
      return _Particle(
        angle: a,
        dist: widget.radius * (0.45 + rnd.nextDouble() * 0.6),
        size: 3 + rnd.nextDouble() * 5,
        color: widget.colors[rnd.nextInt(widget.colors.length)],
        shape: rnd.nextInt(3),
        spin: (rnd.nextDouble() - 0.5) * 8,
        gravity: 20 + rnd.nextDouble() * 50,
      );
    });
    _c.forward(from: 0);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Stack(
    alignment: Alignment.center,
    clipBehavior: Clip.none,
    children: [
      ?widget.child,
      Positioned.fill(
        child: IgnorePointer(
          child: AnimatedBuilder(
            animation: _c,
            builder: (context, _) => _c.isAnimating
                ? CustomPaint(painter: SparklePainter(_ps, _c.value))
                : const SizedBox.shrink(),
          ),
        ),
      ),
    ],
  );
}

class _Particle {
  const _Particle({
    required this.angle,
    required this.dist,
    required this.size,
    required this.color,
    required this.shape,
    required this.spin,
    required this.gravity,
  });
  final double angle, dist, size, spin, gravity;
  final Color color;
  final int shape; // 0 circle, 1 rect, 2 four-point star
}

/// Paints the particles at animation time [t] (0..1) around the canvas centre.
class SparklePainter extends CustomPainter {
  SparklePainter(this._ps, this.t);
  final List<_Particle> _ps;
  final double t;

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final ease = Curves.easeOutCubic.transform(t);
    final fade = t < 0.6 ? 1.0 : (1 - (t - 0.6) / 0.4).clamp(0.0, 1.0);
    for (final p in _ps) {
      final pos =
          c +
          Offset(math.cos(p.angle), math.sin(p.angle)) * (p.dist * ease) +
          Offset(0, p.gravity * t * t);
      final paint = Paint()..color = p.color.withValues(alpha: fade);
      final s = p.size * (1 - 0.35 * t);
      canvas.save();
      canvas.translate(pos.dx, pos.dy);
      canvas.rotate(p.spin * t);
      switch (p.shape) {
        case 0:
          canvas.drawCircle(Offset.zero, s / 2, paint);
        case 1:
          canvas.drawRRect(
            RRect.fromRectAndRadius(
              Rect.fromCenter(center: Offset.zero, width: s * 1.6, height: s),
              const Radius.circular(2),
            ),
            paint,
          );
        default:
          canvas.drawPath(_star(s * 1.3), paint);
      }
      canvas.restore();
    }
  }

  static Path _star(double r) {
    final k = r * 0.28;
    return Path()
      ..moveTo(0, -r)
      ..quadraticBezierTo(k, -k, r, 0)
      ..quadraticBezierTo(k, k, 0, r)
      ..quadraticBezierTo(-k, k, -r, 0)
      ..quadraticBezierTo(-k, -k, 0, -r)
      ..close();
  }

  @override
  bool shouldRepaint(SparklePainter old) => old.t != t || old._ps != _ps;
}

/// Fires a one-shot burst over everything, centred on [origin] (global
/// coordinates) or the screen centre. Good for "meal logged!" moments.
void showSparkle(BuildContext context, {Offset? origin, int particles = 36}) {
  if (Motion.reduced(context)) return;
  final overlay = Overlay.maybeOf(context, rootOverlay: true);
  if (overlay == null) return;
  final size = MediaQuery.sizeOf(context);
  final at = origin ?? size.center(Offset.zero);
  late OverlayEntry entry;
  entry = OverlayEntry(
    builder: (_) => Positioned(
      left: at.dx - 160,
      top: at.dy - 160,
      width: 320,
      height: 320,
      child: IgnorePointer(
        child: SparkleBurst(
          autoPlay: true,
          particles: particles,
          radius: 150,
          key: ValueKey(entry.hashCode),
        ),
      ),
    ),
  );
  overlay.insert(entry);
  Future<void>.delayed(const Duration(milliseconds: 1500), () {
    if (entry.mounted) entry.remove();
  });
}
