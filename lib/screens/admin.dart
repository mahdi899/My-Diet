import 'package:flutter/material.dart';
import '../data/demo_store.dart';
import '../theme.dart';
import '../widgets/ui.dart';
import 'shared.dart';
import 'question_admin.dart';

class AdminHome extends StatelessWidget {
  const AdminHome({super.key});
  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('مدیریت سبزینه')),
      body: PageBody(
        children: [
          const Heading(
            'نمای کلی مجموعه',
            subtitle: 'آمار و اطلاعات این نسخه نمونه هستند.',
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
              Metric(
                'متخصصان',
                fa(store.experts.length),
                Icons.health_and_safety_outlined,
              ),
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
  final store = DemoScope.of(context);
  String selected = r.specialist;
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (sheet) => SafeArea(
      child: SingleChildScrollView(
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
              'متخصص': r.specialist,
              'زمان انتظار': r.wait,
            }),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              initialValue: selected,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'تخصیص متخصص'),
              items: store.experts
                  .map(
                    (e) => DropdownMenuItem(
                      value: e.name,
                      child: Text(e.name, style: const TextStyle(fontSize: 12)),
                    ),
                  )
                  .toList(),
              onChanged: (v) {
                if (v != null) selected = v;
              },
            ),
            const SizedBox(height: 18),
            const Notice(
              'تأیید تخصصی برنامه از پنل متخصص انجام می‌شود. اینجا فقط تخصیص پرونده قابل تغییر است.',
            ),
            const SizedBox(height: 20),
            PrimaryButton(
              'ثبت تخصیص',
              onPressed: () {
                r.specialist = selected;
                store.update();
                Navigator.pop(sheet);
                showToast(context, 'متخصص پرونده در نمونه تغییر کرد.');
              },
              icon: Icons.check,
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
  String tab = 'کاربران', query = '';
  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final users = <String, DietRequest>{};
    for (final r in store.requests) {
      users.putIfAbsent(r.name, () => r);
    }
    final records = users.values.where((r) => r.name.contains(query)).toList();
    final experts = store.experts.where((e) => e.name.contains(query)).toList();
    return Scaffold(
      appBar: AppBar(
        title: const Text('افراد مجموعه'),
        automaticallyImplyLeading: widget.standalone,
        actions: [
          if (tab == 'متخصصان')
            IconButton(
              tooltip: 'افزودن متخصص',
              onPressed: () => editExpert(context),
              icon: const Icon(Icons.person_add_outlined),
            ),
        ],
      ),
      body: PageBody(
        children: [
          Filters(
            values: const ['کاربران', 'متخصصان'],
            selected: tab,
            onSelected: (v) => setState(() {
              tab = v;
              query = '';
            }),
          ),
          SearchField(
            key: ValueKey(tab),
            onChanged: (v) => setState(() => query = v),
            hint: 'جست‌وجوی نام',
          ),
          if (tab == 'کاربران')
            ...records.map(
              (r) => Surface(
                onTap: () => requestDetails(context, r),
                child: Row(
                  children: [
                    PersonAvatar(r.name),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            r.name,
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          Text(
                            'شناسهٔ ${fa(r.id)}',
                            style: const TextStyle(fontSize: 11, color: muted),
                          ),
                          const SizedBox(height: 8),
                          const Tag('فعال'),
                        ],
                      ),
                    ),
                    const Icon(Icons.chevron_left, color: muted),
                  ],
                ),
              ),
            )
          else
            ...experts.map(
              (e) => Surface(
                onTap: () => editExpert(context, record: e),
                child: Row(
                  children: [
                    PersonAvatar(e.name, color: const Color(0xFFF2E6D8)),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            e.name,
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          Text(
                            e.specialty,
                            style: const TextStyle(fontSize: 11, color: muted),
                          ),
                          const SizedBox(height: 8),
                          Tag(
                            e.active ? 'پذیرش فعال' : 'پذیرش متوقف',
                            warning: !e.active,
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.chevron_left, color: muted),
                  ],
                ),
              ),
            ),
          if (tab == 'کاربران' && records.isEmpty ||
              tab == 'متخصصان' && experts.isEmpty)
            const EmptyPanel(
              'موردی پیدا نشد',
              'نام دیگری رو جست‌وجو کن.',
              icon: Icons.search,
            ),
        ],
      ),
    );
  }
}

Future<void> editExpert(BuildContext context, {ExpertRecord? record}) async {
  final store = DemoScope.of(context),
      name = TextEditingController(text: record?.name ?? ''),
      specialty = TextEditingController(
        text: record?.specialty ?? 'تغذیه و رژیم‌درمانی',
      ),
      capacity = TextEditingController(text: fa(record?.capacity ?? 10));
  final form = GlobalKey<FormState>();
  bool active = record?.active ?? true;
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (sheet) => StatefulBuilder(
      builder: (sheet, setS) => SafeArea(
        child: Padding(
          padding: EdgeInsets.fromLTRB(
            24,
            8,
            24,
            24 + MediaQuery.viewInsetsOf(sheet).bottom,
          ),
          child: SingleChildScrollView(
            child: Form(
              key: form,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Heading(record == null ? 'افزودن متخصص' : 'تنظیمات متخصص'),
                  const SizedBox(height: 18),
                  TextFormField(
                    controller: name,
                    decoration: const InputDecoration(labelText: 'نام متخصص'),
                    validator: (v) =>
                        (v ?? '').trim().isEmpty ? 'نام لازم است.' : null,
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: specialty,
                    decoration: const InputDecoration(labelText: 'تخصص'),
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: capacity,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'ظرفیت پرونده',
                    ),
                    validator: (v) {
                      final n = int.tryParse(latinDigits(v ?? ''));
                      return n != null && n > 0 ? null : 'عدد مثبت وارد کن.';
                    },
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('پذیرش درخواست جدید'),
                    value: active,
                    onChanged: (v) => setS(() => active = v),
                  ),
                  PrimaryButton(
                    'ذخیره',
                    onPressed: () {
                      if (!form.currentState!.validate()) return;
                      if (record == null) {
                        if (store.experts.any(
                          (e) => e.name == name.text.trim(),
                        )) {
                          showToast(context, 'این نام متخصص قبلاً ثبت شده.');
                          return;
                        }
                        store.experts.add(
                          ExpertRecord(
                            name.text.trim(),
                            specialty.text.trim(),
                            active,
                            int.parse(latinDigits(capacity.text)),
                          ),
                        );
                      } else {
                        final old = record.name;
                        record.name = name.text.trim();
                        record.specialty = specialty.text.trim();
                        record.active = active;
                        record.capacity = int.parse(latinDigits(capacity.text));
                        for (final r in store.requests) {
                          if (r.specialist == old) r.specialist = record.name;
                        }
                      }
                      store.update();
                      Navigator.pop(sheet);
                    },
                    icon: Icons.check,
                  ),
                  const SizedBox(height: 10),
                  const Text(
                    'حساب یا دعوت واقعی ایجاد نمی‌شود.',
                    style: TextStyle(color: muted, fontSize: 11),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    ),
  );
  name.dispose();
  specialty.dispose();
  capacity.dispose();
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
                'بانک غذا',
                Icons.eco_outlined,
                onTap: () => pushPage(context, const FoodsScreen()),
              ),
              MenuRow(
                'تأیید نظرات کاربران',
                Icons.rate_review_outlined,
                onTap: () =>
                    pushPage(context, const ProgramReviewsModerationScreen()),
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
          onPressed: () => DemoScope.of(context).logout(),
          icon: const Icon(Icons.switch_account_outlined),
          label: const Text('تعویض پنل نمایشی'),
        ),
      ],
    ),
  );
}

class FoodsScreen extends StatefulWidget {
  const FoodsScreen({super.key});
  @override
  State<FoodsScreen> createState() => _FoodsScreenState();
}

class _FoodsScreenState extends State<FoodsScreen> {
  String query = '';
  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final rows = store.foods
        .where((f) => f.name.contains(query) || f.group.contains(query))
        .toList();
    return Scaffold(
      appBar: AppBar(
        title: const Text('بانک غذا'),
        actions: [
          IconButton(
            tooltip: 'افزودن غذا',
            onPressed: () => editFood(context),
            icon: const Icon(Icons.add),
          ),
        ],
      ),
      body: PageBody(
        children: [
          SearchField(
            onChanged: (v) => setState(() => query = v),
            hint: 'جست‌وجوی غذا یا گروه',
          ),
          ...rows.map(
            (f) => Surface(
              onTap: () => editFood(context, record: f),
              child: Row(
                children: [
                  const FoodArt(size: 62),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          f.name,
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 15,
                          ),
                        ),
                        Text(
                          '${f.group} · ${f.unit}',
                          style: const TextStyle(fontSize: 11, color: muted),
                        ),
                        const SizedBox(height: 7),
                        Tag(f.allergens, warning: true),
                      ],
                    ),
                  ),
                  const Icon(Icons.edit_outlined, color: pine, size: 20),
                ],
              ),
            ),
          ),
          if (rows.isEmpty)
            const EmptyPanel(
              'غذایی پیدا نشد',
              'غذای جدید اضافه کن یا جست‌وجو رو تغییر بده.',
              icon: Icons.search,
            ),
          const Notice(
            'بانک غذای این نمونه برای محاسبهٔ واقعی انرژی یا مواد مغذی آماده نشده است.',
          ),
        ],
      ),
    );
  }
}

Future<void> editFood(BuildContext context, {FoodRecord? record}) async {
  final store = DemoScope.of(context),
      name = TextEditingController(text: record?.name ?? ''),
      group = TextEditingController(text: record?.group ?? ''),
      unit = TextEditingController(text: record?.unit ?? 'سهم'),
      allergens = TextEditingController(text: record?.allergens ?? '');
  final form = GlobalKey<FormState>();
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (sheet) => SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          24,
          8,
          24,
          24 + MediaQuery.viewInsetsOf(sheet).bottom,
        ),
        child: SingleChildScrollView(
          child: Form(
            key: form,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Heading(record == null ? 'افزودن غذا' : 'ویرایش غذا'),
                const SizedBox(height: 18),
                TextFormField(
                  controller: name,
                  decoration: const InputDecoration(labelText: 'نام غذا'),
                  validator: (v) =>
                      (v ?? '').trim().isEmpty ? 'نام غذا لازم است.' : null,
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: group,
                  decoration: const InputDecoration(labelText: 'گروه غذایی'),
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: unit,
                  decoration: const InputDecoration(labelText: 'واحد'),
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: allergens,
                  decoration: const InputDecoration(
                    labelText: 'مواد حساسیت‌زا',
                  ),
                ),
                const SizedBox(height: 18),
                PrimaryButton(
                  'ذخیرهٔ غذا',
                  onPressed: () {
                    if (!form.currentState!.validate()) return;
                    if (record == null) {
                      store.foods.add(
                        FoodRecord(
                          name.text.trim(),
                          group.text.trim(),
                          unit.text.trim(),
                          allergens.text.trim(),
                        ),
                      );
                    } else {
                      record.name = name.text.trim();
                      record.group = group.text.trim();
                      record.unit = unit.text.trim();
                      record.allergens = allergens.text.trim();
                    }
                    store.update();
                    Navigator.pop(sheet);
                  },
                  icon: Icons.check,
                ),
                if (record != null) ...[
                  const SizedBox(height: 10),
                  OutlinedButton.icon(
                    onPressed: () {
                      store.removeFood(record);
                      Navigator.pop(sheet);
                    },
                    icon: const Icon(Icons.delete_outline),
                    label: const Text('حذف غذا از بانک'),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    ),
  );
  name.dispose();
  group.dispose();
  unit.dispose();
  allergens.dispose();
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
                  Heading(review.authorName, subtitle: 'در انتظار تأیید مدیر'),
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
                            showToast(context, 'نظر حذف شد.');
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

class PaymentsScreen extends StatefulWidget {
  const PaymentsScreen({super.key});
  @override
  State<PaymentsScreen> createState() => _PaymentsScreenState();
}

class _PaymentsScreenState extends State<PaymentsScreen> {
  String filter = 'همه';
  @override
  Widget build(BuildContext context) {
    const rows = [
      ('۲۰۸۴', 'سارا احمدی', '۴۹۰٬۰۰۰', 'موفق'),
      ('۲۰۸۳', 'امیر حسینی', '۴۹۰٬۰۰۰', 'موفق'),
      ('۲۰۸۲', 'مریم کریمی', '۳۹۰٬۰۰۰', 'در انتظار'),
      ('۲۰۸۱', 'علی شریفی', '۴۹۰٬۰۰۰', 'ناموفق'),
    ];
    return Scaffold(
      appBar: AppBar(title: const Text('سفارش‌ها و پرداخت‌ها')),
      body: PageBody(
        children: [
          const Notice(
            'تراکنش، درگاه و قیمت واقعی وجود ندارد؛ این فهرست برای طراحی رابط کاربری است.',
          ),
          Filters(
            values: const ['همه', 'موفق', 'در انتظار', 'ناموفق'],
            selected: filter,
            onSelected: (v) => setState(() => filter = v),
          ),
          ...rows
              .where((r) => filter == 'همه' || r.$4 == filter)
              .map(
                (r) => Surface(
                  onTap: () => showDialog<void>(
                    context: context,
                    builder: (d) => AlertDialog(
                      title: Text('رسید سفارش ${r.$1}'),
                      content: InfoRows({
                        'کاربر': r.$2,
                        'مبلغ نمونه': '${r.$3} تومان',
                        'وضعیت': r.$4,
                      }),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(d),
                          child: const Text('بستن'),
                        ),
                      ],
                    ),
                  ),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              r.$2,
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                          Tag(r.$4, warning: r.$4 != 'موفق'),
                        ],
                      ),
                      const SizedBox(height: 10),
                      InfoRows({
                        'شمارهٔ سفارش': r.$1,
                        'مبلغ نمونه': '${r.$3} تومان',
                      }),
                    ],
                  ),
                ),
              ),
        ],
      ),
    );
  }
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
            ('مدیر مجموعه', 'مدیریت سرویس و تخصیص پرونده‌ها'),
            ('متخصص', 'بررسی و تأیید برنامه‌های تخصیص‌یافته'),
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
