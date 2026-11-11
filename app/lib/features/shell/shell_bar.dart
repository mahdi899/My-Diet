import 'package:flutter/material.dart';

import '../../core/motion/motion.dart';
import '../../core/theme/tokens.dart';
import '../../presentation/widgets/kit/kit.dart';

/// Bottom navigation. خانه and برنامه sit in the pill; مربی is the raised orb.
class ShellTabBar extends StatelessWidget {
  const ShellTabBar({
    super.key,
    required this.selected,
    required this.onCoach,
    required this.onHome,
    required this.onPlan,
  });

  /// 0 = مربی, 1 = خانه, 2 = برنامه.
  final int selected;
  final VoidCallback onCoach;
  final VoidCallback onHome;
  final VoidCallback onPlan;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      key: const ValueKey('shell-tab-bar'),
      height: 100,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: GlassBar(
              height: 64,
              radius: AppRadius.pill,
              padding: const EdgeInsets.all(6),
              shadows: AppShadows.lifted,
              child: Row(
                children: [
                  Expanded(
                    child: _Tab(
                      key: const ValueKey('tab-home'),
                      icon: Icons.home_rounded,
                      label: 'خانه',
                      selected: selected == 1,
                      onTap: onHome,
                    ),
                  ),
                  const SizedBox(width: 84),
                  Expanded(
                    child: _Tab(
                      key: const ValueKey('tab-plan'),
                      icon: Icons.calendar_month_rounded,
                      label: 'برنامه',
                      selected: selected == 2,
                      onTap: onPlan,
                    ),
                  ),
                ],
              ),
            ),
          ),
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: Center(child: _CoachOrb(onTap: onCoach)),
          ),
        ],
      ),
    );
  }
}

class _CoachOrb extends StatelessWidget {
  const _CoachOrb({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return PressableScale(
      key: const ValueKey('tab-coach'),
      semanticLabel: 'مربی',
      onTap: onTap,
      child: Container(
        width: 74,
        height: 74,
        padding: const EdgeInsets.all(4),
        decoration: const BoxDecoration(
          shape: BoxShape.circle,
          color: Color(0xFFFFFFFF),
          boxShadow: AppShadows.cta,
        ),
        child: const DecoratedBox(
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: AppGradients.cta,
          ),
          child: Center(child: _Sparkles()),
        ),
      ),
    );
  }
}

class _Sparkles extends StatelessWidget {
  const _Sparkles();

  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      width: 40,
      height: 40,
      child: Stack(
        alignment: Alignment.center,
        clipBehavior: Clip.none,
        children: [
          Align(
            alignment: Alignment(-0.2, -0.15),
            child: Icon(Icons.auto_awesome, color: Color(0xFFFFFFFF), size: 30),
          ),
          Align(
            alignment: Alignment(0.72, 0.62),
            child: Icon(Icons.auto_awesome, color: Color(0xF2FFFFFF), size: 14),
          ),
        ],
      ),
    );
  }
}

class _Tab extends StatelessWidget {
  const _Tab({
    super.key,
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = selected ? AppColors.emeraldDark : AppColors.muted;
    return PressableScale(
      semanticLabel: label,
      onTap: onTap,
      child: AnimatedContainer(
        duration: Motion.of(context, Motion.quick),
        curve: Motion.curve,
        height: 52,
        decoration: BoxDecoration(
          color: selected ? AppColors.mint : const Color(0x00000000),
          borderRadius: BorderRadius.circular(AppRadius.pill),
        ),
        child: FittedBox(
          fit: BoxFit.scaleDown,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: color, size: 20),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  color: color,
                  fontWeight: FontWeight.w800,
                  fontSize: 14,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
