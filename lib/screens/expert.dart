import 'package:flutter/material.dart';
import '../data/demo_store.dart';
import '../data/day.dart';
import '../theme.dart';
import '../widgets/ui.dart';
import 'shared.dart';
import 'clinic_workspace.dart';
import 'meal_editor.dart';

void openReview(BuildContext context, DietRequest request) {
  DemoScope.of(context).beginReview(request.id);
  pushPage(context, ReviewScreen(requestId: request.id));
}

class ExpertHome extends StatelessWidget {
  const ExpertHome({super.key});
  @override
  Widget build(BuildContext context) => const ClinicHome();
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
  late String filter = widget.initialFilter == 'اصلاح‌ها'
      ? 'درخواست اصلاح'
      : widget.initialFilter;
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
            'نیازمند بررسی' =>
              r.status != PlanStatus.ready && r.status != PlanStatus.needsInfo,
            'در بررسی' => r.status == PlanStatus.reviewing,
            'پاسخ جدید' =>
              r.infoAnswer.isNotEmpty &&
                  !r.infoAnswerReviewed &&
                  r.status != PlanStatus.ready,
            'بررسی‌شده' => r.status == PlanStatus.ready,
            'درخواست اصلاح' || 'اصلاح‌ها' => r.revisionRequested,
            'منتظر پاسخ' =>
              r.status == PlanStatus.needsInfo && r.infoAnswer.isEmpty,
            _ => true,
          };
    }).toList();
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'پرونده‌ها و درخواست‌ها',
          style: TextStyle(color: Colors.white),
        ),
        backgroundColor: pine,
        foregroundColor: Colors.white,
        automaticallyImplyLeading: !widget.embedded,
      ),
      body: Column(
        children: [
          Container(
            decoration: const BoxDecoration(
              color: pine,
              borderRadius: BorderRadius.vertical(bottom: Radius.circular(22)),
            ),
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SearchField(
                  onChanged: (v) => setState(() => query = v),
                  hint: 'جست‌وجوی نام یا شمارهٔ درخواست',
                ),
                const SizedBox(height: 16),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final value in const [
                      'همه',
                      'درخواست اصلاح',
                      'نیازمند بررسی',
                      'در انتظار',
                      'در بررسی',
                      'پاسخ جدید',
                      'منتظر پاسخ',
                      'بررسی‌شده',
                    ])
                      ChoiceChip(
                        label: Text(value),
                        selected: filter == value,
                        onSelected: (_) => setState(() => filter = value),
                        backgroundColor: Colors.white,
                        selectedColor: Colors.white,
                        surfaceTintColor: Colors.transparent,
                        checkmarkColor: pine,
                        showCheckmark: true,
                        labelStyle: TextStyle(
                          color: pine,
                          fontSize: 11,
                          fontWeight: filter == value
                              ? FontWeight.bold
                              : FontWeight.normal,
                        ),
                        side: BorderSide(
                          color: filter == value
                              ? const Color(0xFFB7C9A1)
                              : Colors.white,
                          width: 1.5,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 9,
                        ),
                        materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                  ],
                ),
              ],
            ),
          ),
          Expanded(
            child: PageBody(
              spacing: 12,
              children: [
                Text(
                  '${fa(rows.length)} پرونده',
                  style: const TextStyle(fontSize: 11, color: muted),
                ),
                if (rows.isEmpty)
                  const EmptyPanel(
                    'موردی پیدا نشد',
                    'فیلتر یا جست‌وجو را تغییر بده.',
                    icon: Icons.search,
                  ),
                for (final r in rows) ClinicRequestRow(r),
              ],
            ),
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
    return DefaultTabController(
      length: 3,
      initialIndex: !r.revisionRequested && r.question.isNotEmpty ? 2 : 1,
      child: Scaffold(
        appBar: AppBar(
          title: const Text(
            'بررسی برنامه',
            style: TextStyle(color: Colors.white),
          ),
          backgroundColor: pine,
          foregroundColor: Colors.white,
        ),
        bottomNavigationBar: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (!r.canApproveInformation)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Text(
                      r.revisionAwaitingUser || r.infoAnswer.isEmpty
                          ? 'برای تأیید، منتظر پاسخ کاربر هستیم.'
                          : 'ابتدا پاسخ کاربر را در تب سؤال و پاسخ بررسی کن.',
                      style: const TextStyle(color: amber, fontSize: 11),
                    ),
                  ),
                Row(
                  children: [
                    OutlinedButton(
                      onPressed: () {
                        if (r.revisionRequested) {
                          final thread = store.conversationForRequest(r.id);
                          pushPage(context, ChatScreen(threadId: thread.id));
                        } else {
                          needMore(context, r);
                        }
                      },
                      child: Text(
                        r.revisionRequested
                            ? 'گفتگو با کاربر'
                            : 'اطلاعات بیشتر',
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: FilledButton(
                        onPressed: r.canApproveInformation
                            ? () => approve(store)
                            : null,
                        child: Text(
                          r.isPublished
                              ? 'تأیید نسخهٔ جدید'
                              : 'تأیید و ارسال برنامه',
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        body: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 12),
              child: Surface(
                radius: 14,
                padding: 13,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        PersonAvatar(r.name, size: 36),
                        const SizedBox(width: 9),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                r.name,
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              Text(
                                'پرونده ${fa(r.id)} · ${r.goal}',
                                style: const TextStyle(
                                  color: muted,
                                  fontSize: 11,
                                ),
                              ),
                            ],
                          ),
                        ),
                        ClinicStatus(r),
                      ],
                    ),
                    if (r.id == store.userRequestId &&
                        store.questionnaire.health.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(
                          store.questionnaire.health.join(' · '),
                          style: const TextStyle(fontSize: 10, color: amber),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            TabBar(
              tabs: [
                Tab(text: 'پرونده'),
                Tab(text: 'برنامه غذایی'),
                Tab(text: r.revisionRequested ? 'گفتگو' : 'سؤال و پاسخ'),
              ],
            ),
            Expanded(
              child: TabBarView(
                children: [
                  PageBody(
                    spacing: 12,
                    children: [
                      const Heading('اطلاعات و پرسش‌نامه'),
                      InfoRows(
                        r.id == store.userRequestId
                            ? {
                                ...store.questionnaire.summary,
                                ...store.formConfiguration.extraSummary(
                                  store.questionnaire.extraAnswers,
                                ),
                              }
                            : {
                                'نام': r.name,
                                'هدف': r.goal,
                                'اطلاعات':
                                    'پروندهٔ نمونه؛ اطلاعات بالینی کامل ثبت نشده است.',
                              },
                      ),
                    ],
                  ),
                  PageBody(
                    spacing: 12,
                    children: [
                      if (r.revisionRequested)
                        Notice(
                          '${r.revisionReason}\n${r.revisionDetails}',
                          warning: true,
                        ),
                      const Heading('پیش‌نویس هفتگی'),
                      SizedBox(
                        height: 48,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          itemCount: 7,
                          separatorBuilder: (_, i) => const SizedBox(width: 6),
                          itemBuilder: (_, i) => ChoiceChip(
                            label: Text(persianWeekDays[i]),
                            selected: reviewDay == i,
                            onSelected: (_) => setState(() => reviewDay = i),
                          ),
                        ),
                      ),
                      for (final e in r.draftForDay(reviewDay).asMap().entries)
                        Surface(
                          radius: 14,
                          padding: 14,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Row(
                                children: [
                                  const Icon(
                                    Icons.restaurant_outlined,
                                    color: pine,
                                    size: 19,
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      '${e.value.name} · ${e.value.time}',
                                      style: const TextStyle(
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                  IconButton(
                                    tooltip: 'ویرایش ${e.value.name}',
                                    onPressed: () =>
                                        editMeal(context, r, e.key),
                                    icon: const Icon(
                                      Icons.edit_outlined,
                                      size: 19,
                                    ),
                                  ),
                                  IconButton(
                                    tooltip: 'حذف وعده',
                                    onPressed: () =>
                                        removeMeal(context, store, r, e.key),
                                    icon: const Icon(
                                      Icons.delete_outline,
                                      size: 19,
                                    ),
                                  ),
                                ],
                              ),
                              Text(
                                e.value.title,
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 14,
                                ),
                              ),
                              const SizedBox(height: 10),
                              for (final item in e.value.amount.split('\n'))
                                Padding(
                                  padding: const EdgeInsets.only(bottom: 4),
                                  child: Text(
                                    item,
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: muted,
                                    ),
                                  ),
                                ),
                              const Divider(),
                              Text(
                                '${fa(e.value.calories)} کیلوکالری',
                                style: const TextStyle(
                                  color: pine,
                                  fontSize: 11,
                                ),
                              ),
                            ],
                          ),
                        ),
                      OutlinedButton.icon(
                        onPressed: () => addCustomMeal(context, store, r),
                        icon: const Icon(Icons.add),
                        label: const Text('افزودن وعده به برنامه'),
                      ),
                      TextField(
                        controller: note,
                        maxLines: 3,
                        decoration: const InputDecoration(
                          labelText: 'یادداشت برای کاربر',
                        ),
                      ),
                      OutlinedButton.icon(
                        onPressed: () {
                          r.draftNote = note.text;
                          store.update();
                          showToast(context, 'پیش‌نویس ذخیره شد.');
                        },
                        icon: const Icon(Icons.save_outlined),
                        label: const Text('ذخیرهٔ موقت'),
                      ),
                      const Text(
                        'اطلاعات و مقدارها در این نسخه نمونه‌اند.',
                        style: TextStyle(fontSize: 10, color: muted),
                      ),
                    ],
                  ),
                  PageBody(
                    spacing: 12,
                    children: [
                      if (r.revisionRequested)
                        Surface(
                          color: sage,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              const Heading('گفتگو دربارهٔ اصلاح برنامه'),
                              Text(
                                r.revisionDetails.isNotEmpty
                                    ? r.revisionDetails
                                    : r.revisionReason,
                              ),
                              const SizedBox(height: 12),
                              const Text(
                                'برای پرسیدن سؤال و هماهنگی تغییرات، در گفتگوی کاربر پیام بده.',
                              ),
                              TextButton(
                                onPressed: () {
                                  final thread = store.conversationForRequest(
                                    r.id,
                                  );
                                  pushPage(
                                    context,
                                    ChatScreen(threadId: thread.id),
                                  );
                                },
                                child: const Text('باز کردن گفتگو'),
                              ),
                            ],
                          ),
                        ),
                      if (!r.revisionRequested && r.question.isNotEmpty)
                        Surface(
                          radius: 14,
                          color: sage,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              const Heading('اطلاعات بیشتر'),
                              Text('سؤال شما: ${r.question}'),
                              const SizedBox(height: 10),
                              if (r.infoAnswer.isEmpty)
                                const Notice(
                                  'منتظر پاسخ کاربر؛ تا دریافت و بررسی پاسخ، تأیید برنامه غیرفعال است.',
                                  warning: true,
                                )
                              else ...[
                                Text('پاسخ کاربر: ${r.infoAnswer}'),
                                const SizedBox(height: 8),
                                if (!r.infoAnswerReviewed)
                                  OutlinedButton.icon(
                                    key: const ValueKey(
                                      'review-information-answer',
                                    ),
                                    onPressed: () =>
                                        store.markInfoAnswerReviewed(r.id),
                                    icon: const Icon(Icons.done_all),
                                    label: const Text(
                                      'پاسخ را خواندم و بررسی کردم',
                                    ),
                                  )
                                else
                                  const Tag(
                                    'پاسخ بررسی شد؛ امکان تأیید برنامه فعال است',
                                  ),
                              ],
                            ],
                          ),
                        ),

                      if (!r.revisionRequested && r.question.isEmpty)
                        const EmptyPanel(
                          'سؤال بازی وجود ندارد',
                          'در صورت نیاز، از دکمهٔ اطلاعات بیشتر سؤال خود را ثبت کن.',
                          icon: Icons.question_answer_outlined,
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> editMeal(BuildContext context, DietRequest r, int index) async {
    final store = DemoScope.of(context);
    final edited = await _editMealSheet(
      context,
      r.draftForDay(reviewDay)[index],
      heading: 'ویرایش وعده',
      editing: true,
    );
    if (edited != null) store.editMeal(r.id, index, edited, day: reviewDay);
  }

  Future<void> removeMeal(
    BuildContext context,
    DemoStore store,
    DietRequest r,
    int index,
  ) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (d) => AlertDialog(
        title: const Text('حذف وعده'),
        content: const Text('این وعده از پیش‌نویس همان روز حذف شود؟'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(d, false),
            child: const Text('انصراف'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(d, true),
            child: const Text('حذف'),
          ),
        ],
      ),
    );
    if (ok == true) store.removeMeal(r.id, index, day: reviewDay);
  }

  Future<void> addCustomMeal(
    BuildContext context,
    DemoStore store,
    DietRequest r,
  ) async {
    final meal = await _editMealSheet(
      context,
      const Meal(
        name: 'شام',
        title: '',
        time: '',
        amount: '',
        details: '',
        kind: 0,
        calories: 0,
      ),
      heading: 'افزودن وعده به برنامه',
    );
    if (meal != null) store.addMeal(r.id, meal, day: reviewDay);
  }

  Future<Meal?> _editMealSheet(
    BuildContext context,
    Meal meal, {
    required String heading,
    bool editing = false,
  }) => Navigator.of(context).push<Meal>(
    MaterialPageRoute(
      builder: (_) => MealEditorScreen(meal: meal, editing: editing),
    ),
  );

  Future<void> needMore(BuildContext context, DietRequest r) async {
    final store = DemoScope.of(context), text = TextEditingController();
    final dialogRoute = DialogRoute<String>(
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
    final result = await Navigator.of(context).push<String>(dialogRoute);
    await dialogRoute.completed;
    if (result != null) {
      store.needInfo(r.id, result);
      if (context.mounted) {
        showToast(context, 'سؤال در پرونده و پیام‌های نمونه ثبت شد.');
      }
    }
    text.dispose();
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
        spacing: 12,
        children: [
          SearchField(
            onChanged: (v) => setState(() => query = v),
            hint: 'جست‌وجوی نام کاربر',
          ),
          ...rows.map((r) => ClinicRequestRow(r)),
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
