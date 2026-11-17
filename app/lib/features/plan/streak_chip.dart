import 'package:flutter/material.dart';

import '../../data/demo_store.dart';
import '../../core/theme/tokens.dart';
import '../../core/icons/diet_icon.dart';
import '../../presentation/widgets/kit/app_card.dart';
import '../home/journey_art.dart';

/// Compact streak / reward chip shared by home and the plan tab.
class StreakChip extends StatelessWidget {
  const StreakChip({super.key, this.explained = false});
  final bool explained;

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final published = store.hasUserRequest && store.userRequest.isPublished;
    final days = published ? store.streakProgress.consecutiveQualified : 0;
    final reward = store.pendingWeeklyRewards.isNotEmpty;
    if (explained) {
      return AppCard(
        key: const ValueKey('streak-chip'),
        color: const Color(0xFFEDF5E3),
        padding: const EdgeInsets.all(18),
        radius: 26,
        shadows: const [],
        child: LayoutBuilder(
          builder: (context, constraints) {
            final wide =
                constraints.maxWidth >= 270 &&
                MediaQuery.textScalerOf(context).scale(14) <= 18;
            final content = Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    DietIcon(DietIconKind.calendar, size: 24),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'پیوستگی برنامه',
                        style: TextStyle(
                          color: Color(0xFF07543A),
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          height: 1.6,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Text(
                  published
                      ? '${fa(days)} روز پیاپی'
                      : 'با آماده‌شدن برنامه شروع می‌شود',
                  style: TextStyle(
                    color: const Color(0xFF07543A),
                    fontSize: published ? 24 : 14,
                    fontWeight: FontWeight.bold,
                    height: 1.5,
                  ),
                ),
              ],
            );
            final path = JourneyPath(
              completed: days,
              total: store.streakProgress.requiredDays,
            );
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (wide)
                  Row(
                    children: [
                      Expanded(flex: 6, child: content),
                      const SizedBox(width: 10),
                      Expanded(flex: 5, child: path),
                    ],
                  )
                else ...[
                  content,
                  const SizedBox(height: 8),
                  path,
                ],
                const SizedBox(height: 8),
                const Text(
                  'با ثبت همهٔ وعده‌ها، یک روز کامل می‌شود.',
                  style: TextStyle(
                    fontSize: 12,
                    height: 1.8,
                    color: Color(0xFF48653F),
                  ),
                ),
                if (reward) ...[
                  const SizedBox(height: 6),
                  const Text(
                    'پاداش تکمیل برنامه آماده است.',
                    style: TextStyle(
                      fontSize: 12,
                      color: AppColors.emeraldDark,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ],
            );
          },
        ),
      );
    }
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
