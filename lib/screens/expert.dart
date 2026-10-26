import 'package:flutter/material.dart';
import '../data/demo_store.dart';
import '../data/day.dart';
import '../theme.dart';
import '../widgets/ui.dart';
import 'shared.dart';

void openReview(BuildContext context, DietRequest request) {
  DemoScope.of(context).beginReview(request.id);
  pushPage(context, ReviewScreen(requestId: request.id));
}

class ExpertHome extends StatelessWidget {
  const ExpertHome({super.key});
  @override
  Widget build(BuildContext context) {
    final s = DemoScope.of(context),
        pending = s.requests.where((r) => r.status != PlanStatus.ready).length;
    final revisions = s.requests.where((r) => r.revisionRequested).toList(),
        threads = s.receivedThreads(AppRole.expert);
    return Scaffold(
      appBar: AppBar(title: Text('روز بخیر، ${s.experts.first.name}')),
      body: PageBody(
        children: [
          const Surface(
            child: Heading(
              'با دانش تو، یک قدم نزدیک‌تر به سلامت',
              subtitle: 'هر گفت‌وگو فرصتی برای همراهی بهتر با کاربر است.',
            ),
          ),
          MetricGrid(
            items: [
              for (final metric in [
                ('در انتظار و بررسی', pending, Icons.assignment_outlined),
                (
                  'درخواست تغییر برنامه',
                  revisions.length,
                  Icons.edit_note_outlined,
                ),
              ])
                Surface(
                  color: pine,
                  padding: 17,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(metric.$3, color: const Color(0xFFCCE6AD)),
                      const SizedBox(height: 10),
                      Text(
                        fa(metric.$2),
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 27,
                        ),
                      ),
                      Text(
                        metric.$1,
                        style: const TextStyle(
                          color: Colors.white70,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
          Heading(
            'پیام‌های دریافت‌شده',
            subtitle: 'آخرین پیام کاربران',
            action: TextButton(
              onPressed: () => pushPage(context, const MessagesScreen()),
              child: const Text('همهٔ گفتگوها'),
            ),
          ),
          if (threads.isEmpty)
            const EmptyPanel(
              'پیام تازه‌ای نیست',
              'پیام‌های کاربران اینجا قرار می‌گیرند.',
              icon: Icons.chat_bubble_outline,
            ),
          for (final thread in threads.take(4))
            ConversationTile(thread: thread, receivedOnly: true),
          Heading(
            'درخواست‌های تغییر برنامه',
            subtitle: '${fa(revisions.length)} درخواست اصلاح',
            action: TextButton(
              onPressed: () => pushPage(
                context,
                const RequestListScreen(initialFilter: 'اصلاح‌ها'),
              ),
              child: const Text('همه'),
            ),
          ),
          if (revisions.isEmpty)
            const EmptyPanel(
              'درخواست تغییری نیست',
              'وقتی کاربری تغییر برنامه بخواهد، اینجا نمایش داده می‌شود.',
              icon: Icons.edit_note_outlined,
            ),
          for (final r in revisions)
            Surface(
              onTap: () => openReview(context, r),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Heading(r.name, subtitle: 'درخواست ${fa(r.id)}'),
                  const SizedBox(height: 10),
                  Tag(
                    r.revisionReason.isEmpty
                        ? 'درخواست تغییر برنامه'
                        : r.revisionReason,
                    warning: true,
                  ),
                  if (r.revisionDetails.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(
                      r.revisionDetails,
                      style: const TextStyle(
                        color: muted,
                        fontSize: 12,
                        height: 1.8,
                      ),
                    ),
                  ],
                  const SizedBox(height: 10),
                  const Row(
                    children: [
                      Expanded(
                        child: Text(
                          'بررسی درخواست تغییر',
                          style: TextStyle(color: pine, fontSize: 12),
                        ),
                      ),
                      Icon(Icons.chevron_left, color: pine),
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

class RequestListScreen extends StatefulWidget {
  const RequestListScreen({
    super.key,
    this.embedded = false,
    this.initialFilter = 'همه',
  });
  final bool embedded;
  final String initialFilter;
  @override
  State<RequestListScreen> createState() => _RequestListScreenState();
}

class _RequestListScreenState extends State<RequestListScreen> {
  late String filter = widget.initialFilter;
  String query = '';
  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final rows = store.requests.where((r) {
      final q =
          r.name.contains(query) ||
          fa(r.id).contains(query) ||
          r.id.contains(query);
      return q &&
          switch (filter) {
            'در انتظار' =>
              r.status == PlanStatus.queued ||
                  r.status == PlanStatus.generating,
            'در بررسی' => r.status == PlanStatus.reviewing,
            'بررسی‌شده' => r.status == PlanStatus.ready,
            'اصلاح‌ها' => r.revisionRequested,
            'منتظر پاسخ' => r.status == PlanStatus.needsInfo,
            _ => true,
          };
    }).toList();
    return Scaffold(
      appBar: AppBar(
        title: const Text('درخواست‌های من'),
        automaticallyImplyLeading: !widget.embedded,
      ),
      body: PageBody(
        children: [
          SearchField(
            onChanged: (v) => setState(() => query = v),
            hint: 'جست‌وجوی نام یا شمارهٔ درخواست',
          ),
          Filters(
            values: const [
              'همه',
              'در انتظار',
              'در بررسی',
              'بررسی‌شده',
              'اصلاح‌ها',
              'منتظر پاسخ',
            ],
            selected: filter,
            onSelected: (v) => setState(() => filter = v),
          ),
          Text(
            '${fa(rows.length)} درخواست',
            style: const TextStyle(color: muted, fontSize: 12),
          ),
          if (rows.isEmpty)
            const EmptyPanel(
              'موردی پیدا نشد',
              'عبارت جست‌وجو یا فیلتر رو تغییر بده.',
              icon: Icons.search,
            ),
          ...rows.map(
            (r) => RequestTile(r, onTap: () => openReview(context, r)),
          ),
        ],
      ),
    );
  }
}

class ReviewScreen extends StatefulWidget {
  const ReviewScreen({super.key, required this.requestId});
  final String requestId;
  @override
  State<ReviewScreen> createState() => _ReviewScreenState();
}

class _ReviewScreenState extends State<ReviewScreen> {
  final note = TextEditingController();
  bool initialized = false;
  int reviewDay = 0;
  @override
  void dispose() {
    note.dispose();
    super.dispose();
  }

  Future<void> approve(DemoStore store) async {
    bool checked = false;
    final result = await showDialog<bool>(
      context: context,
      builder: (d) => StatefulBuilder(
        builder: (d, setD) => AlertDialog(
          title: const Text('تأیید نهایی نسخه'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'این برنامهٔ نمایشی پس از تأیید، در پنل کاربر قابل مشاهده می‌شود.',
                ),
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  value: checked,
                  onChanged: (v) => setD(() => checked = v ?? false),
                  title: const Text(
                    'اطلاعات، غذاها و مقدارها را بررسی کرده‌ام.',
                    style: TextStyle(fontSize: 13),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(d, false),
              child: const Text('ادامهٔ بررسی'),
            ),
            FilledButton(
              onPressed: checked ? () => Navigator.pop(d, true) : null,
              child: const Text('تأیید نهایی'),
            ),
          ],
        ),
      ),
    );
    if (result != true || !mounted) return;
    store.request(widget.requestId).draftNote = note.text;
    try {
      store.approve(widget.requestId);
      showToast(
        context,
        'نسخهٔ برنامه تأیید شد و در پنل کاربر قابل مشاهده است.',
      );
    } on StateError catch (e) {
      showToast(context, e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context), r = store.request(widget.requestId);
    if (!initialized) {
      note.text = r.draftNote;
      initialized = true;
    }
    return Scaffold(
      appBar: AppBar(title: const Text('بررسی برنامه')),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              OutlinedButton(
                onPressed: () => needMore(context, r),
                child: const Text('اطلاعات بیشتر'),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton(
                  onPressed: () => approve(store),
                  child: Text(
                    r.isPublished ? 'تأیید نسخهٔ جدید' : 'تأیید و ارسال برنامه',
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
      body: PageBody(
        children: [
          Surface(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
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
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          Text(
                            'درخواست ${fa(r.id)} · نسخهٔ ${fa(r.version + 1)}',
                            style: const TextStyle(color: muted, fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                InfoRows({
                  'هدف': r.goal,
                  'فعالیت': 'سبک · نمونه',
                  'شرایط': 'اطلاعات نمونهٔ پرونده',
                }),
                TextButton(
                  onPressed: () => showAnswers(context),
                  child: const Text('مشاهدهٔ پرسش‌نامه'),
                ),
              ],
            ),
          ),
          if (r.revisionRequested)
            Notice(
              '${r.revisionReason}\n${r.revisionDetails}',
              warning: true,
              icon: Icons.edit_note,
            ),
          const Heading(
            'پیش‌نویس هفتگی',
            subtitle:
                'هر روز را جداگانه بررسی کن؛ انرژی و مقدارها نمونه هستند.',
          ),
          SizedBox(
            height: 50,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: 7,
              separatorBuilder: (_, i) => const SizedBox(width: 8),
              itemBuilder: (_, i) => ChoiceChip(
                label: Text(persianWeekDays[i]),
                selected: reviewDay == i,
                onSelected: (_) => setState(() => reviewDay = i),
              ),
            ),
          ),
          ...r
              .draftForDay(reviewDay)
              .asMap()
              .entries
              .map(
                (e) => Surface(
                  padding: 13,
                  child: Row(
                    children: [
                      FoodArt(kind: e.value.kind, size: 66),
                      const SizedBox(width: 9),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              e.value.name,
                              style: const TextStyle(
                                fontSize: 11,
                                color: muted,
                              ),
                            ),
                            Text(
                              e.value.title,
                              style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            Text(
                              '${e.value.time} · ${fa(e.value.calories)} کیلوکالری',
                              style: const TextStyle(
                                color: muted,
                                fontSize: 10,
                              ),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        tooltip: 'ویرایش ${e.value.name}',
                        onPressed: () => editMeal(context, r, e.key),
                        icon: const Icon(Icons.edit_outlined, color: pine),
                      ),
                    ],
                  ),
                ),
              ),
          const Notice(
            'در این نسخه، کنترل تغذیه‌ای واقعی اجرا نمی‌شود. جای نمایش نتیجهٔ کنترل‌ها در نسخهٔ نهایی اینجاست.',
            icon: Icons.fact_check_outlined,
          ),
          TextField(
            controller: note,
            maxLines: 3,
            decoration: const InputDecoration(labelText: 'یادداشت برای کاربر'),
          ),
          OutlinedButton.icon(
            onPressed: () {
              r.draftNote = note.text;
              store.update();
              showToast(context, 'پیش‌نویس در حافظهٔ اپ ذخیره شد.');
            },
            icon: const Icon(Icons.save_outlined),
            label: const Text('ذخیرهٔ موقت'),
          ),
        ],
      ),
    );
  }

  Future<void> editMeal(BuildContext context, DietRequest r, int index) async {
    final store = DemoScope.of(context), m = r.draftForDay(reviewDay)[index];
    final title = TextEditingController(text: m.title),
        amount = TextEditingController(text: m.amount),
        time = TextEditingController(text: m.time),
        details = TextEditingController(text: m.details),
        calories = TextEditingController(text: m.calories.toString());
    final form = GlobalKey<FormState>();
    final result = await showModalBottomSheet<Meal>(
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
                  Heading('ویرایش ${m.name}'),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: title,
                    decoration: const InputDecoration(labelText: 'نام غذا'),
                    validator: (v) =>
                        (v ?? '').trim().isEmpty ? 'نام غذا لازم است.' : null,
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: amount,
                    minLines: 3,
                    maxLines: 7,
                    decoration: const InputDecoration(
                      labelText: 'مقدار دقیق هر ماده / واحد',
                    ),
                    validator: (v) =>
                        (v ?? '').trim().isEmpty ? 'مقدار لازم است.' : null,
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: calories,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'انرژی وعده / کیلوکالری',
                    ),
                    validator: (v) {
                      final n = int.tryParse(latinDigits(v ?? ''));
                      return n == null || n <= 0 ? 'عدد مثبت وارد کن.' : null;
                    },
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: time,
                    decoration: const InputDecoration(labelText: 'زمان وعده'),
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: details,
                    maxLines: 2,
                    decoration: const InputDecoration(
                      labelText: 'مواد اولیه و توضیح',
                    ),
                  ),
                  const SizedBox(height: 18),
                  PrimaryButton(
                    'ذخیرهٔ ویرایش',
                    onPressed: () {
                      if (!form.currentState!.validate()) return;
                      Navigator.pop(
                        sheet,
                        m.copyWith(
                          title: title.text.trim(),
                          amount: amount.text.trim(),
                          time: time.text.trim(),
                          details: details.text.trim(),
                          calories: int.parse(latinDigits(calories.text)),
                        ),
                      );
                    },
                    icon: Icons.check,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
    if (result != null) store.editMeal(r.id, index, result, day: reviewDay);
    title.dispose();
    amount.dispose();
    time.dispose();
    details.dispose();
    calories.dispose();
  }

  Future<void> needMore(BuildContext context, DietRequest r) async {
    final store = DemoScope.of(context), text = TextEditingController();
    final result = await showDialog<String>(
      context: context,
      builder: (d) => AlertDialog(
        title: const Text('اطلاعات بیشتر'),
        content: TextField(
          controller: text,
          maxLines: 3,
          decoration: const InputDecoration(labelText: 'سؤال برای کاربر'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(d),
            child: const Text('انصراف'),
          ),
          FilledButton(
            onPressed: () {
              if (text.text.trim().isEmpty) return;
              Navigator.pop(d, text.text.trim());
            },
            child: const Text('ثبت سؤال'),
          ),
        ],
      ),
    );
    if (result != null) {
      store.needInfo(r.id, result);
      if (context.mounted) {
        showToast(context, 'سؤال در پرونده و پیام‌های نمونه ثبت شد.');
      }
    }
    text.dispose();
  }

  void showAnswers(BuildContext context) {
    final store = DemoScope.of(context);
    final isUser = widget.requestId == store.userRequestId;
    showModalBottomSheet<void>(
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
              const Heading('پاسخ‌های پرسش‌نامه'),
              const SizedBox(height: 15),
              InfoRows(
                isUser
                    ? {
                        ...store.questionnaire.summary,
                        ...store.formConfiguration.extraSummary(
                          store.questionnaire.extraAnswers,
                        ),
                      }
                    : {
                        'پرونده': 'اطلاعات نمونه',
                        'هدف': store.request(widget.requestId).goal,
                      },
              ),
              const SizedBox(height: 15),
              OutlinedButton(
                onPressed: () => Navigator.pop(sheet),
                child: const Text('بستن'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class ExpertPatientsScreen extends StatefulWidget {
  const ExpertPatientsScreen({super.key});
  @override
  State<ExpertPatientsScreen> createState() => _ExpertPatientsScreenState();
}

class _ExpertPatientsScreenState extends State<ExpertPatientsScreen> {
  String query = '';
  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final rows = store.requests.where((r) => r.name.contains(query)).toList();
    return Scaffold(
      appBar: AppBar(title: const Text('کاربران من')),
      body: PageBody(
        children: [
          SearchField(
            onChanged: (v) => setState(() => query = v),
            hint: 'جست‌وجوی نام کاربر',
          ),
          ...rows.map(
            (r) => RequestTile(r, onTap: () => openReview(context, r)),
          ),
          if (rows.isEmpty)
            const EmptyPanel(
              'کاربری پیدا نشد',
              'عبارت دیگری رو جست‌وجو کن.',
              icon: Icons.search,
            ),
        ],
      ),
    );
  }
}
