import 'package:flutter/material.dart';
import '../data/demo_store.dart';
import '../theme.dart';
import '../widgets/ui.dart';
import '../widgets/extra_questions.dart';

class QuestionnaireScreen extends StatefulWidget {
  const QuestionnaireScreen({
    super.key,
    this.onboarding = false,
    this.editing = false,
    this.initialData,
    this.onExit,
    this.onSaved,
  });
  final bool onboarding, editing;
  final QuestionnaireData? initialData;
  final VoidCallback? onExit, onSaved;
  @override
  State<QuestionnaireScreen> createState() => _QuestionnaireScreenState();
}

class _QuestionnaireScreenState extends State<QuestionnaireScreen> {
  int step = 0;
  bool saving = false;
  QuestionnaireData? _draft;
  QuestionnaireData get answers => _draft!;
  final scroll = ScrollController();

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _draft ??= widget.initialData ?? DemoScope.of(context).questionnaire.copy();
  }

  @override
  void dispose() {
    scroll.dispose();
    super.dispose();
  }

  void moveTo(int target) {
    setState(() => step = target);
    if (scroll.hasClients) scroll.jumpTo(0);
  }

  void back() {
    if (saving) return;
    if (step > 0) {
      moveTo(step - 1);
      return;
    }
    if (widget.onboarding) {
      widget.onExit?.call();
    } else {
      Navigator.pop(context);
    }
  }

  bool validStep() {
    if (!form.currentState!.validate()) return false;
    final error = DemoScope.of(
      context,
    ).formConfiguration.validateExtras(answers.extraAnswers, section: step);
    if (error != null) {
      showToast(context, error);
      return false;
    }
    final selected = switch (step) {
      1 => QuestionnaireData.goals.contains(answers.goal),
      2 => answers.health.isNotEmpty,
      3 => answers.activity.isNotEmpty,
      4 => answers.preference.isNotEmpty,
      _ => true,
    };
    if (!selected) showToast(context, 'برای ادامه، یک گزینه انتخاب کن.');
    if (!selected) return false;
    if (step == 1 && answers.weightGoal && !answers.pregnant) {
      final target = QuestionnaireData.number(answers.targetWeight),
          current = QuestionnaireData.number(answers.weight);
      if (target == null ||
          current == null ||
          (answers.goal == 'کاهش وزن'
              ? target >= current
              : target <= current)) {
        showToast(
          context,
          answers.goal == 'کاهش وزن'
              ? 'وزن هدف باید از وزن فعلی کمتر باشد.'
              : 'وزن هدف باید از وزن فعلی بیشتر باشد.',
        );
        return false;
      }
    }
    return true;
  }

  final form = GlobalKey<FormState>();
  Widget field(
    String label,
    String value,
    ValueChanged<String> onChanged, {
    bool numeric = false,
    bool optional = false,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 17),
    child: TextFormField(
      key: ValueKey(label),
      initialValue: value,
      decoration: InputDecoration(
        labelText: DemoScope.of(
          context,
        ).formConfiguration.labelForOriginal(label),
        helperText: DemoScope.of(
          context,
        ).formConfiguration.helperForOriginal(label),
        helperMaxLines: 3,
      ),
      onChanged: onChanged,
      keyboardType: numeric
          ? const TextInputType.numberWithOptions(decimal: true)
          : TextInputType.text,
      validator: (v) {
        if (optional && (v ?? '').trim().isEmpty) return null;
        if ((v ?? '').trim().isEmpty) return 'این قسمت رو تکمیل کن.';
        if (numeric) {
          final n = double.tryParse(latinDigits(v!));
          if (n == null || n <= 0 || n > 500) return 'یک عدد معتبر وارد کن.';
        }
        return null;
      },
    ),
  );
  Widget options(
    String selected,
    List<(String, String, IconData)> choices,
    ValueChanged<String> choose,
  ) {
    final config = DemoScope.of(context).formConfiguration;
    final id = choices.first.$1 == 'کاهش وزن'
        ? 'goal'
        : choices.first.$1 == 'بیشتر نشسته'
        ? 'activity'
        : 'preference';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          config.label(id),
          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
        ),
        if (config.question(id).helper.isNotEmpty)
          Text(
            config.question(id).helper,
            style: const TextStyle(color: muted, fontSize: 12),
          ),
        const SizedBox(height: 10),
        for (final c in choices)
          ChoiceCard(
            config.choice(id, c.$1),
            subtitle: c.$2,
            icon: c.$3,
            selected: selected == c.$1,
            onTap: () => setState(() => choose(c.$1)),
          ),
      ],
    );
  }

  Widget select(
    String key,
    String label,
    String value,
    List<String> values,
    ValueChanged<String> choose, {
    String Function(String)? display,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 18),
    child: DropdownButtonFormField<String>(
      key: ValueKey(key),
      initialValue: values.contains(value) ? value : null,
      isExpanded: true,
      decoration: InputDecoration(
        labelText: DemoScope.of(context).formConfiguration.label(key, label),
        helperText:
            DemoScope.of(context).formConfiguration.question(key).helper.isEmpty
            ? null
            : DemoScope.of(context).formConfiguration.question(key).helper,
        helperMaxLines: 3,
      ),
      items: values
          .map(
            (v) => DropdownMenuItem(
              value: v,
              child: Text(
                DemoScope.of(
                  context,
                ).formConfiguration.choice(key, display?.call(v) ?? v),
                style: const TextStyle(fontSize: 13),
              ),
            ),
          )
          .toList(),
      validator: (v) => v == null ? 'یک گزینه انتخاب کن.' : null,
      onChanged: (v) {
        if (v != null) setState(() => choose(v));
      },
    ),
  );

  Future<void> next(DemoStore store) async {
    if (saving || !validStep()) return;
    if (step < 5) {
      moveTo(step + 1);
      return;
    }
    if (!answers.consent) {
      showToast(context, 'برای ذخیره، رضایت پردازش را تأیید کن.');
      return;
    }
    setState(() => saving = true);
    try {
      await store.saveQuestionnaire(answers, onboarding: !widget.editing);
      if (!mounted) return;
      if (widget.onSaved != null) {
        widget.onSaved!();
        return;
      }
      if (!widget.onboarding) Navigator.pop(context);
      showToast(
        context,
        widget.editing
            ? 'تغییرات پرسش‌نامه ذخیره شد.'
            : 'اطلاعاتت ثبت شد؛ به سبزینه خوش اومدی.',
      );
    } catch (_) {
      if (mounted) {
        showToast(
          context,
          'ذخیره انجام نشد. پاسخ‌ها باقی مانده‌اند؛ دوباره تلاش کن.',
        );
      }
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context), q = answers;
    final content = switch (step) {
      0 => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          field('نام و نام خانوادگی', q.name, (v) => q.name = v),
          TextFormField(
            initialValue: store.sessionPhone,
            readOnly: true,
            decoration: const InputDecoration(
              labelText: 'شماره تلفن',
              hintText: 'پس از ورود نمایش داده می‌شود',
            ),
            keyboardType: TextInputType.phone,
          ),
          const SizedBox(height: 14),
          field('سن / سال', q.age, (v) => q.age = v, numeric: true),
          select(
            'sex',
            'جنسیت زیستی',
            q.sex,
            ['زن', 'مرد', 'ترجیح می‌دهم نگویم'],
            (v) {
              q.sex = v;
              if (v == 'مرد') {
                q.lifeStage = 'ارتباطی ندارد';
                q.pregnancyWeek = '';
                q.prePregnancyWeight = '';
              } else if (q.lifeStage == 'ارتباطی ندارد') {
                q.lifeStage = '';
              }
            },
          ),
          field('قد / سانتی‌متر', q.height, (v) => q.height = v, numeric: true),
          field('وزن / کیلوگرم', q.weight, (v) => q.weight = v, numeric: true),
          const Notice(
            'قد و وزن فعلی، نقطهٔ شروع بررسی متخصص هستند؛ پاسخ دقیق‌تر، بررسی بهتری می‌سازد.',
            icon: Icons.straighten,
          ),
        ],
      ),
      1 => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          options(
            q.goal,
            [
              (
                'کاهش وزن',
                'کاهش وزن با برنامه و پیگیری متخصص',
                Icons.trending_down,
              ),
              (
                'افزایش وزن',
                'افزایش وزن و بهبود دریافت غذایی',
                Icons.trending_up,
              ),
              ('تثبیت وزن', 'حفظ وزن و ساختن عادت‌های پایدار', Icons.balance),
              (
                'تغذیهٔ سالم',
                'تنوع، نظم و کیفیت بهتر وعده‌ها',
                Icons.eco_outlined,
              ),
              (
                'تغذیهٔ ورزشی',
                'هماهنگی غذا با تمرین و فعالیت',
                Icons.fitness_center,
              ),
              (
                'رژیم برای شرایط پزشکی',
                'تنظیم تغذیه با نظر متخصص',
                Icons.health_and_safety_outlined,
              ),
            ],
            (v) {
              q.goal = v;
            },
          ),
          const SizedBox(height: 18),
          if (q.sex != 'مرد')
            select(
              'lifeStage',
              'وضعیت بارداری یا شیردهی',
              q.lifeStage,
              [
                'هیچ‌کدام',
                'در حال اقدام به بارداری',
                'باردار هستم',
                'شیرده هستم',
                'ارتباطی ندارد',
              ],
              (v) {
                q.lifeStage = v;
                if (!q.pregnant) {
                  q.pregnancyWeek = '';
                  q.prePregnancyWeight = '';
                  q.babies = '';
                  q.health.removeAll({
                    'دیابت بارداری تشخیص‌داده‌شده',
                    'بارداری پرخطر با نظر پزشک',
                  });
                  if (q.health.isEmpty) {
                    q.health.add('موردی ندارم');
                    q.healthDetails = '';
                  }
                }
                if (v != 'شیرده هستم') {
                  q.nursingAge = '';
                }
              },
            ),
          if (q.pregnant) ...[
            select(
              'pregnancyWeek',
              'هفتهٔ بارداری',
              q.pregnancyWeek,
              List.generate(42, (i) => '${i + 1}'),
              (v) => q.pregnancyWeek = v,
              display: (v) => 'هفتهٔ ${fa(v)}',
            ),
            field(
              'وزن پیش از بارداری / کیلوگرم',
              q.prePregnancyWeight,
              (v) => q.prePregnancyWeight = v,
              numeric: true,
            ),
            select('babies', 'تعداد جنین', q.babies, [
              'تک‌قلو',
              'دوقلو یا بیشتر',
              'هنوز مشخص نیست',
            ], (v) => q.babies = v),
            const Notice(
              'مسیر بارداری برای بررسی جداگانه به متخصص مشخص می‌شود؛ هدف وزن و انرژی با ارزیابی او تعیین خواهد شد.',
              icon: Icons.child_care,
            ),
          ],
          if (q.lifeStage == 'شیرده هستم')
            select('nursingAge', 'سن کودک', q.nursingAge, [
              'کمتر از ۶ ماه',
              '۶ تا ۱۲ ماه',
              'بیشتر از ۱۲ ماه',
            ], (v) => q.nursingAge = v),
          ...[
            field(
              'وزن هدف / کیلوگرم',
              q.targetWeight,
              (v) => q.targetWeight = v,
              numeric: true,
              optional: !q.weightGoal || q.pregnant,
            ),
            const Text(
              'اگر متخصص برایت وزن هدف تعیین کرده، آن را وارد کن؛ در غیر این صورت هدف پیشنهادی خودت بررسی می‌شود. برای بارداری ثبت این عدد اختیاری است.',
              style: TextStyle(fontSize: 11, color: muted),
            ),
          ],
          const SizedBox(height: 18),
          select('previousDiet', 'تجربهٔ قبلی رژیم', q.previousDiet, [
            'نداشته‌ام',
            'نتیجه گرفتم و حفظ کردم',
            'وزن دوباره برگشته',
            'ادامه‌دادن برایم سخت بود',
          ], (v) => q.previousDiet = v),
        ],
      ),
      2 => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            store.formConfiguration.label('health'),
            style: TextStyle(fontSize: 12, color: muted, height: 1.9),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final item in [
                'موردی ندارم',
                'دیابت',
                'فشار خون',
                'اختلال تیروئید',
                'بیماری کلیه',
                'بیماری کبد',
                'مشکل گوارشی',
                'سابقهٔ اختلال خوردن',
                'حساسیت غذایی دارم',
                'دارو مصرف می‌کنم',
                'شرایط دیگر',
                if (q.pregnant) 'دیابت بارداری تشخیص‌داده‌شده',
                if (q.pregnant) 'بارداری پرخطر با نظر پزشک',
              ])
                FilterChip(
                  label: Text(
                    store.formConfiguration.choice('health', item),
                    style: const TextStyle(fontSize: 12),
                  ),
                  selected: q.health.contains(item),
                  onSelected: (v) => setState(() {
                    if (item == 'موردی ندارم') {
                      q.health
                        ..clear()
                        ..add(item);
                      q.healthDetails = '';
                      q.medicines = '';
                      q.allergies = '';
                    } else {
                      q.health.remove('موردی ندارم');
                      if (v) {
                        q.health.add(item);
                      } else {
                        q.health.remove(item);
                      }
                      if (!q.health.contains('حساسیت غذایی دارم')) {
                        q.allergies = '';
                      }
                      if (!q.health.contains('دارو مصرف می‌کنم')) {
                        q.medicines = '';
                      }
                      if (q.health.isEmpty) {
                        q.health.add('موردی ندارم');
                        q.healthDetails = '';
                      }
                    }
                  }),
                ),
            ],
          ),
          const SizedBox(height: 20),
          if (q.health.isNotEmpty && !q.health.contains('موردی ندارم'))
            field(
              'توضیح شرایط و محدودیت‌های پزشک',
              q.healthDetails,
              (v) => q.healthDetails = v,
            ),
          if (q.health.contains('حساسیت غذایی دارم'))
            field(
              'نام مادهٔ حساسیت‌زا و نوع واکنش',
              q.allergies,
              (v) => q.allergies = v,
            ),
          if (q.health.contains('دارو مصرف می‌کنم'))
            field(
              'نام داروها و مکمل‌ها و مقدار مصرف',
              q.medicines,
              (v) => q.medicines = v,
            ),
          const Notice(
            'این اطلاعات در پرونده برای بررسی متخصص نمایش داده می‌شوند. فرم، تشخیص پزشکی انجام نمی‌دهد.',
            icon: Icons.medical_information_outlined,
          ),
        ],
      ),
      3 => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          options(q.activity, [
            (
              'بیشتر نشسته',
              'کار پشت میز و تحرک روزانهٔ کم',
              Icons.chair_outlined,
            ),
            ('فعالیت سبک', 'پیاده‌روی و کارهای روزمره', Icons.directions_walk),
            (
              'فعالیت متوسط',
              'کار نسبتاً فعال یا تمرین منظم',
              Icons.directions_run,
            ),
            (
              'فعالیت زیاد',
              'کار بدنی سنگین یا تمرین پرتکرار',
              Icons.fitness_center,
            ),
          ], (v) => q.activity = v),
          const SizedBox(height: 16),
          select('exercise', 'تعداد جلسهٔ ورزش در هفته', q.exercise, [
            'ورزش نمی‌کنم',
            '۱ تا ۲ جلسه',
            '۳ تا ۴ جلسه',
            '۵ جلسه یا بیشتر',
          ], (v) => q.exercise = v),
          select('sleep', 'خواب معمول شبانه', q.sleep, [
            'کمتر از ۵ ساعت',
            '۵ تا ۷ ساعت',
            '۷ تا ۹ ساعت',
            'بیشتر از ۹ ساعت',
          ], (v) => q.sleep = v),
          select('mealPattern', 'الگوی معمول غذاخوردن', q.mealPattern, [
            'سه وعدهٔ منظم',
            'بیشتر وعده‌ها را حذف می‌کنم',
            'ریزه‌خواری دارم',
            'غذاخوردن شبانه',
            'به‌دلیل شیفت کاری نامنظم است',
          ], (v) => q.mealPattern = v),
          select('water', 'آب معمول در روز', q.water, [
            'کمتر از ۴ لیوان',
            '۴ تا ۶ لیوان',
            '۷ تا ۹ لیوان',
            '۱۰ لیوان یا بیشتر',
          ], (v) => q.water = v),
        ],
      ),
      4 => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          options(q.preference, [
            (
              'غذای ایرانی',
              'وعده‌های خانگی و در دسترس',
              Icons.rice_bowl_outlined,
            ),
            ('ترکیبی', 'غذاهای ایرانی و متنوع', Icons.restaurant_outlined),
            (
              'گیاه‌خواری',
              'بدون گوشت؛ نیازها با متخصص بررسی می‌شوند',
              Icons.eco_outlined,
            ),
            ('وگان', 'بدون محصولات حیوانی', Icons.spa_outlined),
          ], (v) => q.preference = v),
          const SizedBox(height: 16),
          select('budget', 'بودجهٔ تهیهٔ غذا', q.budget, [
            'اقتصادی',
            'متوسط',
            'آزاد',
          ], (v) => q.budget = v),
          select('cooking', 'زمان معمول آشپزی', q.cooking, [
            'کمتر از ۳۰ دقیقه',
            '۳۰ تا ۶۰ دقیقه',
            'محدودیت ندارم',
          ], (v) => q.cooking = v),
          field(
            'غذاهای نامطلوب (اختیاری)',
            q.dislikes,
            (v) => q.dislikes = v,
            optional: true,
          ),
        ],
      ),
      _ => Column(
        children: [
          Surface(
            child: InfoRows({
              ...q.summary,
              ...store.formConfiguration.extraSummary(q.extraAnswers),
            }),
          ),
          const SizedBox(height: 16),
          CheckboxListTile(
            contentPadding: EdgeInsets.zero,
            value: q.consent,
            onChanged: (v) => setState(() => q.consent = v ?? false),
            title: const Text(
              'با پردازش اطلاعات برای تهیهٔ پیش‌نویس و بررسی متخصص موافقم.',
              style: TextStyle(fontSize: 13),
            ),
          ),
          Notice(
            widget.editing
                ? 'پاسخ‌ها برای بررسی متخصص ذخیره می‌شوند؛ تغییر اطلاعات، برنامهٔ تأییدشده را خودکار عوض نمی‌کند.'
                : 'پاسخ‌ها روی همین دستگاه ذخیره می‌شوند. برنامهٔ نهایی پس از بررسی متخصص ارائه خواهد شد.',
          ),
        ],
      ),
    };
    return PopScope<void>(
      canPop: !saving && !widget.onboarding && step == 0,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) back();
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(widget.editing ? 'اطلاعات فردی' : 'کمی از خودت بگو'),
          leading: IconButton(
            tooltip: 'بازگشت',
            onPressed: saving ? null : back,
            icon: const Icon(Icons.arrow_back_rounded),
          ),
        ),
        bottomNavigationBar: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
            child: Row(
              children: [
                if (step > 0) ...[
                  OutlinedButton(
                    onPressed: saving ? null : () => moveTo(step - 1),
                    child: const Text('قبلی'),
                  ),
                  const SizedBox(width: 12),
                ],
                Expanded(
                  child: PrimaryButton(
                    saving
                        ? 'در حال ذخیره…'
                        : step == 5
                        ? (widget.onboarding
                              ? 'ثبت اطلاعات و ادامه'
                              : widget.editing
                              ? 'ذخیرهٔ تغییرات'
                              : 'ثبت اطلاعات')
                        : 'ادامه',
                    onPressed: saving ? null : () => next(store),
                  ),
                ),
              ],
            ),
          ),
        ),
        body: PageBody(
          controller: scroll,
          children: [
            Wrap(
              spacing: 10,
              runSpacing: 8,
              children: [
                Text(
                  'مرحلهٔ ${fa(step + 1)} از ۶',
                  style: const TextStyle(color: muted, fontSize: 12),
                ),
                Tag(widget.editing ? 'اصلاح اطلاعات قبلی' : 'مسیر مخصوص تو'),
              ],
            ),
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: LinearProgressIndicator(
                value: (step + 1) / 6,
                minHeight: 6,
                backgroundColor: sage,
              ),
            ),
            Heading(
              store.formConfiguration.sections[step],
              subtitle: widget.editing
                  ? 'جواب‌های قبلی آمادهٔ ویرایش هستند.'
                  : 'تا جای ممکن فقط گزینهٔ مناسب خودت رو انتخاب کن.',
            ),
            Form(
              key: form,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  content,
                  if (step < 5)
                    for (final question
                        in store.formConfiguration.extraQuestions(step))
                      ExtraQuestionField(
                        key: ValueKey(question.id),
                        question: question,
                        answers: q.extraAnswers,
                      ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
