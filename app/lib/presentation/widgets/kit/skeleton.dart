import 'package:flutter/material.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/tokens.dart';

/// Sweeps a soft highlight across its child (use over [Skeleton]s).
class Shimmer extends StatefulWidget {
  const Shimmer({
    super.key,
    required this.child,
    this.enabled = true,
    this.period = const Duration(milliseconds: 1400),
    this.highlight = const Color(0x99FFFFFF),
  });
  final Widget child;
  final bool enabled;
  final Duration period;
  final Color highlight;

  @override
  State<Shimmer> createState() => _ShimmerState();
}

class _ShimmerState extends State<Shimmer> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: widget.period,
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final run = widget.enabled && !Motion.reduced(context);
    if (run && !_c.isAnimating) {
      _c.repeat();
    } else if (!run) {
      _c.stop();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.enabled || Motion.reduced(context)) return widget.child;
    final dir = Directionality.of(context) == TextDirection.rtl ? -1.0 : 1.0;
    return AnimatedBuilder(
      animation: _c,
      child: widget.child,
      builder: (context, child) => ShaderMask(
        blendMode: BlendMode.srcATop,
        shaderCallback: (rect) {
          final w = rect.width;
          final dx = dir * (-w + 2 * w * _c.value);
          return LinearGradient(
            colors: [
              Colors.transparent,
              widget.highlight,
              Colors.transparent,
            ],
            stops: const [0.25, 0.5, 0.75],
            transform: _Slide(dx),
          ).createShader(rect);
        },
        child: child,
      ),
    );
  }
}

class _Slide extends GradientTransform {
  const _Slide(this.dx);
  final double dx;
  @override
  Matrix4? transform(Rect bounds, {TextDirection? textDirection}) =>
      Matrix4.translationValues(dx, 0, 0);
}

/// A placeholder block. Shimmers by default.
class Skeleton extends StatelessWidget {
  const Skeleton({
    super.key,
    this.width,
    this.height = 16,
    this.radius = 12,
    this.shimmer = true,
    this.circle = false,
  });

  /// A full-width text-line placeholder.
  const Skeleton.line({super.key, this.width, this.height = 14})
    : radius = 8,
      shimmer = true,
      circle = false;

  const Skeleton.circle({super.key, double size = 48})
    : width = size,
      height = size,
      radius = 0,
      shimmer = true,
      circle = true;

  final double? width;
  final double height;
  final double radius;
  final bool shimmer;
  final bool circle;

  static const base = Color(0xFFEFE9DA);

  @override
  Widget build(BuildContext context) {
    final box = Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: base,
        shape: circle ? BoxShape.circle : BoxShape.rectangle,
        borderRadius: circle ? null : BorderRadius.circular(radius),
      ),
    );
    return shimmer ? Shimmer(child: box) : box;
  }
}

/// Card-shaped loading placeholder (image + two lines), shimmering as one.
class SkeletonCard extends StatelessWidget {
  const SkeletonCard({super.key, this.height = 200, this.radius = 28});
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) => Shimmer(
    child: Container(
      height: height,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(radius),
        boxShadow: AppShadows.soft,
      ),
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          Skeleton(width: 160, height: 18, shimmer: false),
          SizedBox(height: 10),
          Skeleton(width: 96, height: 14, shimmer: false),
        ],
      ),
    ),
  );
}
