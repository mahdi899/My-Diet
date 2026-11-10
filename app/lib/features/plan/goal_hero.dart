import 'package:flutter/material.dart';

import '../../core/theme/tokens.dart';
import '../../data/demo_store.dart';
import '../../presentation/widgets/kit/kit.dart';
import 'goal_math.dart';

class GoalHero extends StatelessWidget {
  const GoalHero({super.key, required this.goal, required this.nutrition});

  final GoalView goal;
  final DayNutrition nutrition;

  @override
  Widget build(BuildContext context) {
    final ring = goal.project ? goal.progress : nutrition.calorieUnit;
    return AppCard(
      key: const ValueKey('plan-hero'),
      padding: const EdgeInsets.all(18),
      shadows: AppShadows.lifted,
      child: Column(
        children: [
          Row(
            children: [
              Ring(
                value: ring,
                size: 108,
                strokeWidth: 10,
                child: FittedBox(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Ticker(
                        value: goal.current,
                        fractionDigits: fractionDigits(goal.current),
                        style: const TextStyle(
                          fontSize: 26,
                          fontWeight: FontWeight.bold,
                          color: AppColors.ink,
                          height: 1.1,
                        ),
                      ),
                      const Text(
                        'کیلو',
                        style: TextStyle(color: AppColors.muted, fontSize: 11),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      goal.pregnant ? 'بارداری' : 'هدف',
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 12,
                      ),
                    ),
                    if (goal.goal.isNotEmpty)
                      Text(
                        goal.goal,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                    const SizedBox(height: 6),
                    if (goal.target != null)
                      Text(
                        'به ${kilos(goal.target!)} کیلو',
                        style: const TextStyle(
                          color: AppColors.emeraldDark,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    if (goal.etaDays != null)
                      Text(
                        etaLabel(goal.etaDays),
                        style: const TextStyle(
                          color: AppColors.muted,
                          fontSize: 12,
                        ),
                      ),
                    const SizedBox(height: 8),
                    Ticker(
                      value: nutrition.targetKcal,
                      suffix: ' کیلوکالری',
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: AppColors.ink,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              _MacroRing(
                label: 'پروتئین',
                eaten: nutrition.eaten.protein,
                planned: nutrition.planned.protein,
                colors: const [AppColors.sky, AppColors.emerald],
              ),
              _MacroRing(
                label: 'کربو',
                eaten: nutrition.eaten.carbs,
                planned: nutrition.planned.carbs,
                colors: const [AppColors.lime, AppColors.emerald],
              ),
              _MacroRing(
                label: 'چربی',
                eaten: nutrition.eaten.fat,
                planned: nutrition.planned.fat,
                colors: const [AppColors.amber, AppColors.coral],
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MacroRing extends StatelessWidget {
  const _MacroRing({
    required this.label,
    required this.eaten,
    required this.planned,
    required this.colors,
  });

  final String label;
  final int eaten, planned;
  final List<Color> colors;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Ring(
            value: unitRatio(eaten, planned),
            size: 52,
            strokeWidth: 5,
            colors: colors,
          ),
          const SizedBox(height: 6),
          Text(
            label,
            style: const TextStyle(color: AppColors.muted, fontSize: 11),
          ),
          Text(
            fa(planned),
            style: const TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 13,
              height: 1.3,
            ),
          ),
        ],
      ),
    );
  }
}
