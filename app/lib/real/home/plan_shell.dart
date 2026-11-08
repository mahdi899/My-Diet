import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../theme.dart';
import '../commerce/commerce.dart';
import '../core/api.dart';
import '../core/digits.dart';
import '../core/jalali.dart';
import '../core/motion.dart';
import '../onboarding/repository.dart';
import '../plan/plan.dart';
import '../session.dart';
import 'topup_sheet.dart';

/// The approved plan, living: today, the week, the shopping list and the person's own page.
class PlanShell extends StatefulWidget {
  const PlanShell({
    super.key,
    required this.session,
    required this.services,
    required this.plan,
    required this.onRefresh,
    this.pendingRevision,
    this.profile,
  });
  final SessionController session;
  final Services services;
  final PublishedPlan plan;
  final PlanRequestInfo? pendingRevision;
  final ProfileSummary? profile;
  final VoidCallback onRefresh;

  @override
  State<PlanShell> createState() => _PlanShellState();
}

class _PlanShellState extends State<PlanShell> {
  int tab = 0;
  // Eaten flags are kept locally so toggling feels instant; the server stays the source of truth.
  final Map<String, bool> eaten = {};

  bool isEaten(MealView m) => eaten[m.uid] ?? m.eaten;

  Future<void> _toggle(MealView m) async {
    final next = !isEaten(m);
    Haptics.tap();
    setState(() => eaten[m.uid] = next);
    try {
      await widget.services.plans.setEaten(m.uid, next);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => eaten[m.uid] = !next);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  DayView get today {
    final now = DateTime.now();
    final key =
        '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
    final days = widget.plan.days;
    return days.firstWhere(
      (d) => d.date == key,
      orElse: () => key.compareTo(days.first.date) < 0 ? days.first : days.last,
    );
  }

  @override
  Widget build(BuildContext context) {
    final pages = [
      _DayPage(
        day: today,
        isToday: true,
        isEaten: isEaten,
        onToggle: _toggle,
        banner: widget.pendingRevision != null,
        target: widget.profile?.targetKcal,
      ),
      _WeekPage(plan: widget.plan, isEaten: isEaten, onToggle: _toggle),
      _ShoppingPage(plan: widget.plan, services: widget.services),
      _MePage(
        session: widget.session,
        services: widget.services,
        profile: widget.profile,
      ),
    ];
    return Scaffold(
      body: SafeArea(
        child: AnimatedSwitcher(
          duration: Motion.base,
          child: KeyedSubtree(key: ValueKey(tab), child: pages[tab]),
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: tab,
        onDestinationSelected: (i) {
          Haptics.tap();
          setState(() => tab = i);
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.today_outlined),
            selectedIcon: Icon(Icons.today),
            label: 'امروز',
          ),
          NavigationDestination(
            icon: Icon(Icons.calendar_view_week_outlined),
            selectedIcon: Icon(Icons.calendar_view_week),
            label: 'هفته',
          ),
          NavigationDestination(
            icon: Icon(Icons.shopping_basket_outlined),
            selectedIcon: Icon(Icons.shopping_basket),
            label: 'خرید',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: 'من',
          ),
        ],
      ),
    );
  }
}

class _Ring extends StatelessWidget {
  const _Ring({required this.value, required this.child});
  final double value; // 0..1
  final Widget child;
  static const size = 120.0;
  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
    tween: Tween(begin: 0, end: value.clamp(0, 1)),
    duration: Motion.slow,
    curve: Motion.curve,
    builder: (context, v, _) => SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _RingPainter(v),
        child: Center(child: child),
      ),
    ),
  );
}

class _RingPainter extends CustomPainter {
  _RingPainter(this.v);
  final double v;
  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final p = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 11
      ..strokeCap = StrokeCap.round
      ..color = sage;
    final inner = rect.deflate(8);
    canvas.drawArc(inner, 0, math.pi * 2, false, p);
    p.color = pine;
    canvas.drawArc(inner, -math.pi / 2, math.pi * 2 * v, false, p);
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.v != v;
}

String _dayTitle(DayView d) {
  final j = Jalali.fromDate(d.dateTime);
  return '${weekdayNames[saturdayIndex(d.dateTime)]}، ${j.format()}';
}

class _DayPage extends StatelessWidget {
  const _DayPage({
    super.key,
    required this.day,
    required this.isEaten,
    required this.onToggle,
    this.isToday = false,
    this.banner = false,
    this.target,
  });
  final DayView day;
  final bool isToday, banner;
  final bool Function(MealView) isEaten;
  final void Function(MealView) onToggle;
  final int? target;

  @override
  Widget build(BuildContext context) {
    final eatenKcal = day.meals
        .where(isEaten)
        .fold(0, (s, m) => s + m.calories);
    final total = day.kcal == 0 ? (target ?? 1) : day.kcal;
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
      children: [
        Text(
          isToday ? 'امروز' : 'برنامه',
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        Text(_dayTitle(day), style: const TextStyle(color: muted)),
        if (banner)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF7E3),
                borderRadius: BorderRadius.circular(14),
              ),
              child: const Text(
                'یه درخواست تغییر در حال بررسیه؛ برنامهٔ فعلی تا تأیید دکتر معتبره.',
                style: TextStyle(fontSize: 12, height: 1.8),
              ),
            ),
          ),
        const SizedBox(height: 16),
        Reveal(
          child: Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: const Color(0xFFDDE5D4)),
            ),
            child: Row(
              children: [
                _Ring(
                  value: eatenKcal / total,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        fa(eatenKcal),
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                          color: pine,
                        ),
                      ),
                      const Text(
                        'کیلوکالری',
                        style: TextStyle(fontSize: 10, color: muted),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 18),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${fa(day.meals.where(isEaten).length)} از ${fa(day.meals.length)} وعده',
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'هدف امروز: ${fa(day.kcal)} کیلوکالری',
                        style: const TextStyle(color: muted, fontSize: 12),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 18),
        for (final (i, m) in day.meals.indexed)
          Reveal(
            index: i + 1,
            child: _MealCard(
              meal: m,
              eaten: isEaten(m),
              onToggle: isToday && m.loggable ? () => onToggle(m) : null,
            ),
          ),
      ],
    );
  }
}

class _MealCard extends StatelessWidget {
  const _MealCard({required this.meal, required this.eaten, this.onToggle});
  final MealView meal;
  final bool eaten;
  final VoidCallback? onToggle;

  @override
  Widget build(BuildContext context) {
    final option = meal.selected;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: () => showMealSheet(context, meal),
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: eaten ? pine : const Color(0xFFDDE5D4)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${meal.typeLabel}${meal.time == null ? '' : ' · ${fa(meal.time)}'}',
                        style: const TextStyle(fontSize: 11, color: muted),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        option?.title ?? meal.title,
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          decoration: eaten ? TextDecoration.lineThrough : null,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${fa(meal.calories)} کیلوکالری${meal.options.length > 1 ? ' · ${fa(meal.options.length)} گزینه' : ''}',
                        style: const TextStyle(fontSize: 12, color: muted),
                      ),
                    ],
                  ),
                ),
                if (onToggle != null)
                  IconButton.filledTonal(
                    tooltip: eaten ? 'برگردوندن' : 'خوردم',
                    onPressed: onToggle,
                    isSelected: eaten,
                    icon: const Icon(Icons.check),
                    selectedIcon: const Icon(Icons.check_circle),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

Future<void> showMealSheet(BuildContext context, MealView meal) =>
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: cream,
      builder: (_) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.75,
        maxChildSize: 0.95,
        builder: (context, scroll) => ListView(
          controller: scroll,
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 28),
          children: [
            Text(meal.typeLabel, style: Theme.of(context).textTheme.titleLarge),
            if (meal.notes.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  meal.notes,
                  style: const TextStyle(color: muted, height: 1.8),
                ),
              ),
            const SizedBox(height: 12),
            for (final o in meal.options)
              Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(
                    color: o.id == meal.selected?.id
                        ? pine
                        : const Color(0xFFDDE5D4),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: sage,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            o.kindLabel,
                            style: const TextStyle(fontSize: 10, color: pine),
                          ),
                        ),
                        const Spacer(),
                        if (o.calories != null)
                          Text(
                            '${fa(o.calories)} کیلوکالری',
                            style: const TextStyle(fontSize: 12, color: muted),
                          ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      o.title,
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                    if (o.ingredients.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: [
                          for (final i in o.ingredients)
                            Chip(
                              label: Text(
                                i,
                                style: const TextStyle(fontSize: 11),
                              ),
                              visualDensity: VisualDensity.compact,
                              backgroundColor: cream,
                            ),
                        ],
                      ),
                    ],
                    if (o.instructions.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(
                        o.instructions,
                        style: const TextStyle(fontSize: 12, height: 1.9),
                      ),
                    ],
                    if (o.prepMinutes > 0)
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Text(
                          'زمان آماده‌سازی: ${fa(o.prepMinutes)} دقیقه',
                          style: const TextStyle(fontSize: 11, color: muted),
                        ),
                      ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );

class _WeekPage extends StatefulWidget {
  const _WeekPage({
    required this.plan,
    required this.isEaten,
    required this.onToggle,
  });
  final PublishedPlan plan;
  final bool Function(MealView) isEaten;
  final void Function(MealView) onToggle;
  @override
  State<_WeekPage> createState() => _WeekPageState();
}

class _WeekPageState extends State<_WeekPage> {
  int selected = 0;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    final key =
        '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
    final i = widget.plan.days.indexWhere((d) => d.date == key);
    if (i >= 0) selected = i;
  }

  @override
  Widget build(BuildContext context) {
    final days = widget.plan.days;
    final day = days[selected.clamp(0, days.length - 1)];
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
          child: Align(
            alignment: AlignmentDirectional.centerStart,
            child: Text(
              'برنامهٔ هفته',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
          ),
        ),
        SizedBox(
          height: 78,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: days.length,
            separatorBuilder: (_, _) => const SizedBox(width: 8),
            itemBuilder: (context, i) {
              final d = days[i];
              final on = i == selected;
              return GestureDetector(
                onTap: () {
                  Haptics.tap();
                  setState(() => selected = i);
                },
                child: AnimatedContainer(
                  duration: Motion.quick,
                  width: 62,
                  decoration: BoxDecoration(
                    color: on ? pine : Colors.white,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(
                      color: on ? pine : const Color(0xFFDDE5D4),
                    ),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        weekdayNames[saturdayIndex(d.dateTime)],
                        style: TextStyle(
                          fontSize: 11,
                          color: on ? Colors.white : muted,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        fa(Jalali.fromDate(d.dateTime).day),
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: on ? Colors.white : ink,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
        Expanded(
          child: _DayPage(
            key: ValueKey(day.date),
            day: day,
            isEaten: widget.isEaten,
            onToggle: widget.onToggle,
          ),
        ),
      ],
    );
  }
}

class _ShoppingPage extends StatefulWidget {
  const _ShoppingPage({required this.plan, required this.services});
  final PublishedPlan plan;
  final Services services;
  @override
  State<_ShoppingPage> createState() => _ShoppingPageState();
}

class _ShoppingPageState extends State<_ShoppingPage> {
  ShoppingList? list;
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final l = await widget.services.plans.shopping(widget.plan.weekStart);
      if (mounted) setState(() => list = l);
    } on ApiException catch (e) {
      if (mounted) setState(() => error = e.message);
    }
  }

  Future<void> _flag(ShoppingItem item, {bool? have, bool? bought}) async {
    final l = list;
    if (l == null) return;
    Haptics.tap();
    try {
      final next = await widget.services.plans.flagShopping(
        l.weekStart,
        item,
        l.revision,
        alreadyHave: have ?? item.alreadyHave,
        purchased: bought ?? item.purchased,
      );
      if (mounted) setState(() => list = next);
    } on ApiException catch (e) {
      if (e.code == 'lock_conflict') await _load();
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = list;
    if (l == null) {
      return Center(
        child: error == null
            ? const CircularProgressIndicator()
            : Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(error!),
                  TextButton(
                    onPressed: _load,
                    child: const Text('تلاش دوباره'),
                  ),
                ],
              ),
      );
    }
    final groups = <String, List<ShoppingItem>>{};
    for (final i in l.items) {
      groups
          .putIfAbsent(i.category.isEmpty ? 'سایر' : i.category, () => [])
          .add(i);
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
        children: [
          Text(
            'لیست خرید هفته',
            style: Theme.of(context).textTheme.headlineMedium,
          ),
          const SizedBox(height: 4),
          Text(
            '${fa(l.items.where((i) => i.purchased || i.alreadyHave).length)} از ${fa(l.items.length)} آماده',
            style: const TextStyle(color: muted),
          ),
          if (l.incomplete)
            const Padding(
              padding: EdgeInsets.only(top: 8),
              child: Text(
                'بعضی مقدارها دقیق نیست؛ موقع خرید با نظر خودت تنظیم کن.',
                style: TextStyle(fontSize: 12, color: amber),
              ),
            ),
          const SizedBox(height: 12),
          for (final e in groups.entries) ...[
            Padding(
              padding: const EdgeInsets.only(top: 10, bottom: 6),
              child: Text(
                e.key,
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  color: pine,
                ),
              ),
            ),
            for (final i in e.value)
              Container(
                margin: const EdgeInsets.only(bottom: 6),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Material(
                  type: MaterialType.transparency,
                  child: CheckboxListTile(
                    value: i.purchased,
                    onChanged: (v) => _flag(i, bought: v ?? false),
                    controlAffinity: ListTileControlAffinity.leading,
                    title: Text(
                      i.name,
                      style: TextStyle(
                        decoration: i.purchased || i.alreadyHave
                            ? TextDecoration.lineThrough
                            : null,
                      ),
                    ),
                    subtitle: Text(
                      i.quantity == null
                          ? 'مقدار نامشخص'
                          : '${faNumber(i.quantity!)} ${i.unit ?? ''}',
                      style: const TextStyle(fontSize: 11),
                    ),
                    secondary: TextButton(
                      onPressed: () => _flag(i, have: !i.alreadyHave),
                      child: Text(
                        i.alreadyHave ? 'ندارم' : 'دارم',
                        style: const TextStyle(fontSize: 12),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class _MePage extends StatefulWidget {
  const _MePage({required this.session, required this.services, this.profile});
  final SessionController session;
  final Services services;
  final ProfileSummary? profile;
  @override
  State<_MePage> createState() => _MePageState();
}

class _MePageState extends State<_MePage> {
  Wallet? wallet;
  Catalog? catalog;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await Future.wait<Object>([
        widget.services.commerce.wallet(),
        widget.services.commerce.catalog(),
      ]);
      if (mounted) {
        setState(() {
          wallet = r[0] as Wallet;
          catalog = r[1] as Catalog;
        });
      }
    } on ApiException {
      // The wallet card simply stays empty; nothing here is critical.
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.profile;
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
      children: [
        Text('من', style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 14),
        if (p != null)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: sage,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'پروفایل تو',
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                Text(
                  'وزن ${faNumber(p.weightKg)} کیلو · قد ${faNumber(p.heightCm)} · BMI ${faNumber(p.bmi)}',
                ),
                Text('هدف روزانه ${fa(p.targetKcal)} کیلوکالری'),
              ],
            ),
          ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFFDDE5D4)),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'کیف پول',
                      style: TextStyle(color: muted, fontSize: 12),
                    ),
                    Text(
                      wallet == null ? '…' : '${money(wallet!.total)} تومان',
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 18,
                        color: pine,
                      ),
                    ),
                  ],
                ),
              ),
              OutlinedButton(
                onPressed: catalog == null
                    ? null
                    : () async {
                        final ok = await showTopupSheet(
                          context,
                          commerce: widget.services.commerce,
                          packages: catalog!.topups,
                        );
                        if (ok == true) await _load();
                      },
                child: const Text('شارژ'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        OutlinedButton.icon(
          onPressed: widget.session.signOut,
          icon: const Icon(Icons.logout),
          label: const Text('خروج از حساب'),
        ),
      ],
    );
  }
}
