import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../core/motion/motion.dart';
import '../../core/theme/tokens.dart';
import '../widgets/brand_mark.dart';

/// Light splash: leaf mark, a soft glow, and the «رژیم من» wordmark.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _glow = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1600),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (Motion.reduced(context)) {
      _glow.stop();
      _glow.value = 0.35;
    } else if (!_glow.isAnimating) {
      _glow.repeat();
    }
  }

  @override
  void dispose() {
    _glow.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: DecoratedBox(
        decoration: const BoxDecoration(gradient: AppGradients.warmBackground),
        child: Center(
          child: AnimatedBuilder(
            animation: _glow,
            builder: (context, child) {
              final pulse = 0.5 + 0.5 * math.sin(_glow.value * math.pi * 2);
              return Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.emerald.withValues(
                            alpha: 0.22 + 0.28 * pulse,
                          ),
                          blurRadius: 36 + 22 * pulse,
                          spreadRadius: 2 + 6 * pulse,
                        ),
                        BoxShadow(
                          color: AppColors.lime.withValues(
                            alpha: 0.18 + 0.2 * pulse,
                          ),
                          blurRadius: 18,
                          spreadRadius: 1,
                        ),
                      ],
                    ),
                    child: Transform.scale(
                      scale: 0.96 + 0.04 * pulse,
                      child: child,
                    ),
                  ),
                  const SizedBox(height: 22),
                  const Text(
                    'رژیم من',
                    style: TextStyle(
                      color: AppColors.emeraldDeep,
                      fontSize: 28,
                      fontWeight: FontWeight.w800,
                      height: 1.4,
                    ),
                  ),
                ],
              );
            },
            child: const SabzineMark(size: 112),
          ),
        ),
      ),
    );
  }
}
