import 'package:flutter/material.dart';
import '../onboarding/widgets/onboarding_icons.dart';
import '../../data/demo_store.dart';
import '../../core/motion/motion_kit.dart';
import '../../core/theme/theme.dart';
import '../onboarding/widgets/decor_photo.dart';
import '../widgets/kit/pill_button.dart';
import '../widgets/ui.dart';
import 'questionnaire.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key, required this.role});
  final AppRole role;

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  QuestionnaireData? draft;
  bool started = false;
  int _page = 0;
  final _pages = PageController();

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final store = DemoScope.of(context);
    draft ??= (store.questionnaireComplete || store.questionnaireNeedsReview)
        ? store.questionnaire.copy()
        : QuestionnaireData.empty();
  }

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final user = widget.role == AppRole.user;
    final expert = widget.role == AppRole.expert;
    if (user && started) {
      return QuestionnaireScreen(
        onboarding: true,
        editing: store.questionnaireComplete || store.questionnaireNeedsReview,
        initialData: draft!,
        onExit: () => setState(() => started = false),
        onSaved: store.completeUserOnboarding,
      );
    }
    final label = user
        ? (store.questionnaireComplete
              ? 'مرور پرسش‌نامه و ادامه'
              : 'شروع پرسش‌نامه')
        : 'ادامه به ورود';
    return PopScope<void>(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) {
          if (user) {
            store.cancelUserEntry();
          } else {
            store.showRoleSelection();
          }
        }
      },
      child: Scaffold(
        backgroundColor: AppColors.bg,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          title: const Text('رژیم من'),
          actions: [
            if (user)
              IconButton(
                tooltip: 'بازگشت به داشبورد',
                onPressed: store.cancelUserEntry,
                icon: const OnboardingIcon(Icons.home_outlined),
              )
            else
              TextButton(
                onPressed: store.showRoleSelection,
                child: const Text('تغییر نقش'),
              ),
          ],
        ),
        bottomNavigationBar: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
            child: PillButton(
              label: label,
              onPressed: user
                  ? () => setState(() => started = true)
                  : store.continueToLogin,
            ),
          ),
        ),
        body: DecoratedBox(
          decoration: const BoxDecoration(
            gradient: AppGradients.warmBackground,
          ),
          child: user
              ? _IntroPages(
                  controller: _pages,
                  page: _page,
                  onPage: (i) => setState(() => _page = i),
                  ready: store.questionnaireComplete,
                )
              : _StaffIntro(expert: expert, items: _staffItems(expert)),
        ),
      ),
    );
  }
}

const _intro = <(String, String)>[
  ('غذا، برای تو', 'برنامه‌ای روشن، با عکس و قدم‌های کوچک.'),
  ('چند سؤال کوتاه', 'بیشتر جواب‌ها یک لمس است.'),
  ('بعدش برنامه را می‌بینی', 'متخصص هم یک‌بار نگاه می‌کند.'),
];

class _IntroPages extends StatelessWidget {
  const _IntroPages({
    required this.controller,
    required this.page,
    required this.onPage,
    required this.ready,
  });
  final PageController controller;
  final int page;
  final ValueChanged<int> onPage;
  final bool ready;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: PageView(
            controller: controller,
            onPageChanged: onPage,
            children: [
              for (var i = 0; i < _intro.length; i++)
                _IntroPage(index: i, title: _intro[i].$1, body: _intro[i].$2),
            ],
          ),
        ),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            for (var i = 0; i < _intro.length; i++)
              AnimatedContainer(
                duration: Motion.of(context, Motion.quick),
                margin: const EdgeInsets.symmetric(horizontal: 4),
                width: i == page ? 22 : 8,
                height: 8,
                decoration: BoxDecoration(
                  color: i == page ? AppColors.emerald : AppColors.line,
                  borderRadius: BorderRadius.circular(99),
                ),
              ),
          ],
        ),
        const SizedBox(height: 8),
        Text(
          ready ? 'پاسخ‌های قبلی آماده‌اند.' : 'شش قدم کوتاه',
          style: const TextStyle(color: AppColors.muted, fontSize: 12),
        ),
        const SizedBox(height: 8),
      ],
    );
  }
}

class _IntroPage extends StatelessWidget {
  const _IntroPage({
    required this.index,
    required this.title,
    required this.body,
  });
  final int index;
  final String title, body;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        return SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(28, 8, 28, 12),
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: constraints.maxHeight - 20),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (index == 0)
                  const PhotoCollage()
                else
                  DecorPhoto(
                    label: index == 1 ? 'پیاده‌روی' : 'متخصص تغذیه',
                    lifestyle: index == 1,
                    expert: index == 2,
                    symbol: index == 1 ? DietIconKind.plan : DietIconKind.coach,
                    width: 180,
                    height: 180,
                    radius: 32,
                    icon: index == 1
                        ? Icons.favorite_rounded
                        : Icons.health_and_safety_outlined,
                  ),
                const SizedBox(height: 22),
                Text(
                  title,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                const SizedBox(height: 8),
                Text(
                  body,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: AppColors.muted,
                    height: 1.7,
                    fontSize: 15,
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

List<(IconData, String, String)> _staffItems(bool expert) => expert
    ? const [
        (
          Icons.assignment_outlined,
          'صف درخواست‌ها',
          'پرونده‌های منتظر بررسی رو یک‌جا ببین.',
        ),
        (
          Icons.edit_note,
          'بررسی و اصلاح برنامه',
          'پیش‌نویس رو بررسی کن و نسخهٔ نهایی رو تأیید کن.',
        ),
        (
          Icons.chat_bubble_outline,
          'همراهی با کاربر',
          'به سؤال‌ها و درخواست‌های اصلاح پاسخ بده.',
        ),
      ]
    : const [
        (
          Icons.people_outline,
          'مدیریت مجموعه',
          'کاربران و اطلاعات پزشک رو مدیریت کن.',
        ),
        (
          Icons.assignment_outlined,
          'پیگیری درخواست‌ها',
          'وضعیت برنامه‌ها و عملکرد پزشک رو ببین.',
        ),
        (
          Icons.support_agent,
          'رسیدگی و پشتیبانی',
          'درخواست‌های پشتیبانی و بخش‌های مجموعه در دسترس‌اند.',
        ),
      ];

class _StaffIntro extends StatelessWidget {
  const _StaffIntro({required this.expert, required this.items});
  final bool expert;
  final List<(IconData, String, String)> items;

  @override
  Widget build(BuildContext context) {
    return PageBody(
      children: [
        Center(child: Tag('آشنایی با پنل')),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 28),
          child: OnboardingIcon(
            expert
                ? Icons.health_and_safety_outlined
                : Icons.admin_panel_settings_outlined,
            size: 88,
            color: pine,
          ),
        ),
        Text(
          expert ? 'همراه سلامت کاربران باش' : 'همهٔ بخش‌ها، در یک نگاه',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        const Text(
          'اول با امکانات این بخش آشنا شو؛ بعد از صفحهٔ ورود وارد پنل می‌شی.',
          textAlign: TextAlign.center,
          style: TextStyle(color: muted, height: 1.8),
        ),
        Surface(
          child: Column(
            children: [
              for (var i = 0; i < items.length; i++) ...[
                if (i > 0) const SizedBox(height: 18),
                _JourneyItem(items[i].$1, items[i].$2, items[i].$3),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _JourneyItem extends StatelessWidget {
  const _JourneyItem(this.icon, this.title, this.subtitle);
  final IconData icon;
  final String title, subtitle;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      CircleAvatar(
        backgroundColor: sage,
        child: OnboardingIcon(icon, color: pine, size: 21),
      ),
      const SizedBox(width: 12),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
            Text(subtitle, style: const TextStyle(color: muted, fontSize: 11)),
          ],
        ),
      ),
    ],
  );
}
