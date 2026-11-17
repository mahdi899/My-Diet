import '../../../core/icons/diet_icon.dart';
import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/photos/photos.dart';
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
    final completed = [
      for (var i = 0; i < meals.length; i++) store.mealEaten(store.today, i),
    ];
    final done = completed.where((value) => value).length;
    final next = completed.indexOf(false);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 13, 16, 0),
      child: Material(
        color: AppColors.mint,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(22),
          side: const BorderSide(color: AppColors.selectedLine),
        ),
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
                        child: const DietIcon(DietIconKind.meal, size: 22),
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
                        maxHeight:
                            (MediaQuery.sizeOf(context).height -
                                MediaQuery.paddingOf(context).vertical) *
                            .5,
                      ),
                      child: ColoredBox(
                        color: AppColors.surface,
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Flexible(
                              child: ListView(
                                key: const ValueKey('coach-summary-scroll'),
                                shrinkWrap: true,
                                padding: const EdgeInsets.fromLTRB(
                                  12,
                                  14,
                                  12,
                                  4,
                                ),
                                children: [
                                  if (meals.isNotEmpty)
                                    _MealProgress(
                                      done: done,
                                      total: meals.length,
                                    ),
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
                                    _SummaryMeal(
                                      key: ValueKey('coach-summary-meal-$i'),
                                      name: meals[i].name,
                                      title: meals[i].title,
                                      time: meals[i].time,
                                      ingredients: [
                                        for (final ingredient
                                            in meals[i].ingredients)
                                          ingredient.name,
                                      ],
                                      completed: completed[i],
                                      next: i == next,
                                      first: i == 0,
                                      last: i == meals.length - 1,
                                      onTap: () => Navigator.of(context).push(
                                        foodDetailRoute<void>(
                                          MealDetailPage(
                                            date: store.today,
                                            index: i,
                                          ),
                                          reduced: Motion.reduced(context),
                                        ),
                                      ),
                                    ),
                                  if (meals.isEmpty)
                                    for (var i = 0; i < briefMeals.length; i++)
                                      _SummaryMeal(
                                        name: asString(briefMeals[i]['name']),
                                        title: asString(briefMeals[i]['title']),
                                        time: asString(briefMeals[i]['time']),
                                        first: i == 0,
                                        last: i == briefMeals.length - 1,
                                      ),
                                  if (count == 0)
                                    const Padding(
                                      padding: EdgeInsets.symmetric(
                                        vertical: 16,
                                      ),
                                      child: Text(
                                        'هنوز وعده‌ای برای امروز در برنامه نیست.',
                                        style: TextStyle(
                                          color: AppColors.inkSoft,
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                            ),
                            const Padding(
                              padding: EdgeInsets.symmetric(horizontal: 12),
                              child: Divider(
                                height: 1,
                                color: AppColors.selectedLine,
                              ),
                            ),
                            Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 2,
                              ),
                              child: TextButton(
                                onPressed: onRing,
                                style: TextButton.styleFrom(
                                  minimumSize: const Size(0, 48),
                                  foregroundColor: AppColors.emeraldDark,
                                ),
                                child: const Row(
                                  children: [
                                    Expanded(
                                      child: Text('جزئیات ثبت‌های امروز'),
                                    ),
                                    Icon(
                                      Icons.arrow_back_rounded,
                                      size: 19,
                                      textDirection: TextDirection.ltr,
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MealProgress extends StatelessWidget {
  const _MealProgress({required this.done, required this.total});
  final int done, total;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(2, 0, 2, 14),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          alignment: WrapAlignment.spaceBetween,
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: 12,
          runSpacing: 6,
          children: [
            const Text(
              'روند امروز',
              style: TextStyle(
                color: AppColors.emeraldDark,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.mint,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                '${fa(done)} از ${fa(total)} وعده',
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: AppColors.emeraldDark,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        LinearProgressIndicator(
          value: done / total,
          minHeight: 5,
          borderRadius: BorderRadius.circular(8),
          color: AppColors.emeraldDeep,
          backgroundColor: AppColors.mint,
          semanticsLabel:
              'وعده‌های انجام‌شدهٔ امروز؛ ${fa(done)} از ${fa(total)} وعده',
        ),
      ],
    ),
  );
}

class _SummaryMeal extends StatelessWidget {
  const _SummaryMeal({
    super.key,
    required this.name,
    required this.title,
    required this.time,
    required this.first,
    required this.last,
    this.ingredients = const [],
    this.completed = false,
    this.next = false,
    this.onTap,
  });

  final String name, title, time;
  final List<String> ingredients;
  final bool completed, next, first, last;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Stack(
    children: [
      PositionedDirectional(
        top: 0,
        bottom: 0,
        start: 0,
        width: 16,
        child: ExcludeSemantics(
          child: Column(
            children: [
              Expanded(child: _line(!first)),
              Container(
                width: 16,
                height: 16,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: completed ? AppColors.emeraldDeep : Colors.white,
                  border: Border.all(
                    color: completed || next
                        ? AppColors.emeraldDeep
                        : AppColors.selectedLine,
                    width: 2,
                  ),
                ),
                child: completed
                    ? const Icon(
                        Icons.check_rounded,
                        size: 11,
                        color: Colors.white,
                      )
                    : next
                    ? Center(
                        child: Container(
                          width: 6,
                          height: 6,
                          decoration: const BoxDecoration(
                            color: AppColors.emeraldDeep,
                            shape: BoxShape.circle,
                          ),
                        ),
                      )
                    : null,
              ),
              Expanded(child: _line(!last)),
            ],
          ),
        ),
      ),
      Padding(
        padding: EdgeInsetsDirectional.only(start: 26, bottom: last ? 0 : 8),
        child: Material(
          color: next ? const Color(0xFFEDF8F1) : AppColors.surface,
          clipBehavior: Clip.antiAlias,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: BorderSide(
              color: next ? AppColors.selectedLine : const Color(0xFFE5ECE7),
            ),
          ),
          child: MergeSemantics(
            child: Semantics(
              selected: next,
              child: InkWell(
                onTap: onTap,
                child: Container(
                  decoration: BoxDecoration(
                    border: next
                        ? const BorderDirectional(
                            start: BorderSide(
                              color: AppColors.emeraldDeep,
                              width: 3,
                            ),
                          )
                        : null,
                  ),
                  padding: const EdgeInsets.all(10),
                  child: LayoutBuilder(
                    builder: (context, constraints) {
                      final compact =
                          constraints.maxWidth < 270 ||
                          MediaQuery.textScalerOf(context).scale(12) > 15;
                      final status = next
                          ? Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 3,
                              ),
                              decoration: BoxDecoration(
                                color: const Color(0xFFD8EFDF),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: const Text(
                                'وعده بعدی',
                                style: TextStyle(
                                  color: AppColors.emeraldDark,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            )
                          : completed
                          ? const Text(
                              'انجام شد',
                              style: TextStyle(
                                color: AppColors.emeraldDeep,
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                              ),
                            )
                          : null;
                      return Row(
                        children: [
                          ExcludeSemantics(
                            child: FoodImage(
                              title: title,
                              mealType: name,
                              ingredients: ingredients,
                              thumb: true,
                              width: 48,
                              height: 48,
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Wrap(
                                  spacing: 8,
                                  crossAxisAlignment: WrapCrossAlignment.center,
                                  children: [
                                    Text(
                                      name,
                                      style: const TextStyle(
                                        color: AppColors.inkSoft,
                                        fontSize: 10,
                                        height: 1.6,
                                      ),
                                    ),
                                    if (time.isNotEmpty)
                                      Text(
                                        fa(time),
                                        textDirection: TextDirection.ltr,
                                        style: const TextStyle(
                                          color: AppColors.muted,
                                          fontSize: 10,
                                        ),
                                      ),
                                  ],
                                ),
                                Text(
                                  title,
                                  style: const TextStyle(
                                    color: AppColors.ink,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                    height: 1.65,
                                  ),
                                ),
                                if (compact && status != null) ...[
                                  const SizedBox(height: 4),
                                  status,
                                ],
                              ],
                            ),
                          ),
                          if (!compact && status != null) ...[
                            const SizedBox(width: 8),
                            status,
                          ],
                          if (status == null && onTap != null)
                            const Icon(
                              Icons.chevron_left_rounded,
                              size: 18,
                              color: AppColors.muted,
                              textDirection: TextDirection.ltr,
                            ),
                        ],
                      );
                    },
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ],
  );

  Widget _line(bool visible) => Center(
    child: Container(width: 2, color: visible ? AppColors.selectedLine : null),
  );
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
