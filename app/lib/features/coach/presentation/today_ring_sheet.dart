import 'package:flutter/material.dart';

import '../../../core/theme/tokens.dart';
import '../../../data/demo_store.dart';
import '../../../presentation/widgets/kit/kit.dart';
import '../../plan/goal_math.dart';
import '../../shell/shell_tab.dart';

void showTodayRingSheet(BuildContext context) {
  final store = DemoScope.of(context);
  final day = nutritionOn(store, store.today);
  final goal = day.targetKcal <= 0 ? 1800 : day.targetKcal;
  showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    backgroundColor: AppColors.surface,
    builder: (context) => Padding(
      padding: const EdgeInsets.fromLTRB(24, 0, 24, 28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('حلقهٔ امروز', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 18),
          Ring(
            value: day.eatenKcal / goal,
            size: 168,
            strokeWidth: 14,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  fa(day.eatenKcal),
                  style: const TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w800,
                    color: AppColors.ink,
                  ),
                ),
                Text(
                  'از ${fa(goal)}',
                  style: const TextStyle(color: AppColors.muted, fontSize: 12),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'پروتئین ${fa(day.eaten.protein)} از ${fa(day.planned.protein)} گرم',
            style: const TextStyle(color: AppColors.inkSoft, height: 1.7),
          ),
        ],
      ),
    ),
  );
}

/// Pops the coach and any page that opened it, then shows خانه.
void closeCoachToHome(BuildContext context) {
  ShellTabScope.maybeOf(context)?.showHome();
  Navigator.of(context).popUntil((route) => route.isFirst);
}
