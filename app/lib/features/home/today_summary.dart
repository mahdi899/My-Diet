import 'package:flutter/material.dart';

import '../../core/icons/diet_icon.dart';
import '../../core/motion/motion_kit.dart';
import '../../core/theme/tokens.dart';
import '../../presentation/session/customer_scope.dart';
import '../../presentation/widgets/kit/kit.dart';
import '../plan/consume_sheet.dart';
import '../plan/goal_math.dart';
import 'home_day_focus.dart';

const _forest = Color(0xFF064B39);
const _ivory = Color(0xFFFFFBEA);
const _paleMint = Color(0xFFBFE5D2);
const _tray = Color(0xFFEDF7EF);
const _lime = Color(0xFFB8F05B);

class TodaySummary extends StatelessWidget {
  const TodaySummary({super.key, required this.day, required this.focus});

  final DayNutrition day;
  final HomeDayFocus focus;

  @override
  Widget build(BuildContext context) {
    final store = CustomerScope.of(context);
    final meals = store.mealsOn(store.today);
    return AppCard(
      key: const ValueKey('home-today-summary'),
      padding: EdgeInsets.zero,
      radius: 24,
      color: _tray,
      border: Border.all(color: const Color(0xFFBEDDCA)),
      shadows: const [],
      clip: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _SummaryHeader(day: day, focus: focus),
          if (meals.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 10, 10, 8),
              child: Column(
                children: [
                  LayoutBuilder(
                    builder: (context, constraints) {
                      final largeText =
                          MediaQuery.textScalerOf(context).scale(12) > 15;
                      final columns = largeText || constraints.maxWidth < 250
                          ? 2
                          : meals.length.clamp(1, 4);
                      return Column(
                        children: [
                          for (
                            var start = 0;
                            start < meals.length;
                            start += columns
                          )
                            Padding(
                              padding: EdgeInsets.only(top: start == 0 ? 0 : 8),
                              child: Stack(
                                children: [
                                  if (meals.length - start > 1)
                                    PositionedDirectional(
                                      top: 20,
                                      start: constraints.maxWidth / columns / 2,
                                      end:
                                          constraints.maxWidth -
                                          ((meals.length - start).clamp(
                                                    1,
                                                    columns,
                                                  ) -
                                                  .5) *
                                              constraints.maxWidth /
                                              columns,
                                      child: const ColoredBox(
                                        color: Color(0xFFC0DACC),
                                        child: SizedBox(height: 1.5),
                                      ),
                                    ),
                                  Row(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      for (var slot = 0; slot < columns; slot++)
                                        Expanded(
                                          child: start + slot >= meals.length
                                              ? const SizedBox.shrink()
                                              : _MealStation(
                                                  key: ValueKey(
                                                    'home-log-meal-${start + slot}',
                                                  ),
                                                  label:
                                                      meals[start + slot].name,
                                                  selected:
                                                      store.consumedMealOn(
                                                            store.today,
                                                            start + slot,
                                                          ) !=
                                                          null ||
                                                      store.mealEaten(
                                                        store.today,
                                                        start + slot,
                                                      ),
                                                  onPressed:
                                                      canLogMeal(
                                                        store,
                                                        store.today,
                                                      )
                                                      ? () => showConsumeSheet(
                                                          context,
                                                          store.today,
                                                          start + slot,
                                                        )
                                                      : null,
                                                ),
                                        ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                        ],
                      );
                    },
                  ),
                  const SizedBox(height: 5),
                  const Text(
                    'برای ثبت یا ویرایش، روی وعده بزن',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 11,
                      height: 1.5,
                      color: AppColors.muted,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _SummaryHeader extends StatelessWidget {
  const _SummaryHeader({required this.day, required this.focus});

  final DayNutrition day;
  final HomeDayFocus focus;

  @override
  Widget build(BuildContext context) {
    final difference = day.targetKcal - day.eatenKcal;
    final overTarget = difference < 0;
    final remainingColor = overTarget ? const Color(0xFFFFDBA5) : _paleMint;
    final calories = Row(
      crossAxisAlignment: CrossAxisAlignment.baseline,
      textBaseline: TextBaseline.alphabetic,
      children: [
        Flexible(
          child: Ticker(
            value: day.eatenKcal,
            style: const TextStyle(
              fontSize: 40,
              height: 1.1,
              fontWeight: FontWeight.bold,
              color: _ivory,
            ),
          ),
        ),
        const SizedBox(width: 5),
        const Text(
          'کالری',
          style: TextStyle(fontSize: 13, height: 1.4, color: _ivory),
        ),
      ],
    );
    final remaining = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Ticker(
          key: const ValueKey('home-calories-remaining'),
          value: difference.abs(),
          style: TextStyle(
            fontSize: 24,
            height: 1.15,
            fontWeight: FontWeight.bold,
            color: remainingColor,
          ),
        ),
        Text(
          overTarget ? 'کالری بیشتر از برنامه' : 'کالری باقی‌مانده',
          style: TextStyle(fontSize: 11, height: 1.4, color: remainingColor),
        ),
      ],
    );
    return DecoratedBox(
      decoration: const BoxDecoration(
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(22)),
        gradient: RadialGradient(
          center: Alignment.topLeft,
          radius: 1.3,
          colors: [Color(0xFF159E70), Color(0xFF09674C), _forest],
          stops: [0, .38, 1],
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const DietIcon(
                  DietIconKind.meal,
                  size: 26,
                  color: _ivory,
                  monochrome: true,
                ),
                const SizedBox(width: 7),
                const Expanded(
                  child: Text(
                    'خلاصهٔ امروز',
                    style: TextStyle(
                      fontSize: 16,
                      height: 1.25,
                      fontWeight: FontWeight.bold,
                      color: _ivory,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: .1),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: .25),
                    ),
                    borderRadius: BorderRadius.circular(99),
                  ),
                  child: Text(
                    '${fa(focus.completed)} از ${fa(focus.total)} وعده',
                    key: const ValueKey('home-summary-meal-count'),
                    style: const TextStyle(
                      fontSize: 11,
                      height: 1.5,
                      color: _ivory,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            LayoutBuilder(
              builder: (context, constraints) {
                if (day.targetKcal <= 0) return calories;
                final largeText =
                    MediaQuery.textScalerOf(context).scale(13) > 16;
                if (constraints.maxWidth < 280 && largeText) {
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [calories, const SizedBox(height: 8), remaining],
                  );
                }
                return Row(
                  children: [
                    Expanded(flex: 5, child: calories),
                    Container(
                      width: 1,
                      height: 34,
                      margin: const EdgeInsets.symmetric(horizontal: 14),
                      color: Colors.white.withValues(alpha: .25),
                    ),
                    Expanded(flex: 4, child: remaining),
                  ],
                );
              },
            ),
            const SizedBox(height: 10),
            _CalorieRail(day: day),
            const SizedBox(height: 5),
            Text(
              day.targetKcal > 0
                  ? 'از ${fa(day.targetKcal)} کالری برنامه'
                  : 'مجموع ثبت‌های امروز',
              style: const TextStyle(
                fontSize: 11,
                height: 1.4,
                color: _paleMint,
              ),
            ),
            if (day.unknown)
              const Text(
                'بعضی ثبت‌ها کالری مشخص ندارند.',
                style: TextStyle(fontSize: 11, height: 1.4, color: _paleMint),
              ),
          ],
        ),
      ),
    );
  }
}

class _CalorieRail extends StatelessWidget {
  const _CalorieRail({required this.day});
  final DayNutrition day;

  @override
  Widget build(BuildContext context) => Semantics(
    key: const ValueKey('home-calorie-progress'),
    label: 'کالری ثبت‌شده',
    value: day.targetKcal > 0
        ? '${fa(day.eatenKcal)} از ${fa(day.targetKcal)} کالری'
        : '${fa(day.eatenKcal)} کالری',
    child: ExcludeSemantics(
      child: TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: day.calorieUnit),
        duration: Motion.of(context, Motion.slow),
        curve: Motion.curve,
        builder: (context, progress, _) => Row(
          children: [
            for (var i = 0; i < 18; i++) ...[
              if (i > 0) const SizedBox(width: 3),
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: ColoredBox(
                    color: Colors.white.withValues(alpha: .24),
                    child: Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: FractionallySizedBox(
                        widthFactor: (progress * 18 - i).clamp(0, 1),
                        child: const ColoredBox(
                          color: _lime,
                          child: SizedBox(height: 5),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    ),
  );
}

class _MealStation extends StatelessWidget {
  const _MealStation({
    super.key,
    required this.label,
    required this.selected,
    required this.onPressed,
  });

  final String label;
  final bool selected;
  final VoidCallback? onPressed;

  DietIconKind get _icon {
    if (label.contains('میان')) return DietIconKind.snack;
    if (label.contains('صبح')) return DietIconKind.sunrise;
    if (label.contains('شام')) return DietIconKind.moon;
    return DietIconKind.balancedMeal;
  }

  @override
  Widget build(BuildContext context) => Semantics(
    selected: selected,
    child: Tooltip(
      message: '$label؛ ثبت، ویرایش یا برگرداندن',
      child: TextButton(
        onPressed: onPressed,
        style: TextButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 2),
          minimumSize: const Size(0, 48),
          foregroundColor: AppColors.ink,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ExcludeSemantics(
              child: SizedBox.square(
                dimension: 40,
                child: Stack(
                  children: [
                    Center(
                      child: AnimatedContainer(
                        duration: Motion.of(context, Motion.quick),
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: selected
                              ? const Color(0xFFD0EDB9)
                              : const Color(0xFFF0F3ED),
                          border: Border.all(
                            color: selected
                                ? const Color(0xFFD0EDB9)
                                : const Color(0xFFDDE5DC),
                          ),
                        ),
                        child: Center(
                          child: DietIcon(
                            _icon,
                            size: 24,
                            monochrome: true,
                            color: selected ? _forest : AppColors.inkSoft,
                          ),
                        ),
                      ),
                    ),
                    Positioned(
                      bottom: 0,
                      right: 0,
                      child: AnimatedScale(
                        scale: selected ? 1 : 0,
                        duration: Motion.of(context, Motion.quick),
                        child: Container(
                          padding: const EdgeInsets.all(2),
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: AppColors.emeraldDeep,
                            border: Border.all(color: _tray, width: 1.5),
                          ),
                          child: const Icon(
                            Icons.check_rounded,
                            size: 10,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 3),
            Text(
              label,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 12,
                height: 1.4,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
      ),
    ),
  );
}
