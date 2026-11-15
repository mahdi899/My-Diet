import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../core/motion/motion.dart';
import '../../core/theme/tokens.dart';
import '../../data/day.dart';
import '../../presentation/session/customer_scope.dart';
import '../../presentation/widgets/kit/kit.dart';
import 'water_log.dart';

class HabitGarden extends StatefulWidget {
  const HabitGarden({super.key, this.log, this.today, this.onContinue});
  final WaterRepository? log;
  final DateTime? today;
  final VoidCallback? onContinue;
  @override
  State<HabitGarden> createState() => _HabitGardenState();
}

class _HabitGardenState extends State<HabitGarden> {
  WaterRepository get _log => widget.log ?? CustomerScope.of(context).waterLog;
  Map<String, int> _water = {};
  DateTime? _today, _selected;
  String? _owner;
  int _week = 0, _generation = 0;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    WaterLog.changes.addListener(_reload);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _syncDay();
  }

  @override
  void didUpdateWidget(HabitGarden oldWidget) {
    super.didUpdateWidget(oldWidget);
    _syncDay();
  }

  void _syncDay() {
    final store = CustomerScope.of(context);
    final now = widget.today ?? store.today;
    if (_today == null ||
        dateKey(now) != dateKey(_today!) ||
        _owner != store.userRequestId) {
      _today = DateTime(now.year, now.month, now.day);
      _selected = _today;
      _owner = store.userRequestId;
      _week = 0;
      _water = {};
      _generation++;
      WidgetsBinding.instance.addPostFrameCallback((_) => _reload());
    }
  }

  Future<void> _reload() async {
    if (!mounted) return;
    final generation = ++_generation;
    try {
      final history = await _log.history();
      if (mounted && generation == _generation) {
        setState(() {
          _water = history;
          _failed = false;
        });
      }
    } catch (_) {
      if (mounted && generation == _generation) setState(() => _failed = true);
    }
  }

  @override
  void dispose() {
    WaterLog.changes.removeListener(_reload);
    super.dispose();
  }

  int _glasses(CustomerWorkspace store, DateTime date) =>
      store.waterGlassesOn(date) ?? _water[dateKey(date)] ?? 0;

  @override
  Widget build(BuildContext context) {
    final store = CustomerScope.of(context);
    final today = _today!;
    final anchor = startOfWeek(today);
    final start = DateTime(anchor.year, anchor.month, anchor.day + _week * 7);
    final days = [
      for (var i = 0; i < 7; i++)
        DateTime(start.year, start.month, start.day + i),
    ];
    final logged = days
        .where(
          (d) =>
              !d.isAfter(today) &&
              (store.mealCheckInsOn(d) > 0 || _glasses(store, d) > 0),
        )
        .length;
    final selected = _selected!;
    final meals = store.mealCheckInsOn(selected);
    final water = _glasses(store, selected);
    final active = meals > 0 || water > 0;
    return AppCard(
      key: const ValueKey('habit-garden'),
      padding: const EdgeInsets.all(12),
      shadows: const [],
      border: Border.all(color: AppColors.line),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Icon(
                Icons.spa_outlined,
                color: AppColors.emeraldDeep,
                size: 22,
              ),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  'باغ قدم‌های کوچک',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: AppColors.emeraldDark,
                  ),
                ),
              ),
              IconButton(
                key: const ValueKey('habit-previous-week'),
                tooltip: 'هفتهٔ قبل',
                onPressed: _week == -1
                    ? null
                    : () => setState(() {
                        _week = -1;
                        _selected = DateTime(
                          anchor.year,
                          anchor.month,
                          anchor.day - 1,
                        );
                      }),
                icon: const Icon(Icons.chevron_right_rounded),
              ),
              IconButton(
                key: const ValueKey('habit-current-week'),
                tooltip: 'هفتهٔ جاری',
                onPressed: _week == 0
                    ? null
                    : () => setState(() {
                        _week = 0;
                        _selected = today;
                      }),
                icon: const Icon(Icons.chevron_left_rounded),
              ),
            ],
          ),
          Text(
            '${_week == 0 ? 'این هفته' : 'هفتهٔ قبل'} · ${_failed ? 'حداقل ' : ''}${fa(logged)} روز دارای ثبت',
            style: const TextStyle(fontSize: 12, color: AppColors.inkSoft),
          ),
          const SizedBox(height: 12),
          LayoutBuilder(
            builder: (context, constraints) {
              final width = math.max(44.0, (constraints.maxWidth - 12) / 7);
              return SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    for (var i = 0; i < days.length; i++) ...[
                      if (i > 0) const SizedBox(width: 2),
                      _GardenDay(
                        date: days[i],
                        width: width,
                        selected: dateKey(days[i]) == dateKey(selected),
                        today: dateKey(days[i]) == dateKey(today),
                        future: days[i].isAfter(today),
                        meals: store.mealCheckInsOn(days[i]),
                        water: _glasses(store, days[i]),
                        onTap: () => setState(() => _selected = days[i]),
                      ),
                    ],
                  ],
                ),
              );
            },
          ),
          const SizedBox(height: 12),
          DecoratedBox(
            decoration: BoxDecoration(
              color: active ? AppColors.mint : AppColors.surfaceWarm,
              borderRadius: BorderRadius.circular(18),
            ),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: AnimatedSwitcher(
                duration: Motion.of(context, Motion.quick),
                child: Column(
                  key: ValueKey('${dateKey(selected)}-$meals-$water'),
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      persianDate(selected),
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: AppColors.emeraldDark,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _failed && store.waterGlassesOn(selected) == null
                          ? '${fa(meals)} ثبت وعده · اطلاعات آب خوانده نشد'
                          : active
                          ? '${fa(meals)} ثبت وعده · ${fa(water)} لیوان آب'
                          : _failed
                          ? 'اطلاعات آب خوانده نشد؛ ثبت‌های وعده نمایش داده می‌شوند.'
                          : 'ثبتی برای این روز نداری؛ هر روز فرصت تازه‌ای است.',
                      key: const ValueKey('habit-day-detail'),
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.inkSoft,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          if (_failed)
            TextButton(
              onPressed: _reload,
              child: const Text('خواندن دوبارهٔ ثبت‌های آب'),
            ),
          if (!active)
            Align(
              alignment: AlignmentDirectional.centerEnd,
              child: TextButton.icon(
                key: const ValueKey('habit-continue-today'),
                onPressed: () {
                  setState(() {
                    _week = 0;
                    _selected = today;
                  });
                  widget.onContinue?.call();
                },
                icon: const Icon(Icons.arrow_back_rounded, size: 17),
                label: const Text('ادامه از امروز'),
              ),
            ),
          const SizedBox(height: 8),
          const Text(
            'هر جوانه یعنی حداقل یک ثبت وعده یا آب؛ معیار کامل‌بودن رژیم نیست.',
            style: TextStyle(
              fontSize: 10,
              height: 1.7,
              color: AppColors.inkSoft,
            ),
          ),
        ],
      ),
    );
  }
}

class _GardenDay extends StatelessWidget {
  const _GardenDay({
    required this.date,
    required this.width,
    required this.selected,
    required this.today,
    required this.future,
    required this.meals,
    required this.water,
    required this.onTap,
  });
  final DateTime date;
  final double width;
  final bool selected, today, future;
  final int meals, water;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final active = meals > 0 || water > 0;
    return Semantics(
      button: true,
      enabled: !future,
      selected: selected,
      label:
          '${persianDate(date)}، ${future
              ? 'هنوز نرسیده'
              : active
              ? '${fa(meals)} ثبت وعده و ${fa(water)} لیوان آب'
              : 'بدون ثبت'}',
      excludeSemantics: true,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          key: ValueKey('habit-day-${dateKey(date)}'),
          onTap: future ? null : onTap,
          borderRadius: BorderRadius.circular(16),
          child: AnimatedContainer(
            duration: Motion.of(context, Motion.quick),
            width: width,
            padding: const EdgeInsets.symmetric(vertical: 8),
            decoration: BoxDecoration(
              color: selected ? AppColors.mint : Colors.transparent,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: selected ? AppColors.emeraldDeep : Colors.transparent,
              ),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  persianWeekDays[weekDayIndex(date)].substring(0, 1),
                  style: TextStyle(
                    fontSize: 11,
                    color: future ? AppColors.muted : AppColors.inkSoft,
                  ),
                ),
                const SizedBox(height: 5),
                TweenAnimationBuilder<double>(
                  duration: Motion.of(context, Motion.slow),
                  tween: Tween(begin: 0, end: active && !future ? 1 : 0),
                  curve: Curves.easeOutCubic,
                  builder: (_, growth, _) => SizedBox(
                    width: 30,
                    height: 32,
                    child: CustomPaint(
                      painter: HabitSproutPainter(
                        growth: growth,
                        bloom: meals > 0 && water > 0,
                        future: future,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  fa(jalali(date).$3),
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: today ? FontWeight.bold : FontWeight.normal,
                    color: future ? AppColors.muted : AppColors.emeraldDark,
                  ),
                ),
                Container(
                  margin: const EdgeInsets.only(top: 3),
                  width: 4,
                  height: 4,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: today ? AppColors.emerald : Colors.transparent,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class HabitSproutPainter extends CustomPainter {
  const HabitSproutPainter({
    required this.growth,
    this.bloom = false,
    this.future = false,
  });
  final double growth;
  final bool bloom, future;
  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / 30, size.height / 32);
    final p = Paint()..isAntiAlias = true;
    canvas.drawOval(
      const Rect.fromLTWH(5, 27, 20, 4),
      p..color = future ? AppColors.line : const Color(0xFFDCD7C7),
    );
    if (growth <= 0) {
      if (!future) {
        canvas.drawOval(
          const Rect.fromLTWH(13, 25, 5, 4),
          p..color = const Color(0xFFB6A889),
        );
      }
      canvas.restore();
      return;
    }
    canvas.translate(15, 28);
    canvas.scale(1, growth);
    canvas.translate(-15, -28);
    canvas.drawPath(
      Path()
        ..moveTo(15, 28)
        ..quadraticBezierTo(13, 17, 17, 7),
      p
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..strokeCap = StrokeCap.round
        ..color = AppColors.emeraldDark,
    );
    p.style = PaintingStyle.fill;
    canvas.drawPath(
      Path()
        ..moveTo(15, 20)
        ..cubicTo(6, 20, 4, 15, 5, 10)
        ..cubicTo(12, 10, 16, 14, 15, 20)
        ..close(),
      p..color = AppColors.emeraldDeep,
    );
    canvas.drawPath(
      Path()
        ..moveTo(16, 14)
        ..cubicTo(15, 7, 21, 3, 27, 6)
        ..cubicTo(27, 12, 21, 17, 16, 14)
        ..close(),
      p..color = AppColors.emerald,
    );
    if (bloom) {
      for (var i = 0; i < 5; i++) {
        final angle = i * math.pi * 2 / 5;
        canvas.drawCircle(
          Offset(17 + math.cos(angle) * 3, 6 + math.sin(angle) * 3),
          2.6,
          p..color = AppColors.lime,
        );
      }
      canvas.drawCircle(const Offset(17, 6), 2, p..color = AppColors.amber);
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(HabitSproutPainter oldDelegate) =>
      oldDelegate.growth != growth ||
      oldDelegate.bloom != bloom ||
      oldDelegate.future != future;
}
