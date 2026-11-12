import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/motion/motion_kit.dart';
import '../../core/photos/photos.dart';
import '../../core/theme/tokens.dart';
import '../../data/day.dart';
import '../../data/demo_store.dart';
import '../../presentation/screens/messaging.dart';
import '../../presentation/screens/user.dart';
import '../../presentation/widgets/kit/kit.dart';
import 'goal_hero.dart';
import 'goal_math.dart';
import 'journey_map.dart';
import 'meal_detail_page.dart';
import 'plan_meals.dart';
import 'plan_shopping_page.dart';
import 'plan_states.dart';
import 'streak_chip.dart';

class PlanTab extends StatefulWidget {
  const PlanTab({super.key});

  @override
  State<PlanTab> createState() => _PlanTabState();
}

class _PlanTabState extends State<PlanTab> with WidgetsBindingObserver {
  Timer? _tick;
  final _strip = ScrollController();
  int? _day;
  bool _anchored = false;
  bool _anchorQueued = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _tick = Timer.periodic(const Duration(minutes: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _tick?.cancel();
    _strip.dispose();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && mounted) setState(() {});
  }

  void _anchor(int index) {
    if (_anchored || _anchorQueued) return;
    _anchorQueued = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _anchorQueued = false;
      if (!mounted || !_strip.hasClients) return;
      final max = _strip.position.maxScrollExtent;
      _strip.jumpTo((index * 80).clamp(0, max).toDouble());
      _anchored = true;
    });
  }

  void _select(int day, int minDay) {
    final next = day < minDay ? minDay : (day > 6 ? 6 : day);
    if (next == _day) return;
    Haptics.tick();
    setState(() => _day = next);
  }

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    if (store.serverAuthEnabled && !store.liveReady) {
      return const PlanSkeleton();
    }
    if (store.liveNotice != null && !store.hasUserRequest) {
      return PlanProblem(message: store.liveNotice!);
    }
    if (!store.hasUserRequest) return const PlanEmpty();
    final request = store.userRequest;
    final week = request.programWeek;
    if (request.isPublished &&
        week != null &&
        dateKey(week) != dateKey(startOfWeek(store.today))) {
      return const PlanExpired();
    }
    if (!request.isPublished) return const PlanWaiting();

    final start = week ?? startOfWeek(store.today);
    final todayIndex = weekDayIndex(store.today);
    final day = (_day ?? todayIndex).clamp(todayIndex, 6);
    _anchor(todayIndex);
    final date = weekDate(start, day);
    final meals = store.mealsOn(date);
    final next = findNextMeal(store);
    final goal = goalOf(store);
    final nutrition = nutritionOn(store, date);

    return Stack(
      children: [
        Positioned.fill(
          child: ListView(
            padding: EdgeInsets.fromLTRB(
              20,
              8,
              20,
              shellBottomInset + (next == null ? 24 : 96),
            ),
            children: [
              const PlanQuestions(),
              GoalHero(goal: goal, nutrition: nutrition).rise(),
              const SizedBox(height: 16),
              JourneyMap(
                goal: goal,
                history: store.weightEntries,
              ).rise(index: 1),
              const SizedBox(height: 16),
              const StreakChip().rise(index: 2),
              const SizedBox(height: 14),
              SizedBox(
                height: 84,
                child: ListView.separated(
                  key: const ValueKey('plan-day-strip'),
                  controller: _strip,
                  scrollDirection: Axis.horizontal,
                  itemCount: 7,
                  separatorBuilder: (_, _) => const SizedBox(width: 8),
                  itemBuilder: (context, index) {
                    final itemDate = weekDate(start, index);
                    final selected = index == day;
                    final past = index < todayIndex;
                    final today = index == todayIndex;
                    return PressableScale(
                      onTap: past ? null : () => _select(index, todayIndex),
                      child: AnimatedContainer(
                        key: ValueKey('plan-day-$index'),
                        duration: Motion.quick,
                        width: 72,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: past
                              ? AppColors.bgDeep
                              : selected
                              ? AppColors.emerald
                              : AppColors.surface,
                          borderRadius: BorderRadius.circular(20),
                          boxShadow: past || selected ? null : AppShadows.soft,
                        ),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              persianWeekDays[index],
                              maxLines: 1,
                              style: TextStyle(
                                fontSize: 11,
                                height: 1.2,
                                color: past
                                    ? AppColors.faint
                                    : selected
                                    ? Colors.white70
                                    : AppColors.muted,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              fa(jalali(itemDate).$3),
                              style: TextStyle(
                                fontSize: 16,
                                height: 1.2,
                                fontWeight: FontWeight.bold,
                                color: past
                                    ? AppColors.faint
                                    : selected
                                    ? Colors.white
                                    : AppColors.emeraldDark,
                              ),
                            ),
                            if (today)
                              Container(
                                width: 5,
                                height: 5,
                                margin: const EdgeInsets.only(top: 4),
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: selected
                                      ? AppColors.lime
                                      : AppColors.emerald,
                                ),
                              ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  IconButton(
                    tooltip: 'روز قبل',
                    onPressed: day > todayIndex
                        ? () => _select(day - 1, todayIndex)
                        : null,
                    icon: const Icon(Icons.chevron_right_rounded),
                  ),
                  Expanded(
                    child: Text(
                      persianDate(date),
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ),
                  IconButton(
                    tooltip: 'روز بعد',
                    onPressed: day < 6
                        ? () => _select(day + 1, todayIndex)
                        : null,
                    icon: const Icon(Icons.chevron_left_rounded),
                  ),
                ],
              ),
              Text(
                '${fa(meals.length)} وعده',
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.muted, fontSize: 12),
              ),
              if (nutrition.unknown)
                const Padding(
                  padding: EdgeInsets.only(top: 6),
                  child: Text(
                    'کالری بعضی وعده‌ها نامشخص است',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppColors.muted, fontSize: 12),
                  ),
                ),
              const SizedBox(height: 12),
              AnimatedSwitcher(
                duration: Motion.of(context, Motion.base),
                switchInCurve: Motion.emphasized,
                switchOutCurve: Motion.emphasized,
                layoutBuilder: (current, previous) => Stack(
                  alignment: Alignment.topCenter,
                  children: [...previous, ?current],
                ),
                child: Column(
                  key: ValueKey('plan-day-body-$day'),
                  children: [
                    if (meals.isEmpty)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 24),
                        child: Text(
                          'وعده‌ای برای این روز نیست',
                          style: TextStyle(color: AppColors.muted),
                        ),
                      ),
                    for (var i = 0; i < meals.length; i++) ...[
                      if (i > 0) const SizedBox(height: 16),
                      PlanMealCard(date: date, index: i),
                    ],
                  ],
                ),
              ),
              if (request.publishedNote.trim().isNotEmpty) ...[
                const SizedBox(height: 16),
                AppCard.tinted(child: Text(request.publishedNote)),
              ],
              if (store.hasActiveShoppingPlan) ...[
                const SizedBox(height: 12),
                AppCard(
                  onTap: () => Navigator.of(
                    context,
                    rootNavigator: true,
                  ).push(fadeThroughRoute<void>(const PlanShoppingPage())),
                  child: const Row(
                    children: [
                      Icon(
                        Icons.shopping_basket_rounded,
                        color: AppColors.emerald,
                      ),
                      SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'لیست خرید',
                          style: TextStyle(fontWeight: FontWeight.bold),
                        ),
                      ),
                      Icon(Icons.chevron_left_rounded, color: AppColors.muted),
                    ],
                  ),
                ),
              ],
              if (store.canReviewCurrentProgram)
                TextButton(
                  onPressed: () =>
                      Navigator.of(context, rootNavigator: true).push(
                        fadeThroughRoute<void>(
                          const ProgramReviewSubmitScreen(),
                        ),
                      ),
                  child: const Text('بازخورد هفته'),
                ),
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: PillButton(
                  label: 'درخواست اصلاح برنامه',
                  icon: Icons.edit_note_rounded,
                  variant: PillVariant.soft,
                  onPressed: () => showPlanChange(context),
                ),
              ),
              if (!store.serverAuthEnabled)
                const Text(
                  'نمونهٔ طراحی',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppColors.faint, fontSize: 11),
                ),
            ],
          ),
        ),
        if (next != null)
          PositionedDirectional(
            start: 16,
            end: 16,
            bottom: shellBottomInset,
            child: _NextMealBar(meal: next),
          ),
      ],
    );
  }
}

class _NextMealBar extends StatelessWidget {
  const _NextMealBar({required this.meal});

  final NextMeal meal;

  @override
  Widget build(BuildContext context) {
    final item = meal.meal;
    return PressableScale(
      onTap: () => Navigator.of(context, rootNavigator: true).push(
        fadeThroughRoute<void>(
          MealDetailPage(date: meal.date, index: meal.index),
        ),
      ),
      child: Container(
        key: const ValueKey('next-meal-cta'),
        height: 72,
        decoration: BoxDecoration(
          gradient: AppGradients.cta,
          borderRadius: BorderRadius.circular(AppRadius.xl),
          boxShadow: AppShadows.cta,
        ),
        padding: const EdgeInsetsDirectional.fromSTEB(8, 8, 16, 8),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: FoodImage(
                title: item.title,
                mealType: item.name,
                ingredients: [for (final part in item.ingredients) part.name],
                width: 56,
                height: 56,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                      height: 1.3,
                    ),
                  ),
                  Text(
                    item.time,
                    style: const TextStyle(color: Colors.white70, fontSize: 12),
                  ),
                ],
              ),
            ),
            const Text(
              'شروع کن',
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: 15,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
