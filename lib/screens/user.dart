import 'dart:math' as math;
import 'dart:async';
import '../data/day.dart';
import '../widgets/nutrition.dart';
import 'package:flutter/material.dart';
import '../data/demo_store.dart';
import '../theme.dart';
import '../widgets/ui.dart';
import 'questionnaire.dart';
import 'shared.dart';
import 'doctor.dart';
import 'wallet_flow.dart';
import '../data/wallet_catalog.dart';
import 'admin.dart' show FoodsScreen;

class UserHome extends StatefulWidget {
  const UserHome({super.key, required this.onPlan});
  final VoidCallback onPlan;
  @override
  State<UserHome> createState() => _UserHomeState();
}

class _UserHomeState extends State<UserHome> with WidgetsBindingObserver {
  Timer? refresh;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    refresh = Timer.periodic(const Duration(minutes: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && mounted) setState(() {});
  }

  @override
  void dispose() {
    refresh?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = DemoScope.of(context),
        hasPlan = s.hasUserRequest && s.userRequest.isPublished,
        r = s.hasUserRequest ? s.userRequest : null,
        date = s.today,
        meals = s.mealsOn(date),
        specialist = r?.specialist ?? s.experts.first.name;
    return CustomScrollView(
      slivers: [
        SliverAppBar(
          floating: true,
          title: Text('سلام ${s.questionnaire.name.split(' ').first} 🌿'),
          actions: [
            const Padding(
              padding: EdgeInsetsDirectional.only(end: 8),
              child: Center(child: TokenWalletChip()),
            ),
            IconButton(
              tooltip: 'پیام‌ها',
              onPressed: () => pushPage(context, const MessagesScreen()),
              icon: Badge(
                isLabelVisible: s.messages.isNotEmpty,
                smallSize: 7,
                child: const Icon(Icons.chat_bubble_outline),
              ),
            ),
          ],
          bottom: const PreferredSize(
            preferredSize: Size.fromHeight(25),
            child: Padding(
              padding: EdgeInsets.only(bottom: 12),
              child: Text(
                'امروز هم برای خودت قدم بردار',
                style: TextStyle(color: muted, fontSize: 12),
              ),
            ),
          ),
        ),
        SliverToBoxAdapter(
          child: PageBody(
            scrollable: false,
            children: [
              EnergyCard(date: date),
              DailyAdviceCard(date: date),
              if (hasPlan) ...[
                Heading(
                  'برنامهٔ امروز',
                  subtitle: 'غذا را لمس کن تا مقدار دقیقش را ببینی',
                  action: TextButton(
                    onPressed: widget.onPlan,
                    child: const Text('برنامهٔ کامل'),
                  ),
                ),
                if (r!.revisionRequested)
                  const Notice(
                    'درخواست اصلاح در حال بررسی است؛ برنامهٔ تأییدشدهٔ فعلی همچنان در دسترس است.',
                  ),
                for (var i = 0; i < meals.length; i++)
                  ScheduledMealTile(date: date, index: i),
              ] else if (!s.userSignedIn || r == null)
                Surface(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Heading(
                        'شما برنامه‌ای ندارید',
                        subtitle: s.userSignedIn
                            ? 'با انتخاب سرویس و پرداخت توکن، درخواست برنامه را ثبت کن.'
                            : 'با ورود و ثبت درخواست، برنامهٔ غذایی شخصی‌سازی‌شده دریافت می‌کنی.',
                      ),
                      const SizedBox(height: 16),
                      PrimaryButton(
                        'دریافت برنامه غذایی',
                        key: const ValueKey('get-food-plan'),
                        icon: Icons.restaurant_menu_outlined,
                        onPressed: () => openPlanServices(context),
                      ),
                    ],
                  ),
                )
              else
                Surface(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Heading('وضعیت برنامه', subtitle: 'درخواست ${fa(r.id)}'),
                      const SizedBox(height: 14),
                      PlanTimeline(status: r.status),
                      if (r.status == PlanStatus.needsInfo) ...[
                        const SizedBox(height: 12),
                        Notice(
                          r.question.isEmpty
                              ? 'متخصص به اطلاعات بیشتری نیاز دارد.'
                              : r.question,
                          warning: true,
                        ),
                        TextButton(
                          onPressed: () =>
                              pushPage(context, const MessagesScreen()),
                          child: const Text('دیدن پیام متخصص'),
                        ),
                      ],
                    ],
                  ),
                ),
              const WeightJourneyCard(),
              Surface(
                onTap: () => pushPage(context, const DoctorDetailsScreen()),
                padding: 16,
                child: Row(
                  children: [
                    PersonAvatar(specialist, color: const Color(0xFFF3E5D6)),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            specialist,
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                          const Text(
                            'متخصص تغذیه · همراه تو',
                            style: TextStyle(fontSize: 11, color: muted),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      tooltip: 'پیام به متخصص',
                      onPressed: () =>
                          pushPage(context, const MessagesScreen()),
                      icon: const Icon(Icons.chat_bubble_outline, color: pine),
                    ),
                  ],
                ),
              ),
              const Text(
                'نسخهٔ نمایشی · غذاها، مقدارها و انرژی نمونه هستند.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 10, color: muted),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class PlanTimeline extends StatelessWidget {
  const PlanTimeline({super.key, required this.status});
  final PlanStatus status;
  @override
  Widget build(BuildContext context) {
    final active = switch (status) {
      PlanStatus.incomplete => 0,
      PlanStatus.queued => 1,
      PlanStatus.generating => 2,
      PlanStatus.reviewing || PlanStatus.needsInfo => 3,
      PlanStatus.ready => 5,
    };
    const labels = [
      'ثبت درخواست',
      'بررسی اطلاعات',
      'تهیهٔ پیش‌نویس',
      'بررسی متخصص',
      'برنامه آماده',
    ];
    return Column(
      children: List.generate(5, (i) {
        final done = i < active, current = i == active;
        return IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(
                width: 36,
                child: Column(
                  children: [
                    Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: done
                            ? pine
                            : current
                            ? const Color(0xFFFBE6B5)
                            : const Color(0xFFE9EDE1),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        done
                            ? Icons.check_rounded
                            : current
                            ? Icons.access_time
                            : Icons.circle,
                        size: done || current ? 18 : 8,
                        color: done
                            ? Colors.white
                            : current
                            ? amber
                            : const Color(0xFFADB7A1),
                      ),
                    ),
                    if (i < 4)
                      Expanded(
                        child: Container(
                          width: 2,
                          color: done
                              ? const Color(0xFFA8C68D)
                              : const Color(0xFFE6EBDD),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 13),
              Expanded(
                child: Padding(
                  padding: EdgeInsets.only(bottom: i == 4 ? 0 : 20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        labels[i],
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: done || current ? ink : muted,
                        ),
                      ),
                      Text(
                        done
                            ? 'انجام شد'
                            : current
                            ? (status == PlanStatus.needsInfo
                                  ? 'منتظر پاسخ تو'
                                  : 'در حال انجام')
                            : 'مرحلهٔ بعد',
                        style: TextStyle(
                          fontSize: 11,
                          color: current ? amber : muted,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      }),
    );
  }
}

class MealPreview extends StatelessWidget {
  const MealPreview(this.meal, {super.key, required this.onTap});
  final Meal meal;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Surface(
    onTap: onTap,
    padding: 13,
    child: Row(
      children: [
        FoodArt(kind: meal.kind, size: 80),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                meal.name,
                style: const TextStyle(color: muted, fontSize: 11),
              ),
              Text(
                meal.title,
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                ),
              ),
              Text(
                '${meal.time} · ${meal.amount}',
                style: const TextStyle(fontSize: 10, color: muted),
              ),
            ],
          ),
        ),
        const Icon(Icons.chevron_left, color: muted),
      ],
    ),
  );
}

class PlanScreen extends StatefulWidget {
  const PlanScreen({super.key, this.embedded = false});
  final bool embedded;
  @override
  State<PlanScreen> createState() => _PlanScreenState();
}

class _PlanScreenState extends State<PlanScreen> with WidgetsBindingObserver {
  ScrollController? daysController;
  Timer? dayRefresh;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    dayRefresh = Timer.periodic(const Duration(minutes: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final s = DemoScope.of(context);
    final width = math.min(640.0, MediaQuery.sizeOf(context).width - 40);
    daysController ??= ScrollController(
      initialScrollOffset: math.min(
        weekDayIndex(s.today) * 86.0,
        math.max(0.0, 594 - width),
      ),
    );
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && mounted) setState(() {});
  }

  @override
  void dispose() {
    dayRefresh?.cancel();
    daysController?.dispose();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  int? selectedDay;
  @override
  Widget build(BuildContext context) {
    final s = DemoScope.of(context);
    if (!s.hasUserRequest) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('برنامهٔ غذایی من'),
          automaticallyImplyLeading: !widget.embedded,
        ),
        body: PageBody(
          children: [
            EmptyPanel(
              'شما برنامه‌ای ندارید',
              'برای دیدن برنامهٔ هفتگی، ابتدا درخواست برنامه را ثبت کن.',
              icon: Icons.calendar_month_outlined,
              action: PrimaryButton(
                'دریافت برنامه غذایی',
                icon: Icons.restaurant_menu_outlined,
                onPressed: () => openPlanServices(context),
              ),
            ),
          ],
        ),
      );
    }
    final r = s.userRequest;
    final day = (selectedDay ?? weekDayIndex(s.today)).clamp(
          weekDayIndex(s.today),
          6,
        ),
        start = startOfWeek(s.today);
    final date = DateTime(start.year, start.month, start.day + day),
        meals = s.mealsOn(date);
    return Scaffold(
      appBar: AppBar(
        title: const Text('برنامهٔ غذایی من'),
        automaticallyImplyLeading: !widget.embedded,
        actions: [
          if (r.isPublished)
            IconButton(
              tooltip: 'نمایش خلاصهٔ برنامه',
              onPressed: () => pushPage(context, const PlanSummaryScreen()),
              icon: const Icon(Icons.article_outlined),
            ),
        ],
      ),
      body: PageBody(
        children: [
          if (!r.isPublished)
            EmptyPanel(
              'برنامه‌ات در راهه',
              'بعد از تأیید متخصص، وعده‌های هر روز در تب همان روز قرار می‌گیرند.',
              icon: Icons.calendar_month_outlined,
              action: OutlinedButton(
                onPressed: () {
                  s.approve(r.id);
                  showToast(context, 'برنامهٔ هفتگی نمونه نمایش داده شد.');
                },
                child: const Text('نمایش نمونهٔ تأییدشده'),
              ),
            )
          else ...[
            Surface(
              color: sage,
              padding: 16,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      const Icon(
                        Icons.verified_outlined,
                        color: pine,
                        size: 22,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'برنامهٔ هفتگی ${r.name.split(' ').first}',
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                      ),
                      Tag('نسخهٔ ${fa(r.version)}'),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    r.specialist,
                    style: const TextStyle(color: muted, fontSize: 12),
                  ),
                  if (r.revisionRequested) ...[
                    const SizedBox(height: 8),
                    const Tag('درخواست اصلاح در حال بررسی', warning: true),
                  ],
                ],
              ),
            ),
            Row(
              children: [
                const Icon(
                  Icons.calendar_month_outlined,
                  color: pine,
                  size: 19,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    '${persianDate(start).split('، ').last} تا ${persianDate(DateTime(start.year, start.month, start.day + 6)).split('، ').last}',
                    style: const TextStyle(
                      color: pine,
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                const Tag('همین هفته'),
              ],
            ),
            SizedBox(
              height: 92,
              child: ListView.separated(
                controller: daysController,
                scrollDirection: Axis.horizontal,
                itemCount: 7,
                separatorBuilder: (_, i) => const SizedBox(width: 8),
                itemBuilder: (context, i) {
                  final date = DateTime(start.year, start.month, start.day + i),
                      chosen = day == i,
                      past = i < weekDayIndex(s.today);
                  return Semantics(
                    selected: chosen,
                    enabled: !past,
                    button: true,
                    child: Material(
                      color: past
                          ? const Color(0xFFE9ECE5)
                          : chosen
                          ? pine
                          : Colors.white,
                      borderRadius: BorderRadius.circular(18),
                      child: InkWell(
                        key: ValueKey('plan-day-$i'),
                        borderRadius: BorderRadius.circular(18),
                        onTap: past
                            ? null
                            : () => setState(() => selectedDay = i),
                        child: SizedBox(
                          width: 78,
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                persianWeekDays[i],
                                maxLines: 1,
                                style: TextStyle(
                                  fontSize: 11,
                                  color: past
                                      ? const Color(0xFFA9B0A4)
                                      : chosen
                                      ? Colors.white70
                                      : muted,
                                ),
                              ),
                              const SizedBox(height: 3),
                              Text(
                                persianDate(date).split('، ').last,
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.bold,
                                  color: past
                                      ? const Color(0xFFA9B0A4)
                                      : chosen
                                      ? Colors.white
                                      : pine,
                                ),
                              ),
                              if (dateKey(date) == dateKey(s.today))
                                Container(
                                  width: 5,
                                  height: 5,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: chosen
                                        ? const Color(0xFFC4E88F)
                                        : pine,
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
            Heading(
              persianDate(date),
              subtitle:
                  '${fa(s.calorieTarget(date))} کیلوکالری · ${fa(meals.length)} وعده',
            ),
            for (var i = 0; i < meals.length; i++)
              ScheduledMealTile(date: date, index: i),
            Surface(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Heading('یادداشت متخصص'),
                  const SizedBox(height: 10),
                  Text(r.publishedNote),
                ],
              ),
            ),
            PrimaryButton(
              'درخواست تغییر برنامه',
              onPressed: () => showRevision(context),
              icon: Icons.edit_outlined,
            ),
            const Text(
              'برنامه، کالری و مقدارها در این نسخه نمونهٔ طراحی هستند.',
              style: TextStyle(fontSize: 10, color: muted),
            ),
          ],
        ],
      ),
    );
  }
}

void showAlternatives(BuildContext context, Meal meal) {
  showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (context) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'جایگزین‌های ${meal.name}',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 12),
            const Notice(
              'در محصول نهایی، فقط جایگزین‌های تأییدشده برای همین وعده نمایش داده می‌شوند.',
            ),
            const SizedBox(height: 16),
            Text(
              meal.kind == 1
                  ? 'نان، پنیر و سبزی'
                  : 'ترکیب خانگی با مواد اولیهٔ مشابه',
            ),
            const Text(
              'مقدار و ترکیب در این نمونه نمایشی است.',
              style: TextStyle(color: muted, fontSize: 12),
            ),
            const SizedBox(height: 18),
            OutlinedButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('متوجه شدم'),
            ),
          ],
        ),
      ),
    ),
  );
}

Future<void> showRevision(BuildContext context) async {
  final store = DemoScope.of(context), details = TextEditingController();
  String? reason;
  final form = GlobalKey<FormState>();
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (sheet) => StatefulBuilder(
      builder: (sheet, setSheet) => Padding(
        padding: EdgeInsets.fromLTRB(
          24,
          8,
          24,
          24 + MediaQuery.viewInsetsOf(sheet).bottom,
        ),
        child: SafeArea(
          child: SingleChildScrollView(
            child: Form(
              key: form,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'درخواست اصلاح برنامه',
                    style: Theme.of(sheet).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'کدوم قسمت برنامه با شرایطت جور نیست؟',
                    style: TextStyle(color: muted),
                  ),
                  const SizedBox(height: 18),
                  DropdownButtonFormField<String>(
                    initialValue: reason,
                    isExpanded: true,
                    decoration: const InputDecoration(labelText: 'دلیل تغییر'),
                    items:
                        [
                              'غذاها رو دوست ندارم',
                              'تهیهٔ غذاها زمان زیادی می‌بره',
                              'هزینهٔ غذاها بالاست',
                              'شرایطم تغییر کرده',
                              'دلیل دیگر',
                            ]
                            .map(
                              (s) => DropdownMenuItem(
                                value: s,
                                child: Text(
                                  s,
                                  style: const TextStyle(fontSize: 12),
                                ),
                              ),
                            )
                            .toList(),
                    onChanged: (v) => setSheet(() => reason = v),
                    validator: (v) => v == null ? 'یک دلیل انتخاب کن.' : null,
                  ),
                  const SizedBox(height: 15),
                  TextField(
                    controller: details,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      labelText: 'توضیح بیشتر (اختیاری)',
                    ),
                  ),
                  const SizedBox(height: 20),
                  PrimaryButton(
                    'ثبت درخواست',
                    onPressed: () {
                      if (!form.currentState!.validate()) return;
                      store.requestRevision(reason!, details.text.trim());
                      Navigator.pop(sheet);
                      showToast(context, 'درخواست اصلاح در نمونه ثبت شد.');
                    },
                    icon: Icons.send_outlined,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    ),
  );
  details.dispose();
}

class PlanSummaryScreen extends StatelessWidget {
  const PlanSummaryScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final r = DemoScope.of(context).userRequest;
    return Scaffold(
      appBar: AppBar(title: const Text('خلاصهٔ برنامه')),
      body: PageBody(
        children: [
          Heading(
            'برنامهٔ ${r.name}',
            subtitle: 'نسخهٔ ${fa(r.version)} · ${r.specialist}',
          ),
          ...r.published.map(
            (m) => Surface(
              child: InfoRows({
                m.name: m.title,
                'زمان': m.time,
                'مقدار': m.amount,
              }),
            ),
          ),
          const Notice(
            'این صفحه پیش‌نمایش خلاصه است؛ خروجی PDF یا ارسال فایل هنوز پیاده‌سازی نشده.',
          ),
        ],
      ),
    );
  }
}

class TrackingScreen extends StatelessWidget {
  const TrackingScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('پیگیری من')),
      body: PageBody(
        children: [
          const Heading(
            'قدم‌به‌قدم، کنار خودت',
            subtitle: 'حال بهترت هم به‌اندازهٔ عددها مهمه.',
          ),
          MetricGrid(
            items: [
              Metric(
                'آخرین وزن',
                '${fa(store.latestWeight)} کیلو',
                Icons.monitor_weight_outlined,
              ),
              Metric(
                'وعده‌های ثبت‌شده',
                fa(store.completedMeals.length),
                Icons.restaurant_outlined,
              ),
            ],
          ),
          Surface(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Heading(
                  'روند ثبت وزن',
                  subtitle: 'داده‌های اولیه نمونه هستند.',
                ),
                const SizedBox(height: 18),
                SizedBox(
                  height: 150,
                  child: CustomPaint(
                    painter: _WeightPainter(store.weightEntries),
                  ),
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: () => showWeight(context),
                  icon: const Icon(Icons.add),
                  label: const Text('ثبت وزن جدید'),
                ),
              ],
            ),
          ),
          Surface(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Heading('حال امروزت چطوره؟'),
                ...[
                  'آب نوشیدم',
                  'وعده‌ها رو منظم خوردم',
                  'نظرم رو به متخصص گفتم',
                ].map(
                  (s) => CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(s, style: const TextStyle(fontSize: 13)),
                    value: store.completedHabits.contains(s),
                    onChanged: (_) => store.toggleHabit(s),
                  ),
                ),
              ],
            ),
          ),
          Surface(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Heading('برنامه چطور پیش رفت؟'),
                const SizedBox(height: 14),
                ...['خوب و قابل اجرا بود', 'به کمی تغییر نیاز دارم'].map(
                  (s) => ChoiceCard(
                    s,
                    selected: store.feedback == s,
                    onTap: () {
                      store.feedback = s;
                      store.update();
                    },
                    icon: Icons.favorite_outline,
                  ),
                ),
                PrimaryButton(
                  'ثبت بازخورد',
                  onPressed: store.feedback.isEmpty
                      ? null
                      : () => showToast(context, 'بازخورد در نمونه ثبت شد.'),
                  icon: Icons.check,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

Future<void> showWeight(BuildContext context) async {
  final controller = TextEditingController(),
      form = GlobalKey<FormState>(),
      store = DemoScope.of(context);
  await showDialog<void>(
    context: context,
    builder: (dialog) => AlertDialog(
      title: const Text('ثبت وزن'),
      content: Form(
        key: form,
        child: TextFormField(
          controller: controller,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: const InputDecoration(labelText: 'وزن / کیلوگرم'),
          validator: (v) {
            final x = double.tryParse(latinDigits(v ?? ''));
            return x != null && x > 0 && x <= 500
                ? null
                : 'یک عدد معتبر وارد کن.';
          },
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(dialog),
          child: const Text('انصراف'),
        ),
        FilledButton(
          onPressed: () {
            if (!form.currentState!.validate()) return;
            store.addWeight(double.parse(latinDigits(controller.text)));
            Navigator.pop(dialog);
          },
          child: const Text('ثبت'),
        ),
      ],
    ),
  );
  controller.dispose();
}

class _WeightPainter extends CustomPainter {
  _WeightPainter(this.values);
  final List<double> values;
  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = const Color(0xFFE0E8D4)
      ..strokeWidth = 1;
    for (var i = 0; i < 4; i++) {
      final y = 15 + i * (size.height - 30) / 3;
      canvas.drawLine(Offset(0, y), Offset(size.width, y), p);
    }
    if (values.length < 2) return;
    final min = values.reduce(math.min) - .3,
        max = values.reduce(math.max) + .3;
    final points = List.generate(
      values.length,
      (i) => Offset(
        8 + (size.width - 16) * i / (values.length - 1),
        10 + (size.height - 20) * (1 - (values[i] - min) / (max - min)),
      ),
    );
    final path = Path()..moveTo(points.first.dx, points.first.dy);
    for (final o in points.skip(1)) {
      path.lineTo(o.dx, o.dy);
    }
    canvas.drawPath(
      path,
      p
        ..color = pine
        ..strokeWidth = 3
        ..style = PaintingStyle.stroke,
    );
    p.style = PaintingStyle.fill;
    for (final o in points) {
      canvas.drawCircle(o, 4, p);
    }
  }

  @override
  bool shouldRepaint(covariant _WeightPainter old) => true;
}

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context), expert = store.role == AppRole.expert;
    return Scaffold(
      appBar: AppBar(title: const Text('پروفایل من')),
      body: PageBody(
        children: [
          Surface(
            child: Column(
              children: [
                PersonAvatar(
                  expert ? store.experts.first.name : store.questionnaire.name,
                  size: 76,
                ),
                const SizedBox(height: 15),
                Text(
                  expert ? store.experts.first.name : store.questionnaire.name,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 8),
                Tag(
                  expert
                      ? 'کد نظام پزشکی: ${store.experts.first.medicalCode.isEmpty ? 'ثبت نشده' : store.experts.first.medicalCode}'
                      : store.questionnaireComplete
                      ? 'اطلاعات تکمیل شده'
                      : 'حساب نمایشی',
                ),
              ],
            ),
          ),
          Surface(
            padding: 12,
            child: Column(
              children: [
                MenuRow(
                  'اطلاعات فردی',
                  Icons.person_outline,
                  onTap: () => pushPage(context, const EditProfileScreen()),
                ),
                if (!expert)
                  MenuRow(
                    'کیف پول و تعرفه‌ها',
                    Icons.account_balance_wallet_outlined,
                    subtitle: '${formatTokenNumber(store.tokenBalance)} توکن',
                    onTap: () => openPlanServices(context),
                  ),
                if (!expert)
                  MenuRow(
                    'ویرایش پرسش‌نامه',
                    Icons.assignment_outlined,
                    onTap: () => pushPage(
                      context,
                      const QuestionnaireScreen(editing: true),
                    ),
                  ),
                if (!expert)
                  MenuRow(
                    'مشخصات دکتر',
                    Icons.medical_information_outlined,
                    onTap: () => pushPage(context, const DoctorDetailsScreen()),
                  ),
                if (!expert)
                  MenuRow(
                    'برنامه‌های قبلی',
                    Icons.history,
                    onTap: () => pushPage(context, const HistoryScreen()),
                  ),
                if (!expert)
                  MenuRow(
                    'ثبت نظر دربارهٔ برنامه',
                    Icons.rate_review_outlined,
                    onTap: () =>
                        pushPage(context, const ProgramReviewSubmitScreen()),
                  ),
                if (expert)
                  MenuRow(
                    'بانک غذا',
                    Icons.eco_outlined,
                    onTap: () => pushPage(context, const FoodsScreen()),
                  ),
                MenuRow(
                  'سفارش‌ها و پرداخت‌ها',
                  Icons.credit_card_outlined,
                  onTap: () => pushPage(context, const OrdersScreen()),
                ),
                if (!expert)
                  SwitchListTile(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 4),
                    title: const Text(
                      'اعلان‌های برنامه',
                      style: TextStyle(fontSize: 14),
                    ),
                    value: store.notificationsEnabled,
                    onChanged: (v) {
                      store.notificationsEnabled = v;
                      store.update();
                    },
                  ),
                if (!expert)
                  SwitchListTile(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 4),
                    title: const Text(
                      'یادآوری وعده‌ها',
                      style: TextStyle(fontSize: 14),
                    ),
                    subtitle: const Text(
                      'تنظیم نمایشی؛ اعلان زمان‌بندی نمی‌شود.',
                      style: TextStyle(fontSize: 10),
                    ),
                    value: store.mealReminders,
                    onChanged: (v) {
                      store.mealReminders = v;
                      store.update();
                    },
                  ),
                if (!expert)
                  MenuRow(
                    'پشتیبانی',
                    Icons.support_agent,
                    onTap: () =>
                        pushPage(context, const MessagesScreen(support: true)),
                  ),
                MenuRow(
                  'حریم خصوصی',
                  Icons.privacy_tip_outlined,
                  onTap: () => showDialog<void>(
                    context: context,
                    builder: (d) => AlertDialog(
                      title: const Text('حریم خصوصی نمونه'),
                      content: const Text(
                        'پاسخ‌های پرسش‌نامه روی همین دستگاه ذخیره می‌شوند تا دوباره قابل ویرایش باشند. داده‌های دیگر این نسخه نمایشی و موقت‌اند. ارتباطی با سرور برقرار نمی‌شود.',
                      ),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(d),
                          child: const Text('متوجه شدم'),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (!expert && store.hasUserRequest)
            Surface(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Heading('حالت‌های نمایشی'),
                  const Text(
                    'برای دیدن ظاهر وضعیت‌های مختلف، انتخاب کن.',
                    style: TextStyle(fontSize: 11, color: muted),
                  ),
                  const SizedBox(height: 15),
                  DropdownButtonFormField<PlanStatus>(
                    key: ValueKey(store.userRequest.status),
                    initialValue: store.userRequest.status,
                    isExpanded: true,
                    decoration: const InputDecoration(
                      labelText: 'وضعیت نمونهٔ درخواست',
                    ),
                    items: PlanStatus.values
                        .map(
                          (s) => DropdownMenuItem(
                            value: s,
                            child: Text(
                              s.label,
                              style: const TextStyle(fontSize: 12),
                            ),
                          ),
                        )
                        .toList(),
                    onChanged: (s) {
                      if (s != null) store.setDemoStatus(s);
                    },
                  ),
                ],
              ),
            ),
          OutlinedButton.icon(
            onPressed: () {
              store.logout();
              Navigator.of(context).popUntil((r) => r.isFirst);
            },
            icon: const Icon(Icons.switch_account_outlined),
            label: const Text('تعویض پنل نمایشی'),
          ),
        ],
      ),
    );
  }
}

class ProgramReviewSubmitScreen extends StatefulWidget {
  const ProgramReviewSubmitScreen({super.key});
  @override
  State<ProgramReviewSubmitScreen> createState() =>
      _ProgramReviewSubmitScreenState();
}

class _ProgramReviewSubmitScreenState extends State<ProgramReviewSubmitScreen> {
  final controller = TextEditingController();
  bool initialized = false;

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final pending = store.userPendingReview();
    if (!initialized) {
      controller.text = pending?.text ?? '';
      initialized = true;
    }
    return Scaffold(
      appBar: AppBar(title: const Text('نظر دربارهٔ برنامه')),
      body: PageBody(
        children: [
          const Notice(
            'نظر شما پس از بررسی مدیر در داشبورد سایر کاربران نمایش داده می‌شود.',
            icon: Icons.admin_panel_settings_outlined,
          ),
          if (pending != null) Tag('در انتظار تأیید مدیر', warning: true),
          TextField(
            controller: controller,
            minLines: 5,
            maxLines: 8,
            decoration: const InputDecoration(
              labelText: 'متن نظر',
              hintText: 'تجربه‌ات از برنامه، متخصص یا اپ را بنویس…',
            ),
          ),
          PrimaryButton(
            'ارسال برای تأیید مدیر',
            icon: Icons.send_outlined,
            onPressed: () {
              try {
                store.submitProgramReview(controller.text);
                showToast(context, 'نظر ثبت شد و برای مدیر ارسال شد.');
                Navigator.pop(context);
              } on StateError catch (e) {
                showToast(context, e.message);
              }
            },
          ),
        ],
      ),
    );
  }
}

class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key});
  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final controller = TextEditingController();
  bool initialized = false;
  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    if (store.role == AppRole.expert) return const ExpertProfileEditor();
    if (!initialized) {
      controller.text = store.role == AppRole.expert
          ? store.experts.first.name
          : store.questionnaire.name;
      initialized = true;
    }
    return Scaffold(
      appBar: AppBar(title: const Text('اطلاعات فردی')),
      body: PageBody(
        children: [
          TextField(
            controller: controller,
            decoration: const InputDecoration(labelText: 'نام و نام خانوادگی'),
          ),
          const TextField(
            readOnly: true,
            decoration: InputDecoration(
              labelText: 'شمارهٔ نمونه',
              hintText: '۰۹۱۲ ••• ••۴۲',
            ),
          ),
          PrimaryButton(
            'ثبت تغییرات',
            onPressed: () {
              if (controller.text.trim().isEmpty) {
                showToast(context, 'نام رو وارد کن.');
                return;
              }
              store.updateProfileName(controller.text.trim());
              Navigator.pop(context);
            },
            icon: Icons.check,
          ),
        ],
      ),
    );
  }
}
