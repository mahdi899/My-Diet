import 'dart:convert';

import 'package:flutter/material.dart';

import '../../core/motion/motion_kit.dart';
import '../../core/photos/photos.dart';
import '../../core/theme/tokens.dart';
import '../../data/demo_store.dart';
import '../../presentation/widgets/kit/kit.dart';
import '../coach/coach_launcher.dart';
import '../plan/goal_math.dart';
import '../plan/meal_detail_page.dart';
import '../plan/streak_chip.dart';
import 'sparkline.dart';
import 'water_log.dart';
import 'weight_sheet.dart';

class HomeTab extends StatefulWidget {
  const HomeTab({super.key, this.onOpenPlan});

  final VoidCallback? onOpenPlan;

  @override
  State<HomeTab> createState() => _HomeTabState();
}

class _HomeTabState extends State<HomeTab> {
  bool _loadedPhoto = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final store = DemoScope.of(context);
    final auth = store.customerAuth;
    if (_loadedPhoto || !store.userSignedIn || auth == null) return;
    _loadedPhoto = true;
    final previous = store.profilePhoto;
    auth.api('me/personal-details').then<void>((response) {
      if (!mounted || !store.userSignedIn || previous != store.profilePhoto) {
        return;
      }
      final photo = response is Map && response['details'] is Map
          ? response['details']['photo']
          : null;
      if (photo is String) setState(() => store.profilePhoto = photo);
    }, onError: (Object _) {});
  }

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final name = _firstName(store);
    final day = nutritionOn(store, store.today);
    final next = findNextMeal(store);
    return ListView(
      key: const ValueKey('home-tab'),
      padding: const EdgeInsets.fromLTRB(20, 8, 20, shellBottomInset),
      children: [
        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _hello(store.today),
                    style: const TextStyle(
                      color: AppColors.muted,
                      fontSize: 13,
                    ),
                  ),
                  Text(name, style: Theme.of(context).textTheme.headlineMedium),
                ],
              ),
            ),
            PressableScale(
              semanticLabel: 'پروفایل',
              onTap: () => openProfileSheet(context),
              child: CircleAvatar(
                radius: 26,
                backgroundColor: AppColors.mint,
                foregroundImage: store.profilePhoto == null
                    ? null
                    : MemoryImage(base64Decode(store.profilePhoto!)),
                child: Text(
                  name.substring(0, 1),
                  style: const TextStyle(
                    color: AppColors.emeraldDark,
                    fontWeight: FontWeight.bold,
                    fontSize: 18,
                  ),
                ),
              ),
            ),
          ],
        ).rise(),
        const SizedBox(height: 18),
        AppCard(
          shadows: AppShadows.lifted,
          child: Column(
            children: [
              Ring(
                key: const ValueKey('home-calorie-ring'),
                value: day.calorieUnit,
                size: 188,
                strokeWidth: 14,
                child: FittedBox(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Ticker(
                        value: day.eatenKcal,
                        style: const TextStyle(
                          fontSize: 36,
                          fontWeight: FontWeight.bold,
                          color: AppColors.ink,
                          height: 1.1,
                        ),
                      ),
                      const Text(
                        'کالری',
                        style: TextStyle(color: AppColors.muted, fontSize: 12),
                      ),
                      if (day.targetKcal > 0)
                        Text(
                          'از ${fa(day.targetKcal)}',
                          style: const TextStyle(
                            color: AppColors.faint,
                            fontSize: 11,
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  _Mini(
                    'پروتئین',
                    unitRatio(day.eaten.protein, day.planned.protein),
                    const [AppColors.sky, AppColors.emerald],
                  ),
                  _Mini(
                    'کربو',
                    unitRatio(day.eaten.carbs, day.planned.carbs),
                    const [AppColors.lime, AppColors.emerald],
                  ),
                  _Mini(
                    'چربی',
                    unitRatio(day.eaten.fat, day.planned.fat),
                    const [AppColors.amber, AppColors.coral],
                  ),
                ],
              ),
            ],
          ),
        ).rise(index: 1),
        const SizedBox(height: 14),
        const StreakChip().rise(index: 2),
        const SizedBox(height: 14),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'وزن',
                          style: TextStyle(
                            color: AppColors.muted,
                            fontSize: 12,
                          ),
                        ),
                        Ticker(
                          value: store.latestWeight,
                          fractionDigits: fractionDigits(store.latestWeight),
                          suffix: ' کیلو',
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                      ],
                    ),
                  ),
                  PillButton(
                    label: 'ثبت وزن',
                    expanded: false,
                    height: 42,
                    variant: PillVariant.soft,
                    onPressed: () => showWeightSheet(context),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              SizedBox(
                height: 72,
                child: CustomPaint(
                  painter: SparklinePainter(store.weightEntries),
                  child: const SizedBox.expand(),
                ),
              ),
            ],
          ),
        ).rise(index: 3),
        const SizedBox(height: 14),
        if (next != null)
          _NextMeal(meal: next, onOpenPlan: widget.onOpenPlan).rise(index: 4)
        else if (store.mealsOn(store.today).isNotEmpty)
          const _Quiet('امروز کامل شد').rise(index: 4),
        const SizedBox(height: 14),
        WaterCard(
          goal: waterGoalFrom(store.questionnaire.water),
        ).rise(index: 5),
        const SizedBox(height: 18),
        PillButton(
          label: _nudge(next),
          icon: Icons.chat_bubble_rounded,
          variant: PillVariant.soft,
          onPressed: () => openCoach(context, prefill: _prefill(store, next)),
        ).rise(index: 6),
      ],
    );
  }
}

class _Mini extends StatelessWidget {
  const _Mini(this.label, this.value, this.colors);
  final String label;
  final double value;
  final List<Color> colors;

  @override
  Widget build(BuildContext context) => Expanded(
    child: Column(
      children: [
        Ring(value: value, size: 46, strokeWidth: 5, colors: colors),
        const SizedBox(height: 4),
        Text(
          label,
          style: const TextStyle(color: AppColors.muted, fontSize: 11),
        ),
      ],
    ),
  );
}

class _NextMeal extends StatelessWidget {
  const _NextMeal({required this.meal, required this.onOpenPlan});

  final NextMeal meal;
  final VoidCallback? onOpenPlan;

  @override
  Widget build(BuildContext context) {
    final item = meal.meal;
    return AppCard(
      onTap: () {
        final open = onOpenPlan;
        if (open != null) {
          open();
          return;
        }
        Navigator.of(context, rootNavigator: true).push(
          fadeThroughRoute<void>(
            MealDetailPage(date: meal.date, index: meal.index),
          ),
        );
      },
      padding: const EdgeInsets.all(10),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: FoodImage(
              title: item.title,
              mealType: item.name,
              ingredients: [for (final part in item.ingredients) part.name],
              width: 72,
              height: 72,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.name,
                  style: const TextStyle(color: AppColors.muted, fontSize: 12),
                ),
                Text(
                  item.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
                Text(
                  item.time,
                  style: const TextStyle(
                    color: AppColors.emeraldDeep,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_left_rounded, color: AppColors.faint),
        ],
      ),
    );
  }
}

class _Quiet extends StatelessWidget {
  const _Quiet(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => AppCard.tinted(
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    child: Text(
      text,
      style: const TextStyle(
        color: AppColors.emeraldDark,
        fontWeight: FontWeight.bold,
      ),
    ),
  );
}

class WaterCard extends StatefulWidget {
  const WaterCard({super.key, required this.goal, this.log});

  final int goal;
  final WaterLog? log;

  @override
  State<WaterCard> createState() => _WaterCardState();
}

class _WaterCardState extends State<WaterCard> {
  late final WaterLog _log = widget.log ?? WaterLog();
  int _glasses = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final glasses = DemoScope.of(context).coachWaterGlasses;
    if (glasses != null && glasses != _glasses) _glasses = glasses;
  }

  Future<void> _load() async {
    if (!mounted) return;
    try {
      final store = DemoScope.of(context);
      final remote = store.coachWaterGlasses;
      if (remote != null) {
        if (mounted) setState(() => _glasses = remote);
        return;
      }
      final value = await _log.read(store.today);
      if (mounted) setState(() => _glasses = value);
    } on Object {
      // Preferences can be missing in a fresh preview; the counter still works.
    }
  }

  Future<void> _set(int value) async {
    final store = DemoScope.of(context);
    final next = value.clamp(0, widget.goal);
    setState(() => _glasses = next);
    Haptics.tick();
    try {
      await _log.write(store.today, next);
    } on Object {
      // The number on screen stays; the next tap tries again.
    }
  }

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Icon(Icons.water_drop_rounded, color: AppColors.sky),
              const SizedBox(width: 8),
              const Text('آب', style: TextStyle(fontWeight: FontWeight.bold)),
              const Spacer(),
              Text(
                '${fa(_glasses)} از ${fa(widget.goal)}',
                key: const ValueKey('home-water'),
                style: const TextStyle(color: AppColors.muted),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _GlassButton(
                icon: Icons.remove_rounded,
                onTap: _glasses == 0 ? null : () => _set(_glasses - 1),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Wrap(
                  alignment: WrapAlignment.center,
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    for (var i = 0; i < widget.goal; i++)
                      GestureDetector(
                        onTap: () => _set(_glasses == i + 1 ? i : i + 1),
                        child: Icon(
                          Icons.water_drop_rounded,
                          size: 26,
                          color: i < _glasses ? AppColors.sky : AppColors.line,
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              _GlassButton(
                icon: Icons.add_rounded,
                onTap: _glasses >= widget.goal
                    ? null
                    : () => _set(_glasses + 1),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _GlassButton extends StatelessWidget {
  const _GlassButton({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return PressableScale(
      onTap: onTap,
      child: Container(
        width: 36,
        height: 36,
        alignment: Alignment.center,
        decoration: const BoxDecoration(
          color: AppColors.mint,
          shape: BoxShape.circle,
        ),
        child: Icon(icon, size: 18, color: AppColors.emeraldDark),
      ),
    );
  }
}

String _hello(DateTime now) {
  final hour = now.hour;
  if (hour < 5 || hour >= 21) return 'شب بخیر';
  if (hour < 12) return 'صبح بخیر';
  if (hour < 17) return 'ظهر بخیر';
  return 'عصر بخیر';
}

String _firstName(DemoStore store) {
  final raw = store.userSignedIn ? store.questionnaire.name.trim() : '';
  if (raw.isEmpty) return 'دوست';
  return raw.split(RegExp(r'\s+')).first;
}

String _nudge(NextMeal? next) {
  if (next == null) return 'امروز را با مربی ببند';
  return 'دربارهٔ ${next.meal.name} بپرس';
}

String _prefill(DemoStore store, NextMeal? next) {
  if (next == null) return 'امروز را با هم مرور کنیم.';
  return 'می‌خوام دربارهٔ ${next.meal.name} «${next.meal.title}» حرف بزنیم.';
}
