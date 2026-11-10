import 'package:flutter/material.dart';

import '../../data/demo_store.dart';
import '../../core/theme/tokens.dart';

/// Compact streak / reward chip shared by home and the plan tab.
class StreakChip extends StatelessWidget {
  const StreakChip({super.key});

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final published = store.hasUserRequest && store.userRequest.isPublished;
    final days = published ? store.streakProgress.consecutiveQualified : 0;
    final reward = store.pendingWeeklyRewards.isNotEmpty;
    return Align(
      alignment: AlignmentDirectional.centerStart,
      child: Container(
        key: const ValueKey('streak-chip'),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: AppColors.mint,
          borderRadius: BorderRadius.circular(AppRadius.pill),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.local_fire_department_rounded,
              color: AppColors.amber,
              size: 18,
            ),
            const SizedBox(width: 6),
            Text(
              reward ? '${fa(days)} روز · پاداش' : '${fa(days)} روز',
              style: const TextStyle(
                color: AppColors.emeraldDark,
                fontWeight: FontWeight.bold,
                fontSize: 13,
                height: 1.4,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
