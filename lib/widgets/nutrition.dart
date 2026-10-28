import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../data/demo_store.dart';
import '../data/day.dart';
import '../theme.dart';
import '../screens/questionnaire.dart';
import 'ui.dart';
import 'celebration.dart';

String decimalFa(double value) => fa(
  value.toStringAsFixed(value == value.roundToDouble() ? 0 : 1),
).replaceAll('.', '٫');

class EnergyCard extends StatelessWidget {
  const EnergyCard({super.key, required this.date});
  final DateTime date;
  @override
  Widget build(BuildContext context) {
    final s = DemoScope.of(context),
        target = s.calorieTarget(date),
        consumed = s.consumedCalories(date);
    final remaining = math.max(0, target - consumed);
    return Container(
      key: const ValueKey('daily-energy-card'),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        gradient: const LinearGradient(
          begin: Alignment.topRight,
          end: Alignment.bottomLeft,
          colors: [Color(0xFF205638), Color(0xFF123B2D)],
        ),
        boxShadow: [
          BoxShadow(
            color: pine.withValues(alpha: .13),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Stack(
        children: [
          Positioned(
            left: -38,
            top: -50,
            child: Container(
              width: 190,
              height: 190,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: .045),
              ),
            ),
          ),
          Positioned(
            right: -45,
            bottom: -95,
            child: Container(
              width: 220,
              height: 80,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: Colors.white.withValues(alpha: .06),
                  width: 30,
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    const Icon(
                      Icons.calendar_today_outlined,
                      size: 16,
                      color: Color(0xFFCCE6AD),
                    ),
                    const SizedBox(width: 7),
                    Expanded(
                      child: Text(
                        persianDate(date, year: true),
                        style: const TextStyle(
                          fontSize: 12,
                          color: Colors.white,
                        ),
                      ),
                    ),
                    const Icon(
                      Icons.spa_outlined,
                      color: Color(0xFFCCE6AD),
                      size: 23,
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'انرژی امروز تو',
                            style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'هدف روزانه',
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: .72),
                              fontSize: 11,
                            ),
                          ),
                          Text(
                            target > 0
                                ? '${fa(target)} کیلوکالری'
                                : 'پس از تأیید متخصص',
                            key: const ValueKey('daily-calorie-target'),
                            style: TextStyle(
                              color: const Color(0xFFE0F3CB),
                              fontSize: target > 0 ? 18 : 13,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            target > 0
                                ? (consumed > target
                                      ? '${fa(consumed - target)} بیشتر از برنامه'
                                      : '${fa(remaining)} کیلوکالری باقی‌مانده')
                                : 'برنامه‌ات در حال آماده‌شدن است',
                            style: const TextStyle(
                              color: Colors.white70,
                              fontSize: 10,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    SizedBox(
                      width: 100,
                      height: 100,
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          SizedBox.expand(
                            child: CircularProgressIndicator(
                              value: target > 0
                                  ? (consumed / target).clamp(0, 1)
                                  : 0,
                              strokeWidth: 7,
                              strokeCap: StrokeCap.round,
                              backgroundColor: Colors.white.withValues(
                                alpha: .12,
                              ),
                              color: const Color(0xFFC4E88F),
                            ),
                          ),
                          FittedBox(
                            fit: BoxFit.scaleDown,
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(
                                  Icons.local_fire_department_outlined,
                                  color: Color(0xFFC4E88F),
                                  size: 18,
                                ),
                                Text(
                                  fa(consumed),
                                  key: const ValueKey('consumed-calories'),
                                  style: const TextStyle(
                                    fontSize: 26,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.white,
                                  ),
                                ),
                                const Text(
                                  'دریافت‌شده',
                                  style: TextStyle(
                                    fontSize: 10,
                                    color: Colors.white70,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 7,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: .08),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.check_circle_outline,
                        color: Color(0xFFC4E88F),
                        size: 18,
                      ),
                      const SizedBox(width: 7),
                      Expanded(
                        child: Text(
                          '${fa(s.eatenCount(date))} از ${fa(s.mealsOn(date).length)} وعده ثبت شده',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                          ),
                        ),
                      ),
                      const Text(
                        'با تیک «خوردم»',
                        style: TextStyle(color: Colors.white60, fontSize: 10),
                      ),
                    ],
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

class WeightJourneyCard extends StatelessWidget {
  const WeightJourneyCard({super.key});
  @override
  Widget build(BuildContext context) {
    final s = DemoScope.of(context), q = s.questionnaire;
    final start = QuestionnaireData.number(q.weight) ?? s.latestWeight,
        target = QuestionnaireData.number(q.targetWeight);
    final progress = target != null && start != target
        ? ((s.latestWeight - start) / (target - start)).clamp(0.0, 1.0)
        : 0.0;
    return Surface(
      key: const ValueKey('weight-journey'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(9),
                decoration: BoxDecoration(
                  color: sage,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.flag_outlined, color: pine),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'مسیر هدف تو',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Text(
                      q.goal,
                      style: const TextStyle(fontSize: 11, color: muted),
                    ),
                  ],
                ),
              ),
              IconButton(
                tooltip: 'ویرایش هدف',
                onPressed: () => pushPage(
                  context,
                  QuestionnaireScreen(editing: s.questionnaireComplete),
                ),
                icon: const Icon(Icons.tune, color: pine),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _WeightNumber(
                  'وزن فعلی',
                  decimalFa(s.latestWeight),
                  'کیلوگرم',
                ),
              ),
              Container(width: 1, height: 44, color: sage),
              Expanded(
                child: _WeightNumber(
                  'وزن هدف',
                  target != null ? decimalFa(target) : '—',
                  target != null ? 'کیلوگرم' : 'تعیین نشده',
                ),
              ),
            ],
          ),
          if (!q.pregnant && target != null) ...[
            const SizedBox(height: 16),
            ClipRRect(
              borderRadius: BorderRadius.circular(9),
              child: LinearProgressIndicator(
                value: progress,
                minHeight: 7,
                backgroundColor: sage,
                color: pine,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'شروع: ${decimalFa(start)} کیلوگرم · فاصله تا هدف: ${decimalFa((s.latestWeight - target).abs())} کیلوگرم',
              style: const TextStyle(fontSize: 11, color: muted, height: 1.8),
            ),
          ],
          if (q.pregnant) ...[
            const SizedBox(height: 16),
            Container(
              key: const ValueKey('pregnancy-extras'),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: sage,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.child_care, color: pine, size: 19),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'هفتهٔ ${fa(q.pregnancyWeek)} بارداری · ${q.babies}',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: pine,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'وزن پیش از بارداری: ${fa(q.prePregnancyWeight)} کیلوگرم',
                    style: const TextStyle(fontSize: 11, color: muted),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'وزن هدف بارداری با نظر متخصص ثبت می‌شود.',
                    style: TextStyle(fontSize: 10, color: muted),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _WeightNumber extends StatelessWidget {
  const _WeightNumber(this.title, this.value, this.unit);
  final String title, value, unit;
  @override
  Widget build(BuildContext context) => Column(
    children: [
      Text(title, style: const TextStyle(fontSize: 11, color: muted)),
      Text(
        value,
        style: const TextStyle(
          fontSize: 27,
          fontWeight: FontWeight.bold,
          color: pine,
        ),
      ),
      Text(unit, style: const TextStyle(fontSize: 10, color: muted)),
    ],
  );
}

class ScheduledMealTile extends StatelessWidget {
  const ScheduledMealTile({super.key, required this.date, required this.index});
  final DateTime date;
  final int index;
  @override
  Widget build(BuildContext context) {
    final s = DemoScope.of(context),
        m = s.mealsOn(date)[index],
        eaten = s.mealEaten(date, index);
    final canLog = dateKey(date) == dateKey(s.today);
    return Semantics(
      enabled: !eaten,
      child: Opacity(
        opacity: eaten ? 0.48 : 1,
        child: Surface(
          color: eaten ? const Color(0xFFF1F6E9) : Colors.white,
          padding: 12,
          onTap: eaten ? null : () => showMealDetails(context, date, index),
          child: Row(
            children: [
              FoodArt(kind: m.kind, size: 60),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${m.name} · ${m.time}',
                      style: const TextStyle(color: muted, fontSize: 10),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      m.title,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      '${fa(m.calories)} کیلوکالری · جزئیات و مقدار',
                      style: const TextStyle(color: pine, fontSize: 10),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 5),
              Column(
                children: [
                  Checkbox(
                    value: eaten,
                    semanticLabel: 'خوردم: ${m.name}',
                    onChanged: s.savingMeal || eaten || !canLog
                        ? null
                        : (v) => _setEaten(context, s, date, index, v ?? false),
                  ),
                  Text(
                    eaten ? 'ثبت شد' : 'نخوردم',
                    style: TextStyle(fontSize: 10, color: eaten ? pine : muted),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

Future<void> _setEaten(
  BuildContext context,
  DemoStore store,
  DateTime date,
  int index,
  bool value,
) async {
  try {
    final alreadyEaten = store.mealEaten(date, index);
    await store.setMealEaten(date, index, value);
    if (value &&
        !alreadyEaten &&
        store.mealEaten(date, index) &&
        context.mounted) {
      showMealCelebration(context);
    }
  } catch (_) {
    if (context.mounted) showToast(context, 'ثبت انجام نشد؛ دوباره تلاش کن.');
  }
}

void showMealDetails(BuildContext context, DateTime date, int index) {
  final s = DemoScope.of(context);
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    backgroundColor: cream,
    builder: (sheet) => AnimatedBuilder(
      animation: s,
      builder: (sheet, _) {
        final m = s.mealsOn(date)[index], eaten = s.mealEaten(date, index);
        return SafeArea(
          child: SizedBox(
            height: MediaQuery.sizeOf(sheet).height * .85,
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Row(
                    children: [
                      Tag('${m.name} · ${m.time}'),
                      const Spacer(),
                      IconButton(
                        tooltip: 'بستن جزئیات غذا',
                        onPressed: () => Navigator.pop(sheet),
                        icon: const Icon(Icons.close),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(24, 0, 24, 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Center(child: FoodArt(kind: m.kind, size: 108)),
                        Text(
                          m.title,
                          style: Theme.of(sheet).textTheme.headlineSmall,
                        ),
                        const SizedBox(height: 5),
                        Text(
                          '${persianDate(date)} · ${fa(m.calories)} کیلوکالری',
                          style: const TextStyle(color: pine, fontSize: 12),
                        ),
                        const SizedBox(height: 20),
                        Surface(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              const Text(
                                'چه مقدار بخورم؟',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 17,
                                ),
                              ),
                              const SizedBox(height: 12),
                              for (final portion in m.amount.split('\n'))
                                Padding(
                                  padding: const EdgeInsets.only(bottom: 10),
                                  child: Row(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      const Padding(
                                        padding: EdgeInsets.only(top: 5),
                                        child: Icon(
                                          Icons.check_circle_outline,
                                          size: 16,
                                          color: pine,
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: Text(
                                          portion,
                                          style: const TextStyle(
                                            fontSize: 13,
                                            height: 1.8,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 14),
                        Text(
                          m.details,
                          style: const TextStyle(
                            color: muted,
                            fontSize: 12,
                            height: 1.8,
                          ),
                        ),
                        const SizedBox(height: 12),
                        const Text(
                          'مقدارها و کالری‌های این نسخه نمونهٔ طراحی هستند.',
                          style: TextStyle(color: muted, fontSize: 10),
                        ),
                      ],
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(24, 10, 24, 18),
                  child: PrimaryButton(
                    s.savingMeal
                        ? 'در حال ثبت…'
                        : eaten
                        ? 'این وعده ثبت شد'
                        : dateKey(date) != dateKey(s.today)
                        ? 'ثبت در روز این وعده'
                        : 'این وعده را خوردم',
                    onPressed:
                        s.savingMeal ||
                            eaten ||
                            dateKey(date) != dateKey(s.today)
                        ? null
                        : () => _setEaten(sheet, s, date, index, !eaten),
                    icon: Icons.check_circle_outline,
                  ),
                ),
              ],
            ),
          ),
        );
      },
    ),
  );
}

class DailyAdviceCard extends StatelessWidget {
  const DailyAdviceCard({super.key, required this.date});
  final DateTime date;
  @override
  Widget build(BuildContext context) => Surface(
    key: const ValueKey('daily-advice'),
    color: const Color(0xFFEAF3E4),
    padding: 13,
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.only(top: 3),
          child: Icon(Icons.format_quote, color: pine, size: 22),
        ),
        const SizedBox(width: 9),
        Expanded(
          child: Text(
            dailyEncouragement(date),
            style: const TextStyle(color: pine, fontSize: 12, height: 1.8),
          ),
        ),
      ],
    ),
  );
}
