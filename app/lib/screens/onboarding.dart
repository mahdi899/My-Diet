import 'package:flutter/material.dart';
import '../data/demo_store.dart';
import '../theme.dart';
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
    final items = user
        ? const [
            (
              Icons.assignment_outlined,
              'چند سؤال کوتاه',
              'بیشتر پاسخ‌ها انتخابی هستند.',
            ),
            (
              Icons.health_and_safety_outlined,
              'بررسی متخصص',
              'برنامه قبل از ارائه به تو بررسی می‌شه.',
            ),
            (
              Icons.edit_outlined,
              'قابل ویرایش در پروفایل',
              'هر وقت شرایطت عوض شد، جواب‌ها رو اصلاح کن.',
            ),
          ]
        : expert
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
        appBar: AppBar(
          title: const Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.spa_outlined, color: pine),
              SizedBox(width: 8),
              Text('رژیم من'),
            ],
          ),
          actions: [
            if (user)
              IconButton(
                tooltip: 'بازگشت به داشبورد',
                onPressed: store.cancelUserEntry,
                icon: const Icon(Icons.home_outlined),
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
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
            child: PrimaryButton(
              user
                  ? (store.questionnaireComplete
                        ? 'مرور پرسش‌نامه و ادامه'
                        : 'شروع پرسش‌نامه')
                  : 'ادامه به ورود',
              onPressed: user
                  ? () => setState(() => started = true)
                  : store.continueToLogin,
            ),
          ),
        ),
        body: PageBody(
          children: [
            Center(
              child: Tag(
                user
                    ? 'شروع یک مسیر مخصوص تو'
                    : 'آشنایی با پنل ${widget.role.label}',
              ),
            ),
            if (user)
              const Center(child: FoodArt(size: 180))
            else
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 40),
                child: Icon(
                  expert
                      ? Icons.health_and_safety_outlined
                      : Icons.admin_panel_settings_outlined,
                  size: 100,
                  color: pine,
                ),
              ),
            Text(
              user
                  ? 'قبل از شروع، کمی از خودت بگو'
                  : expert
                  ? 'همراه سلامت کاربران باش'
                  : 'همهٔ بخش‌ها، در یک نگاه',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            Text(
              user
                  ? 'با چند سؤال کوتاه، با هدف، سلیقه و سبک زندگی‌ات آشنا می‌شیم تا برنامه‌ات متناسب با خودت آماده بشه.'
                  : 'اول با امکانات این بخش آشنا شو؛ بعد از صفحهٔ ورود وارد پنل می‌شی.',
              textAlign: TextAlign.center,
              style: const TextStyle(color: muted, height: 2),
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
            if (user)
              Text(
                store.questionnaireComplete
                    ? 'پاسخ‌های قبلی آمادهٔ مرور و ویرایش هستند.'
                    : '۶ مرحلهٔ ساده · بدون نیاز به تایپ طولانی',
                textAlign: TextAlign.center,
                style: const TextStyle(color: muted, fontSize: 12),
              ),
          ],
        ),
      ),
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
        child: Icon(icon, color: pine, size: 21),
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
