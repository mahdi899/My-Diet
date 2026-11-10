import 'package:flutter/material.dart';

import '../../core/motion/motion.dart';
import '../../core/theme/tokens.dart';
import '../../presentation/widgets/kit/kit.dart';

/// Bottom navigation with the coach between home and plan.
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
      height: 76,
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
            Expanded(
              child: _Tab(
                key: const ValueKey('tab-coach'),
                icon: Icons.auto_awesome_rounded,
                label: 'مربی',
                selected: selected == 0,
                onTap: onCoach,
              ),
            ),
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
