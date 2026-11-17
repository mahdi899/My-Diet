import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/motion/motion_kit.dart';
import '../../core/theme/tokens.dart';
import '../../presentation/session/customer_scope.dart';
import '../../presentation/widgets/kit/kit.dart';
import '../coach/coach_launcher.dart';
import '../plan/goal_math.dart';
import '../plan/meal_detail_page.dart';
import 'home_day_focus.dart';
import 'home_welcome.dart';
import 'water_log.dart';
import 'water_card.dart';
export 'water_card.dart' show WaterCard;
import 'habit_garden.dart';
import 'today_summary.dart';
import 'home_journey_footer.dart';

class HomeTab extends StatefulWidget {
  const HomeTab({super.key, this.onOpenPlan, this.waterLog});

  final VoidCallback? onOpenPlan;
  final WaterRepository? waterLog;

  @override
  State<HomeTab> createState() => _HomeTabState();
}

class _HomeTabState extends State<HomeTab> with WidgetsBindingObserver {
  bool _loadedPhoto = false;
  final _waterKey = GlobalKey();
  Timer? _clockTick;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _watchTime();
  }

  void _watchTime() {
    _clockTick?.cancel();
    _clockTick = Timer.periodic(const Duration(minutes: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      setState(() {});
      _watchTime();
    } else {
      _clockTick?.cancel();
    }
  }

  @override
  void dispose() {
    _clockTick?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final store = CustomerScope.of(context);
    if (_loadedPhoto || !store.canLoadProfilePhoto) return;
    _loadedPhoto = true;
    unawaited(store.loadHomePhoto().catchError((Object _) {}));
  }

  @override
  Widget build(BuildContext context) {
    final store = CustomerScope.of(context);
    final name = _firstName(store);
    final day = nutritionOn(store, store.today);
    final focus = HomeDayFocus.from(store);
    final next = focus.next;
    return ListView(
      key: const ValueKey('home-tab'),
      padding: const EdgeInsets.fromLTRB(20, 8, 20, shellBottomInset),
      children: [
        HomeWelcome(
          name: name,
          now: store.today,
          profilePhoto: store.profilePhoto,
          onProfile: () => openProfileSheet(context),
        ).rise(),
        const SizedBox(height: AppSpacing.xl),
        HomeFocusCard(
          focus: focus,
          onReview: focus.total == 0 && widget.onOpenPlan != null
              ? widget.onOpenPlan
              : () => openCoach(context, prefill: 'امروز را با هم مرور کنیم.'),
          reviewLabel: focus.total == 0 && widget.onOpenPlan != null
              ? 'وضعیت برنامه'
              : 'مرور امروز با مربی',
        ).rise(index: 1),
        const SizedBox(height: AppSpacing.section),
        if (next != null) ...[
          Row(
            children: [
              Expanded(
                child: Text(
                  focus.review ? 'هنوز می‌توانی ثبت کنی' : 'وعدهٔ پیش روی تو',
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                  ),
                ),
              ),
              if (widget.onOpenPlan != null)
                TextButton(
                  onPressed: widget.onOpenPlan,
                  child: const Text('همهٔ برنامه'),
                ),
            ],
          ),
          const SizedBox(height: 8),
          _NextMeal(meal: next).rise(index: 1),
          const SizedBox(height: AppSpacing.xl),
        ],
        TodaySummary(day: day, focus: focus).rise(index: 2),
        const SizedBox(height: AppSpacing.lg),
        WaterCard(
          key: _waterKey,
          log: widget.waterLog,
          goal: waterGoalFrom(store.questionnaire.water),
        ).rise(index: 3),
        const SizedBox(height: AppSpacing.lg),
        HabitGarden(
          today: store.today,
          log: widget.waterLog,
          onContinue: () {
            final target = _waterKey.currentContext;
            if (target != null) {
              Scrollable.ensureVisible(
                target,
                duration: Motion.of(context, Motion.base),
                curve: Motion.curve,
              );
            }
          },
        ).rise(index: 4),
        const SizedBox(height: AppSpacing.xl),
        HomeJourneyFooter(
          key: const ValueKey('home-journey-footer'),
          onCoach: () => openCoach(context, prefill: _prefill(store, next)),
        ).rise(index: 5),
      ],
    );
  }
}

class _NextMeal extends StatelessWidget {
  const _NextMeal({required this.meal});
  final NextMeal meal;

  @override
  Widget build(BuildContext context) {
    final item = meal.meal;
    final tag = 'home-${mealHeroTag(meal.date, meal.index)}';
    void open() => Navigator.of(context, rootNavigator: true).push(
      foodDetailRoute<void>(
        MealDetailPage(date: meal.date, index: meal.index, heroTag: tag),
        reduced: Motion.reduced(context),
      ),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FoodHeroCard(
          key: const ValueKey('home-next-meal'),
          title: item.title,
          subtitle: item.amount.trim().isNotEmpty
              ? item.amount
              : 'مواد و دستورپخت را ببین',
          badge: item.time.isEmpty
              ? item.name
              : '${item.name} · ${fa(item.time)}',
          kcal: item.calories > 0 ? item.calories : null,
          mealType: item.name,
          ingredients: [for (final part in item.ingredients) part.name],
          heroTag: tag,
          height: 226,
          onTap: open,
        ),
        const SizedBox(height: 10),
        PillButton(
          key: const ValueKey('home-meal-details'),
          label: 'ببین چی برات داریم',
          trailingIcon: Icons.arrow_back_rounded,
          height: 48,
          onPressed: open,
        ),
      ],
    );
  }
}

String _firstName(CustomerWorkspace store) {
  final raw = store.userSignedIn ? store.questionnaire.name.trim() : '';
  if (raw.isEmpty) return 'دوست';
  return raw.split(RegExp(r'\s+')).first;
}

String _prefill(CustomerWorkspace store, NextMeal? next) {
  if (next == null) return 'امروز را با هم مرور کنیم.';
  return 'می‌خوام دربارهٔ ${next.meal.name} «${next.meal.title}» حرف بزنیم.';
}
