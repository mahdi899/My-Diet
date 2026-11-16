import 'package:flutter/material.dart';
import '../../core/motion/motion.dart';
import '../../core/theme/tokens.dart';
import '../widgets/brand_mark.dart';

/// Light splash with the approved mark and Persian wordmark.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _entrance = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  );
  late final Animation<double> _markReveal = _entrance.drive(
    CurveTween(curve: const Interval(0, 0.7, curve: Curves.easeOutCubic)),
  );
  late final Animation<double> _markScale = Tween<double>(
    begin: 0.92,
    end: 1,
  ).animate(_markReveal);
  late final Animation<double> _wordReveal = _entrance.drive(
    CurveTween(curve: const Interval(0.3, 1, curve: Curves.easeOutCubic)),
  );
  late final Animation<Offset> _wordSlide = Tween<Offset>(
    begin: const Offset(0, 0.12),
    end: Offset.zero,
  ).animate(_wordReveal);
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (Motion.reduced(context)) {
      _entrance.value = 1;
    } else if (!_started) {
      _entrance.forward();
    }
    _started = true;
  }

  @override
  void dispose() {
    _entrance.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: DecoratedBox(
        decoration: const BoxDecoration(gradient: AppGradients.warmBackground),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              FadeTransition(
                opacity: _markReveal,
                child: Stack(
                  alignment: Alignment.center,
                  clipBehavior: Clip.none,
                  children: [
                    Positioned(
                      width: 208,
                      height: 208,
                      child: RepaintBoundary(
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: RadialGradient(
                              colors: [
                                AppColors.emerald.withValues(alpha: 0.055),
                                AppColors.emerald.withValues(alpha: 0.02),
                                AppColors.emerald.withValues(alpha: 0),
                              ],
                              stops: const [0, 0.45, 1],
                            ),
                          ),
                        ),
                      ),
                    ),
                    ScaleTransition(
                      scale: _markScale,
                      child: const SabzineMark(size: 112),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 22),
              FadeTransition(
                opacity: _wordReveal,
                child: SlideTransition(
                  position: _wordSlide,
                  child: const BrandWordmark(width: 152),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
