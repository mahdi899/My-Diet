import 'package:flutter/material.dart';

import '../../core/motion/motion.dart';
import '../../core/icons/diet_icon.dart';
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
                      icon: DietIconKind.home,
                      label: 'خانه',
                      selected: selected == 1,
                      onTap: onHome,
                    ),
                  ),
                  const SizedBox(width: 84),
                  Expanded(
                    child: _Tab(
                      key: const ValueKey('tab-plan'),
                      icon: DietIconKind.plan,
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
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
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
              child: Center(
                child: DietIcon(
                  DietIconKind.coach,
                  size: 38,
                  color: Colors.white,
                ),
              ),
            ),
          ),
          const SizedBox(height: 2),
          const Text(
            'مربی',
            style: TextStyle(
              fontSize: 11,
              height: 1.4,
              fontWeight: FontWeight.bold,
              color: AppColors.emeraldDark,
            ),
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

  final DietIconKind icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = selected ? AppColors.emeraldDark : AppColors.muted;
    return Semantics(
      selected: selected,
      child: PressableScale(
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
                DietIcon(icon, color: color, size: 26, selected: selected),
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
      ),
    );
  }
}
