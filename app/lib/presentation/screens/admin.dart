import 'package:flutter/material.dart';
import '../../data/demo_store.dart';
import '../../core/theme/theme.dart';
import '../widgets/ui.dart';
import 'shared.dart';
import 'question_admin.dart';
import 'doctor.dart';
import 'pricing_admin.dart';
import '../../data/wallet_catalog.dart';

class AdminHome extends StatelessWidget {
  const AdminHome({super.key});
  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('مدیریت رژیم من')),
      body: PageBody(
        children: [
          const ClinicianPerformanceCard(),
          Surface(
            child: MenuRow(
              'قیمت‌ها و جایزهٔ هفتگی',
              Icons.account_balance_wallet_outlined,
              subtitle:
                  'برنامه ${formatToman(store.newPlanPrice)} · جایزه ${formatToman(store.weeklyRewardToman)}',
              onTap: () => pushPage(context, const PricingAdminScreen()),
            ),
          ),
          Surface(
            color: sage,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Icon(Icons.quiz_outlined, color: pine, size: 30),
                const SizedBox(height: 10),
                const Heading(
                  'مدیریت پرسش‌نامه',
                  subtitle:
                      'متن سؤال‌ها، گزینه‌ها و سؤال‌های تکمیلی را مدیریت کن.',
                ),
                const SizedBox(height: 12),
                Text(
                  '${fa(store.formConfiguration.questions.length)} سؤال در ${fa(store.formConfiguration.sections.length)} مرحله',
                  style: const TextStyle(color: muted, fontSize: 12),
                ),
                const SizedBox(height: 14),
                PrimaryButton(
                  'ویرایش سؤال‌ها',
                  onPressed: () =>
                      pushPage(context, const QuestionAdminScreen()),
                  icon: Icons.edit_note_outlined,
                ),
              ],
            ),
          ),
          MetricGrid(
            items: [
              Metric(
                'کاربران نمونه',
                fa(store.requests.map((r) => r.name).toSet().length),
                Icons.people_outline,
              ),
              Metric('پزشک برنامه', '۱', Icons.health_and_safety_outlined),
              Metric(
                'درخواست باز',
                fa(
                  store.requests
                      .where((r) => r.status != PlanStatus.ready)
                      .length,
                ),
                Icons.assignment_outlined,
              ),
              Metric(
                'برنامه تأییدشده',
                fa(store.requests.where((r) => r.isPublished).length),
                Icons.task_alt,
              ),
            ],
          ),
          Surface(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Heading(
                  'روند درخواست‌ها',
                  subtitle: 'نمودار نمونهٔ هفتهٔ اخیر',
                ),
                const SizedBox(height: 20),
                SizedBox(
                  height: 150,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: List.generate(
                      7,
                      (i) => Expanded(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 5),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              Container(
                                height: [
                                  52,
                                  80,
                                  62,
                                  105,
                                  74,
                                  95,
                                  118,
                                ][i].toDouble(),
                                decoration: BoxDecoration(
                                  color: i == 6
                                      ? pine
                                      : const Color(0xFFBED39E),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                              ),
                              const SizedBox(height: 7),
                              Text(
                                ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'][i],
                                style: const TextStyle(
                                  color: muted,
                                  fontSize: 11,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Heading(
            'آخرین پیام‌های پشتیبانی',
            subtitle: 'پیام‌های دریافت‌شده از کاربران',
            action: TextButton(
              onPressed: () => pushPage(context, const SupportScreen()),
              child: const Text('همهٔ گفتگوها'),
            ),
          ),
          if (store.receivedThreads(AppRole.admin, support: true).isEmpty)
            const EmptyPanel(
              'پیامی دریافت نشده',
              'پیام‌های کاربران برای پشتیبانی اینجا نمایش داده می‌شوند.',
              icon: Icons.support_agent,
            ),
          for (final thread
              in store.receivedThreads(AppRole.admin, support: true).take(5))
            ConversationTile(thread: thread, receivedOnly: true),
        ],
      ),
    );
  }
}

class AdminRequestsScreen extends StatefulWidget {
  const AdminRequestsScreen({super.key, this.standalone = false});
  final bool standalone;
  @override
  State<AdminRequestsScreen> createState() => _AdminRequestsScreenState();
}

class _AdminRequestsScreenState extends State<AdminRequestsScreen> {
  String query = '', filter = 'همه';
  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final rows = store.requests
        .where(
          (r) =>
              (r.name.contains(query) ||
                  fa(r.id).contains(query) ||
                  r.id.contains(query)) &&
              switch (filter) {
                'باز' => r.status != PlanStatus.ready,
                'تأییدشده' => r.status == PlanStatus.ready,
                _ => true,
              },
        )
        .toList();
    return Scaffold(
      appBar: AppBar(
        title: const Text('درخواست‌ها و برنامه‌ها'),
        automaticallyImplyLeading: widget.standalone,
      ),
      body: PageBody(
        children: [
          SearchField(
            onChanged: (v) => setState(() => query = v),
            hint: 'نام کاربر یا شمارهٔ درخواست',
          ),
          Filters(
            values: const ['همه', 'باز', 'تأییدشده'],
            selected: filter,
            onSelected: (v) => setState(() => filter = v),
          ),
          ...rows.map(
            (r) => RequestTile(r, onTap: () => requestDetails(context, r)),
          ),
          if (rows.isEmpty)
            const EmptyPanel(
              'درخواستی پیدا نشد',
              'جست‌وجو یا فیلتر را تغییر بده.',
              icon: Icons.search,
            ),
        ],
      ),
    );
  }
}

Future<void> requestDetails(BuildContext context, DietRequest r) async {
  await showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (_) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Heading('درخواست ${fa(r.id)}', subtitle: r.name),
            const SizedBox(height: 15),
            InfoRows({
              'هدف': r.goal,
              'وضعیت': r.status.label,
              'پزشک': DemoScope.of(context).experts.first.name,
            }),
            const SizedBox(height: 16),
            const Notice(
              'تمام درخواست‌ها برای پزشک رژیم من ارسال می‌شوند؛ تأیید برنامه در پنل پزشک انجام می‌شود.',
            ),
          ],
        ),
      ),
    ),
  );
}

class PeopleScreen extends StatefulWidget {
  const PeopleScreen({super.key, this.standalone = false});
  final bool standalone;
  @override
  State<PeopleScreen> createState() => _PeopleScreenState();
}

class _PeopleScreenState extends State<PeopleScreen> {
  String query = '';
  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final users = <String, DietRequest>{};
    for (final r in store.requests) {
      users.putIfAbsent(r.name, () => r);
    }
    final rows = users.values.where((r) => r.name.contains(query)).toList();
    return Scaffold(
      appBar: AppBar(
        title: const Text('کاربران'),
        automaticallyImplyLeading: widget.standalone,
      ),
      body: PageBody(
        children: [
          SearchField(
            onChanged: (v) => setState(() => query = v),
            hint: 'جست‌وجوی کاربر',
          ),
          for (final r in rows)
            Surface(
              onTap: () => requestDetails(context, r),
              child: Row(
                children: [
                  PersonAvatar(r.name),
                  const SizedBox(width: 12),
                  Expanded(child: Text(r.name)),
                  const Icon(Icons.chevron_left, color: muted),
                ],
              ),
            ),
          if (rows.isEmpty)
            const EmptyPanel(
              'کاربری پیدا نشد',
              'نام دیگری را جست‌وجو کن.',
              icon: Icons.search,
            ),
        ],
      ),
    );
  }
}

class ClinicianPerformanceCard extends StatelessWidget {
  const ClinicianPerformanceCard({super.key});
  @override
  Widget build(BuildContext context) {
    final s = DemoScope.of(context),
        total = s.clinicianFeedback.length,
        positives = s.positiveFeedbackCount;
    return Surface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Heading(
            'عملکرد پزشک رژیم من',
            subtitle:
                'بر اساس همهٔ بازخوردهای ثبت‌شده؛ مستقل از تأیید نمایش عمومی',
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              PersonAvatar(s.experts.first.name),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  s.experts.first.name,
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
              ),
              TextButton(
                onPressed: () => pushPage(context, const ExpertProfileEditor()),
                child: const Text('مشخصات'),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 10,
            runSpacing: 8,
            children: [
              Tag(
                'امتیاز ${s.clinicianRating.toStringAsFixed(1).replaceAllMapped(RegExp(r"\d"), (m) => fa(m[0]!))} از ۵',
              ),
              Tag(
                '${fa(total == 0 ? 0 : (positives * 100 / total).round())}٪ رضایت مثبت',
              ),
              Tag('${fa(total)} بازخورد'),
            ],
          ),
          const SizedBox(height: 12),
          LinearProgressIndicator(
            value: total == 0 ? 0 : positives / total,
            minHeight: 7,
            borderRadius: BorderRadius.circular(7),
          ),
          const SizedBox(height: 8),
          Text(
            '${fa(positives)} نظر با امتیاز ۴ یا ۵ · یک پزشک در مجموعه',
            style: const TextStyle(fontSize: 11, color: muted),
          ),
        ],
      ),
    );
  }
}

class AdminMoreScreen extends StatelessWidget {
  const AdminMoreScreen({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('بخش‌های مدیریت')),
    body: PageBody(
      children: [
        Surface(
          padding: 12,
          child: Column(
            children: [
              MenuRow(
                'تأیید نظرات کاربران',
                Icons.rate_review_outlined,
                onTap: () =>
                    pushPage(context, const ProgramReviewsModerationScreen()),
              ),
              MenuRow(
                'قیمت‌ها و جایزهٔ هفتگی',
                Icons.payments_outlined,
                onTap: () => pushPage(context, const PricingAdminScreen()),
              ),
              MenuRow(
                'مشخصات پزشک',
                Icons.medical_information_outlined,
                onTap: () => pushPage(context, const ExpertProfileEditor()),
              ),
              MenuRow(
                'مدیریت پرسش‌نامه',
                Icons.quiz_outlined,
                onTap: () => pushPage(context, const QuestionAdminScreen()),
              ),
              MenuRow(
                'سفارش‌ها و پرداخت‌ها',
                Icons.payments_outlined,
                onTap: () => pushPage(context, const PaymentsScreen()),
              ),
              MenuRow(
                'پشتیبانی',
                Icons.support_agent,
                onTap: () => pushPage(context, const SupportScreen()),
              ),
            ],
          ),
        ),
        const Notice(
          'مدیریت این نسخه کاملاً نمایشی و داخل حافظه است؛ اطلاعات واقعی کاربران وجود ندارد.',
        ),
        OutlinedButton.icon(
          onPressed: () => DemoScope.of(context).showRoleSelection(),
          icon: const Icon(Icons.switch_account_outlined),
          label: const Text('تعویض پنل نمایشی'),
        ),
      ],
    ),
  );
}

class ProgramReviewsModerationScreen extends StatelessWidget {
  const ProgramReviewsModerationScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final pending = store.pendingProgramReviews();
    return Scaffold(
      appBar: AppBar(title: const Text('تأیید نظرات')),
      body: PageBody(
        children: [
          const Notice(
            'نظرات پس از تأیید در داشبورد سایر کاربران نمایش داده می‌شوند.',
            icon: Icons.visibility_outlined,
          ),
          if (pending.isEmpty)
            const EmptyPanel(
              'نظر در انتظار تأیید نیست',
              'وقتی کاربری نظر جدید ثبت کند، اینجا دیده می‌شود.',
              icon: Icons.rate_review_outlined,
            ),
          for (final review in pending)
            Surface(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Heading(
                    review.authorName,
                    subtitle:
                        'امتیاز ${fa(review.rating)} از ۵ · ${review.weekKey.isEmpty ? 'نظر نمونه' : 'بازخورد هفتگی'}',
                  ),
                  const SizedBox(height: 10),
                  Text(
                    review.text,
                    style: const TextStyle(height: 1.8, fontSize: 13),
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () {
                            store.rejectProgramReview(review.id);
                            showToast(
                              context,
                              'نمایش عمومی نظر رد شد؛ بازخورد در آمار عملکرد باقی ماند.',
                            );
                          },
                          child: const Text('رد'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: FilledButton(
                          onPressed: () {
                            store.approveProgramReview(review.id);
                            showToast(
                              context,
                              'نظر برای نمایش عمومی تأیید شد.',
                            );
                          },
                          child: const Text('تأیید نمایش'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class PaymentsScreen extends StatelessWidget {
  const PaymentsScreen({super.key});
  @override
  Widget build(BuildContext context) => const OrdersScreen();
}

class SupportScreen extends StatelessWidget {
  const SupportScreen({super.key});
  @override
  Widget build(BuildContext context) => const MessagesScreen(support: true);
}

class TicketScreen extends StatefulWidget {
  const TicketScreen({super.key, required this.ticket});
  final Map<String, String> ticket;
  @override
  State<TicketScreen> createState() => _TicketScreenState();
}

class _TicketScreenState extends State<TicketScreen> {
  late final text = TextEditingController(text: widget.ticket['reply']);
  late String status = widget.ticket['status']!;
  @override
  void dispose() {
    text.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('رسیدگی به درخواست')),
      body: PageBody(
        children: [
          Heading(
            widget.ticket['title']!,
            subtitle: 'از ${widget.ticket['name']}',
          ),
          const Notice(
            'سلام، برای این مورد به راهنمایی نیاز دارم.',
            icon: Icons.chat_bubble_outline,
          ),
          TextField(
            controller: text,
            maxLines: 5,
            decoration: const InputDecoration(labelText: 'پاسخ پشتیبانی'),
          ),
          DropdownButtonFormField<String>(
            initialValue: status,
            decoration: const InputDecoration(labelText: 'وضعیت'),
            items: [
              'باز',
              'در حال رسیدگی',
              'حل‌شده',
            ].map((s) => DropdownMenuItem(value: s, child: Text(s))).toList(),
            onChanged: (v) => status = v!,
          ),
          PrimaryButton(
            'ذخیرهٔ پاسخ',
            onPressed: () {
              if (text.text.trim().isEmpty) {
                showToast(context, 'پاسخ رو بنویس.');
                return;
              }
              widget.ticket['reply'] = text.text.trim();
              widget.ticket['status'] = status;
              store.update();
              Navigator.pop(context);
            },
            icon: Icons.check,
          ),
        ],
      ),
    );
  }
}

class AdminSettingsScreen extends StatelessWidget {
  const AdminSettingsScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('تنظیمات و دسترسی‌ها')),
      body: PageBody(
        children: [
          Surface(
            child: Column(
              children: [
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text(
                    'اعلان درخواست‌های جدید',
                    style: TextStyle(fontSize: 14),
                  ),
                  value: store.notificationsEnabled,
                  onChanged: (v) {
                    store.notificationsEnabled = v;
                    store.update();
                  },
                ),
                const Divider(),
                const InfoRows({
                  'زمان هدف رسیدگی': 'یک روز کاری · نمونه',
                  'نسخهٔ برنامه': '۱٫۰٫۰',
                }),
              ],
            ),
          ),
          const Heading('نقش‌های مجموعه'),
          ...[
            ('مدیر مجموعه', 'مدیریت سرویس و بازخورد کاربران'),
            ('متخصص', 'بررسی و تأیید همهٔ درخواست‌ها'),
            ('پشتیبان', 'رسیدگی به حساب و سفارش'),
            ('مسئول فنی', 'بررسی خطاها و وضعیت پردازش'),
          ].map((r) => Surface(child: Heading(r.$1, subtitle: r.$2))),
          const Notice(
            'نقش‌ها در این نسخه برای جابه‌جایی بین صفحه‌ها هستند؛ احراز هویت و محدودیت دسترسی واقعی پیاده‌سازی نشده است.',
          ),
        ],
      ),
    );
  }
}
