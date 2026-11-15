import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/tokens.dart';
import '../../../data/demo_store.dart';
import '../../../presentation/widgets/kit/kit.dart';
import '../../plan/meal_detail_page.dart';
import '../data/coach_parse.dart';
import '../domain/coach_message.dart';

/// Today's context is available without taking over the conversation. Historical
/// briefs remain in the thread; a current brief's note is preserved here.
class CoachTodaySummary extends StatelessWidget {
  const CoachTodaySummary({
    super.key,
    required this.expanded,
    required this.onToggle,
    required this.onRing,
    this.brief,
    this.keyboardOpen = false,
  });
  final bool expanded;
  final bool keyboardOpen;
  final VoidCallback onToggle, onRing;
  final CoachMessage? brief;

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final meals = store.mealsOn(store.today);
    final note = asString(brief?.payload['note']);
    final briefMeals = asMapList(brief?.payload['meals']);
    final count = meals.isNotEmpty ? meals.length : briefMeals.length;
    final goal = store.calorieTarget(store.today);
    final eaten = store.consumedCalories(store.today);
    final open = expanded && !keyboardOpen;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 13, 16, 0),
      child: Material(
        color: AppColors.mint,
        borderRadius: BorderRadius.circular(22),
        clipBehavior: Clip.antiAlias,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Semantics(
              expanded: open,
              child: InkWell(
                key: const ValueKey('coach-summary-toggle'),
                onTap: onToggle,
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 11,
                  ),
                  child: Row(
                    children: [
                      Ring(
                        key: const ValueKey('coach-today'),
                        value: goal <= 0 ? 0 : eaten / goal,
                        size: 38,
                        strokeWidth: 4,
                        colors: const [AppColors.emeraldDeep],
                        trackColor: AppColors.surfaceWarm,
                        child: const Icon(
                          Icons.spa_outlined,
                          size: 15,
                          color: AppColors.emeraldDeep,
                        ),
                      ),
                      const SizedBox(width: 11),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'امروزت در یک نگاه',
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w800,
                                color: AppColors.emeraldDark,
                              ),
                            ),
                            Text(
                              count > 0
                                  ? '${fa(count)} وعده در برنامه'
                                  : 'همراه قدم‌های امروزت',
                              style: const TextStyle(
                                fontSize: 11,
                                height: 1.7,
                                color: AppColors.inkSoft,
                              ),
                            ),
                          ],
                        ),
                      ),
                      AnimatedRotation(
                        turns: open ? .5 : 0,
                        duration: Motion.of(context, Motion.quick),
                        child: const Icon(
                          Icons.keyboard_arrow_down_rounded,
                          color: AppColors.emeraldDark,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            _SummaryReveal(
              animate: !keyboardOpen,
              child: !open
                  ? const SizedBox(width: double.infinity)
                  : ConstrainedBox(
                      constraints: BoxConstraints(
                        maxHeight: MediaQuery.sizeOf(context).height * .23,
                      ),
                      child: ListView(
                        shrinkWrap: true,
                        padding: const EdgeInsets.fromLTRB(14, 0, 14, 10),
                        children: [
                          if (note.isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: Text(
                                note,
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: AppColors.inkSoft,
                                  height: 1.8,
                                ),
                              ),
                            ),
                          for (var i = 0; i < meals.length; i++)
                            ListTile(
                              dense: true,
                              contentPadding: EdgeInsets.zero,
                              title: Text(
                                '${meals[i].name} · ${meals[i].title}',
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(fontSize: 12),
                              ),
                              subtitle: meals[i].time.isEmpty
                                  ? null
                                  : Text(
                                      fa(meals[i].time),
                                      style: const TextStyle(fontSize: 10),
                                    ),
                              trailing: Icon(
                                store.mealEaten(store.today, i)
                                    ? Icons.check_circle_outline
                                    : Icons.chevron_left_rounded,
                                size: 19,
                                color: AppColors.emeraldDeep,
                              ),
                              onTap: () => Navigator.of(context).push(
                                foodDetailRoute<void>(
                                  MealDetailPage(date: store.today, index: i),
                                  reduced: Motion.reduced(context),
                                ),
                              ),
                            ),
                          if (meals.isEmpty)
                            for (final meal in briefMeals)
                              Padding(
                                padding: const EdgeInsets.symmetric(
                                  vertical: 6,
                                ),
                                child: Text(
                                  '${asString(meal['name'])} · ${asString(meal['title'])}',
                                  style: const TextStyle(fontSize: 12),
                                ),
                              ),
                          TextButton.icon(
                            onPressed: onRing,
                            icon: const Icon(
                              Icons.donut_large_rounded,
                              size: 17,
                            ),
                            label: const Text('جزئیات ثبت‌های امروز'),
                          ),
                        ],
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SummaryReveal extends StatelessWidget {
  const _SummaryReveal({required this.child, required this.animate});
  final Widget child;
  final bool animate;
  @override
  Widget build(BuildContext context) => !animate || Motion.reduced(context)
      ? child
      : AnimatedSize(
          duration: Motion.quick,
          alignment: Alignment.topCenter,
          child: child,
        );
}
