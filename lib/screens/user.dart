import 'messaging.dart';
import 'weekly_feedback.dart';
import 'shopping.dart';
import '../widgets/meal_choices.dart';
import 'dart:math' as math;
import 'dart:async';
import '../data/day.dart';
import '../widgets/nutrition.dart';
import '../widgets/weekly_progress.dart';
import '../widgets/review_carousel.dart';
import 'package:flutter/material.dart';
import '../data/demo_store.dart';
import '../theme.dart';
import '../widgets/ui.dart';
import 'questionnaire.dart';
import 'shared.dart';
import 'doctor.dart';
import 'wallet_flow.dart';
import 'entry.dart';
import '../data/wallet_catalog.dart';

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
          title: Text(
            s.userSignedIn
                ? 'سلام ${s.questionnaire.name.split(' ').first} 🌿'
                : 'به سبزینه خوش اومدی 🌿',
          ),
          actions: [
            const Padding(
              padding: EdgeInsetsDirectional.only(end: 8),
              child: Center(child: WalletBalanceChip()),
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
        ),
        SliverToBoxAdapter(
          child: PageBody(
            scrollable: false,
            children: [
              EnergyCard(date: date),
              DailyAdviceCard(date: date),
              if (r != null && r.revisionRequested)
                RevisionConversationCard(request: r),
              if (r != null && !r.revisionRequested && r.question.isNotEmpty)
                RequestInformationCard(request: r),
              if (hasPlan) const WeeklyStreakCard(),
              if (s.hasActiveShoppingPlan)
                OutlinedButton.icon(
                  onPressed: () => pushPage(context, const ShoppingScreen()),
                  icon: const Icon(Icons.shopping_basket_outlined),
                  label: const Text('لیست خرید هفته'),
                ),
              if (hasPlan &&
                  !r!.revisionRequested &&
                  r.status != PlanStatus.ready)
                Surface(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Heading('وضعیت بررسی برنامه'),
                      PlanTimeline(status: r.status),
                    ],
                  ),
                ),
              if (hasPlan) ...[
                Heading(
                  'برنامهٔ امروز',

                  action: TextButton(
                    onPressed: widget.onPlan,
                    child: const Text('برنامهٔ کامل'),
                  ),
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
                            ? 'با انتخاب سرویس و پرداخت تومان، درخواست برنامه را ثبت کن.'
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
              else if (!r.revisionRequested)
                Surface(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Heading('وضعیت برنامه', subtitle: 'درخواست ${fa(r.id)}'),
                      const SizedBox(height: 14),
                      PlanTimeline(status: r.status),
                    ],
                  ),
                ),
              const WeightJourneyCard(),
              Surface(
                onTap: () =>
                    pushPage(context, const ChatScreen(threadId: 'user-main')),
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
                      onPressed: () => pushPage(
                        context,
                        const ChatScreen(threadId: 'user-main'),
                      ),
                      icon: const Icon(Icons.chat_bubble_outline, color: pine),
                    ),
                  ],
                ),
              ),
              ReviewCarousel(reviews: s.approvedReviewsForDashboard()),
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
    if (r.isPublished &&
        r.programWeek != null &&
        dateKey(r.programWeek!) != dateKey(startOfWeek(s.today))) {
      return Scaffold(
        appBar: AppBar(title: const Text('برنامهٔ غذایی من')),
        body: PageBody(
          children: [
            const WeeklyStreakCard(),
            EmptyPanel(
              'هفتهٔ این برنامه به پایان رسید',
              'برای این هفته برنامهٔ جدید دریافت کن.',
              icon: Icons.calendar_month_outlined,
              action: PrimaryButton(
                'دریافت برنامه جدید',
                onPressed: () {
                  s.selectedPlanServiceId = 'new-plan';
                  openPlanServices(context);
                },
              ),
            ),
          ],
        ),
      );
    }
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
          if (s.hasActiveShoppingPlan)
            IconButton(
              tooltip: 'لیست خرید هفته',
              onPressed: () => pushPage(context, const ShoppingScreen()),
              icon: const Icon(Icons.shopping_basket_outlined),
            ),
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
                onPressed: r.canApproveInformation
                    ? () {
                        s.approve(r.id);
                        showToast(
                          context,
                          'برنامهٔ هفتگی نمونه نمایش داده شد.',
                        );
                      }
                    : null,
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

Future<void> showRevision(BuildContext context) => showPlanChange(context);

class PlanSummaryScreen extends StatelessWidget {
  const PlanSummaryScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    if (!store.hasUserRequest || !store.userRequest.isPublished) {
      return Scaffold(
        appBar: AppBar(title: const Text('برنامه هفتگی')),
        body: const Center(child: Text('برنامه تأییدشده‌ای موجود نیست.')),
      );
    }
    final request = store.userRequest, start = store.userRequest.programWeek!;
    return Scaffold(
      appBar: AppBar(title: const Text('برنامهٔ هفت روز')),
      body: PageBody(
        children: [
          Heading('برنامهٔ ${request.name}', subtitle: request.specialist),
          const Notice(
            'نمایش نمونهٔ طراحی؛ انتخاب‌ها و اطلاعات مصرف محلی هستند.',
          ),
          for (var day = 0; day < 7; day++)
            Surface(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    persianDate(start.add(Duration(days: day))),
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  if (store.mealsOn(start.add(Duration(days: day))).isEmpty)
                    const Text('برنامه‌ای موجود نیست'),
                  for (
                    var index = 0;
                    index <
                        store.mealsOn(start.add(Duration(days: day))).length;
                    index++
                  )
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(
                        store
                            .mealsOn(start.add(Duration(days: day)))[index]
                            .title,
                      ),
                      subtitle: Text(
                        store
                            .mealsOn(start.add(Duration(days: day)))[index]
                            .name,
                      ),
                      trailing: IconButton(
                        tooltip: 'جزئیات و جایگزینی غذا',
                        icon: const Icon(Icons.swap_horiz, color: pine),
                        onPressed: () => showMealOptions(
                          context,
                          start.add(Duration(days: day)),
                          index,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          PrimaryButton(
            'لیست خرید هفته',
            onPressed: () => pushPage(context, const ShoppingScreen()),
            icon: Icons.shopping_basket_outlined,
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
    final s = DemoScope.of(context), dates = s.weightEntryDates;
    final delta = s.weightEntries.isEmpty
        ? 0.0
        : s.latestWeight - s.weightEntries.first;
    final week = s.hasUserRequest
        ? (s.userRequest.programWeek ?? startOfWeek(s.today))
        : startOfWeek(s.today);
    return Scaffold(
      appBar: AppBar(title: const Text('پیگیری من')),
      body: PageBody(
        children: [
          Surface(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Heading('درصد تکمیل برنامهٔ روزانه'),
                const SizedBox(height: 16),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: List.generate(7, (i) {
                    final date = DateTime(week.year, week.month, week.day + i),
                        total = s.mealsOn(date).length;
                    final prescribed = s.scheduledWeekDates.any(
                      (d) => dateKey(d) == dateKey(date),
                    );
                    final percent = !prescribed || total == 0
                        ? 0
                        : s.eatenCount(date) * 100 / total;
                    return Expanded(
                      child: Tooltip(
                        message:
                            '${persianDate(date)} · ${fa(s.eatenCount(date))} از ${fa(total)} وعده',
                        child: Column(
                          children: [
                            Text(
                              prescribed ? '${fa(percent.round())}٪' : '—',
                              style: const TextStyle(
                                color: pine,
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 8),
                            SizedBox(
                              height: 120,
                              child: Align(
                                alignment: Alignment.bottomCenter,
                                child: FractionallySizedBox(
                                  heightFactor: percent == 0
                                      ? 0.025
                                      : percent / 100,
                                  child: Container(
                                    width: 22,
                                    decoration: BoxDecoration(
                                      color: prescribed ? pine : sage,
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(height: 10),
                            Text(
                              persianWeekDays[i],
                              style: const TextStyle(fontSize: 9),
                            ),
                          ],
                        ),
                      ),
                    );
                  }),
                ),
                const SizedBox(height: 12),
                const Text(
                  'بر اساس وعده‌هایی که «خوردم» زده‌ای؛ خط تیره یعنی آن روز برنامه‌ای نداشتی.',
                  style: TextStyle(fontSize: 10, color: muted),
                ),
              ],
            ),
          ),
          Surface(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Heading(
                  'روند تغییر وزن',
                  subtitle: 'آخرین وزن: ${decimalFa(s.latestWeight)} کیلوگرم',
                ),
                const SizedBox(height: 8),
                Text(
                  '${delta > 0 ? '+' : ''}${decimalFa(delta)} کیلوگرم نسبت به اولین اندازه‌گیری',
                  style: const TextStyle(color: pine),
                ),
                const SizedBox(height: 18),
                SizedBox(
                  height: 210,
                  child: CustomPaint(
                    painter: _WeightPainter(s.weightEntries, dates),
                  ),
                ),
                const SizedBox(height: 14),
                OutlinedButton.icon(
                  onPressed: () => showWeight(context),
                  icon: const Icon(Icons.monitor_weight_outlined),
                  label: const Text('تغییر وزن'),
                ),
                const SizedBox(height: 12),
                for (var i = s.weightEntries.length - 1; i >= 0; i--)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 7),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            persianDate(dates[i]),
                            style: const TextStyle(fontSize: 11, color: muted),
                          ),
                        ),
                        Text(
                          '${decimalFa(s.weightEntries[i])} کیلوگرم',
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ),
                const Text(
                  'مقادیر اولیه نمونه‌اند؛ هر تغییر وزن با تاریخ امروز ثبت می‌شود.',
                  style: TextStyle(fontSize: 10, color: muted),
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
  final dialogRoute = DialogRoute<void>(
    context: context,
    builder: (dialog) => AlertDialog(
      title: const Text('تغییر وزن'),
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
  await Navigator.of(context).push<void>(dialogRoute);
  await dialogRoute.completed;
  controller.dispose();
}

class _WeightPainter extends CustomPainter {
  _WeightPainter(this.values, this.dates);
  final List<double> values;
  final List<DateTime> dates;
  void label(Canvas canvas, String text, Offset offset, {Color color = muted}) {
    final t = TextPainter(
      text: TextSpan(
        text: text,
        style: TextStyle(color: color, fontSize: 10, fontFamily: 'Vazirmatn'),
      ),
      textDirection: TextDirection.rtl,
    )..layout();
    t.paint(canvas, offset);
  }

  @override
  void paint(Canvas canvas, Size size) {
    if (values.isEmpty) return;
    final low = (values.reduce(math.min) * 2).floor() / 2 - .5,
        high = (values.reduce(math.max) * 2).ceil() / 2 + .5;
    const left = 42.0, right = 20.0, top = 20.0, bottom = 32.0;
    final width = size.width - left - right,
        height = size.height - top - bottom;
    final grid = Paint()
      ..color = sage
      ..strokeWidth = 1;
    for (var i = 0; i <= 4; i++) {
      final y = top + height * i / 4;
      canvas.drawLine(Offset(left, y), Offset(size.width - right, y), grid);
      label(canvas, decimalFa(high - (high - low) * i / 4), Offset(0, y - 8));
    }
    final span = dates.last.difference(dates.first).inMinutes;
    final points = List.generate(
      values.length,
      (i) => Offset(
        left +
            (span == 0
                    ? 0.5
                    : dates[i].difference(dates.first).inMinutes / span) *
                width,
        top + (high - values[i]) / (high - low) * height,
      ),
    );
    final path = Path()..moveTo(points.first.dx, points.first.dy);
    for (final point in points.skip(1)) {
      path.lineTo(point.dx, point.dy);
    }
    if (points.length > 1) {
      final fill = Path.from(path)
        ..lineTo(points.last.dx, top + height)
        ..lineTo(points.first.dx, top + height)
        ..close();
      canvas.drawPath(
        fill,
        Paint()
          ..shader = LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [pine.withValues(alpha: .18), pine.withValues(alpha: 0)],
          ).createShader(Rect.fromLTWH(left, top, width, height)),
      );
    }
    canvas.drawPath(
      path,
      Paint()
        ..color = pine
        ..strokeWidth = 2.5
        ..style = PaintingStyle.stroke,
    );
    for (final point in points) {
      canvas.drawCircle(point, 4, Paint()..color = Colors.white);
      canvas.drawCircle(point, 2.8, Paint()..color = pine);
    }
    label(
      canvas,
      '${decimalFa(values.last)} کیلو',
      Offset(
        (points.last.dx - 45).clamp(left, size.width - 75),
        points.last.dy - 22,
      ),
      color: pine,
    );
    final first = jalali(dates.first), last = jalali(dates.last);
    label(
      canvas,
      '${fa(first.$2)}/${fa(first.$3)}',
      Offset(left, top + height + 10),
    );
    label(
      canvas,
      '${fa(last.$2)}/${fa(last.$3)}',
      Offset(size.width - 55, top + height + 10),
    );
  }

  @override
  bool shouldRepaint(covariant _WeightPainter old) => true;
}

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context), expert = store.role == AppRole.expert;
    if (!expert && !store.userSignedIn) return const CustomerSignInPrompt();
    return Scaffold(
      appBar: AppBar(title: const Text('پروفایل من')),
      body: PageBody(
        children: [
          Surface(
            child: Column(
              children: [
                PersonAvatar(
                  expert
                      ? store.experts.first.name
                      : store.userSignedIn
                      ? store.questionnaire.name
                      : 'کاربر مهمان',
                  size: 76,
                ),
                const SizedBox(height: 15),
                Text(
                  expert
                      ? store.experts.first.name
                      : store.userSignedIn
                      ? store.questionnaire.name
                      : 'کاربر مهمان',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 8),
                Tag(
                  expert
                      ? 'کد نظام پزشکی: ${store.experts.first.medicalCode.isEmpty ? 'ثبت نشده' : store.experts.first.medicalCode}'
                      : !store.userSignedIn
                      ? 'بدون ورود'
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
                  onTap: () => pushPage(
                    context,
                    expert
                        ? const EditProfileScreen()
                        : const QuestionnaireScreen(editing: true),
                  ),
                ),
                if (!expert)
                  MenuRow(
                    'کیف پول و تعرفه‌ها',
                    Icons.account_balance_wallet_outlined,
                    subtitle: '${formatMoneyNumber(store.walletBalance)} تومان',
                    onTap: () => openPlanServices(context),
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
                    'سفارش‌ها و پرداخت‌ها',
                    Icons.credit_card_outlined,
                    onTap: () => pushPage(context, const OrdersScreen()),
                  ),
              ],
            ),
          ),
          Surface(
            padding: 12,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Padding(
                  padding: EdgeInsets.all(8),
                  child: Heading('درباره برنامه'),
                ),
                if (!expert)
                  MenuRow(
                    'ثبت نظر دربارهٔ برنامه',
                    Icons.rate_review_outlined,
                    onTap: () =>
                        pushPage(context, const ProgramReviewSubmitScreen()),
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
          if (!expert && store.userSignedIn)
            OutlinedButton.icon(
              onPressed: () async {
                try {
                  await store.signOutCustomer();
                } catch (error) {
                  if (context.mounted) showToast(context, error.toString());
                }
              },
              icon: const Icon(Icons.logout),
              label: const Text('خروج از حساب'),
            ),
        ],
      ),
    );
  }
}

class ProgramReviewSubmitScreen extends StatelessWidget {
  const ProgramReviewSubmitScreen({super.key});
  @override
  Widget build(BuildContext context) => const WeeklyFeedbackScreen();
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
              labelText: 'شماره تلفن',
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
