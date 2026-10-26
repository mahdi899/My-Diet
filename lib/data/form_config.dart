enum QuestionKind { core, text, number, single, multiple }

class FormQuestion {
  FormQuestion({
    required this.id,
    required this.section,
    required this.title,
    this.kind = QuestionKind.core,
    this.requiredAnswer = false,
    this.enabled = true,
    this.helper = '',
    List<String>? options,
    Map<String, String>? choiceLabels,
  }) : options = options ?? [],
       choiceLabels = choiceLabels ?? {};
  final String id;
  int section;
  String title, helper;
  QuestionKind kind;
  bool requiredAnswer, enabled;
  List<String> options;
  Map<String, String> choiceLabels;
  bool get core => kind == QuestionKind.core;
  FormQuestion copy() => FormQuestion.fromJson(toJson());
  Map<String, Object?> toJson() => {
    'id': id,
    'section': section,
    'title': title,
    'helper': helper,
    'kind': kind.name,
    'required': requiredAnswer,
    'enabled': enabled,
    'options': options,
    'choiceLabels': choiceLabels,
  };
  factory FormQuestion.fromJson(Map<String, dynamic> j) => FormQuestion(
    id: j['id'] as String,
    section: j['section'] as int,
    title: j['title'] as String,
    helper: j['helper'] as String? ?? '',
    kind: QuestionKind.values.firstWhere(
      (v) => v.name == j['kind'],
      orElse: () => QuestionKind.text,
    ),
    requiredAnswer: j['required'] == true,
    enabled: j['enabled'] != false,
    options: (j['options'] as List? ?? []).whereType<String>().toList(),
    choiceLabels: Map<String, String>.from(j['choiceLabels'] as Map? ?? {}),
  );
}

class FormConfiguration {
  FormConfiguration({List<FormQuestion>? questions, List<String>? sections})
    : questions = questions ?? defaultQuestions(),
      sections = sections ?? List.of(defaultSections);
  final List<FormQuestion> questions;
  final List<String> sections;
  static const defaultSections = [
    'کمی با هم آشنا بشیم',
    'هدف و شرایط بدنی تو',
    'سلامت و محدودیت‌های پزشکی',
    'فعالیت و عادت‌های روزانه',
    'سلیقهٔ غذایی تو',
    'همه‌چیز درسته؟',
  ];
  static const labels = {
    'name': 'نام و نام خانوادگی',
    'age': 'سن / سال',
    'sex': 'جنسیت زیستی',
    'height': 'قد / سانتی‌متر',
    'weight': 'وزن / کیلوگرم',
    'goal': 'هدف اصلی تغذیه',
    'lifeStage': 'وضعیت بارداری یا شیردهی',
    'pregnancyWeek': 'هفتهٔ بارداری',
    'prePregnancyWeight': 'وزن پیش از بارداری / کیلوگرم',
    'babies': 'تعداد جنین',
    'nursingAge': 'سن کودک',
    'targetWeight': 'وزن هدف / کیلوگرم',
    'previousDiet': 'تجربهٔ قبلی رژیم',
    'health':
        'بیماری یا شرایطی که پزشک تشخیص داده را انتخاب کن؛ می‌توانی چند مورد را بزنی.',
    'healthDetails': 'توضیح شرایط و محدودیت‌های پزشک',
    'allergies': 'نام مادهٔ حساسیت‌زا و نوع واکنش',
    'medicines': 'نام داروها و مکمل‌ها و مقدار مصرف',
    'activity': 'میزان فعالیت روزانه',
    'exercise': 'تعداد جلسهٔ ورزش در هفته',
    'sleep': 'خواب معمول شبانه',
    'mealPattern': 'الگوی معمول غذاخوردن',
    'water': 'آب معمول در روز',
    'preference': 'الگوی غذای مورد علاقه',
    'budget': 'بودجهٔ تهیهٔ غذا',
    'cooking': 'زمان معمول آشپزی',
    'dislikes': 'غذاهای نامطلوب (اختیاری)',
  };
  static List<FormQuestion> defaultQuestions() {
    const groups = [
      ['name', 'age', 'sex', 'height', 'weight'],
      [
        'goal',
        'lifeStage',
        'pregnancyWeek',
        'prePregnancyWeight',
        'babies',
        'nursingAge',
        'targetWeight',
        'previousDiet',
      ],
      ['health', 'healthDetails', 'allergies', 'medicines'],
      ['activity', 'exercise', 'sleep', 'mealPattern', 'water'],
      ['preference', 'budget', 'cooking', 'dislikes'],
    ];
    const choices = {
      'sex': ['زن', 'مرد', 'ترجیح می‌دهم نگویم'],
      'goal': [
        'کاهش وزن',
        'افزایش وزن',
        'تثبیت وزن',
        'تغذیهٔ سالم',
        'تغذیهٔ ورزشی',
        'رژیم برای شرایط پزشکی',
      ],
      'lifeStage': [
        'هیچ‌کدام',
        'در حال اقدام به بارداری',
        'باردار هستم',
        'شیرده هستم',
        'ارتباطی ندارد',
      ],
      'babies': ['تک‌قلو', 'دوقلو یا بیشتر', 'هنوز مشخص نیست'],
      'nursingAge': ['کمتر از ۶ ماه', '۶ تا ۱۲ ماه', 'بیشتر از ۱۲ ماه'],
      'previousDiet': [
        'نداشته‌ام',
        'نتیجه گرفتم و حفظ کردم',
        'وزن دوباره برگشته',
        'ادامه‌دادن برایم سخت بود',
      ],
      'health': [
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
        'دیابت بارداری تشخیص‌داده‌شده',
        'بارداری پرخطر با نظر پزشک',
      ],
      'activity': ['بیشتر نشسته', 'فعالیت سبک', 'فعالیت متوسط', 'فعالیت زیاد'],
      'exercise': [
        'ورزش نمی‌کنم',
        '۱ تا ۲ جلسه',
        '۳ تا ۴ جلسه',
        '۵ جلسه یا بیشتر',
      ],
      'sleep': [
        'کمتر از ۵ ساعت',
        '۵ تا ۷ ساعت',
        '۷ تا ۹ ساعت',
        'بیشتر از ۹ ساعت',
      ],
      'mealPattern': [
        'سه وعدهٔ منظم',
        'بیشتر وعده‌ها را حذف می‌کنم',
        'ریزه‌خواری دارم',
        'غذاخوردن شبانه',
        'به‌دلیل شیفت کاری نامنظم است',
      ],
      'water': [
        'کمتر از ۴ لیوان',
        '۴ تا ۶ لیوان',
        '۷ تا ۹ لیوان',
        '۱۰ لیوان یا بیشتر',
      ],
      'preference': ['غذای ایرانی', 'ترکیبی', 'گیاه‌خواری', 'وگان'],
      'budget': ['اقتصادی', 'متوسط', 'آزاد'],
      'cooking': ['کمتر از ۳۰ دقیقه', '۳۰ تا ۶۰ دقیقه', 'محدودیت ندارم'],
    };
    return [
      for (var section = 0; section < groups.length; section++)
        for (final id in groups[section])
          FormQuestion(
            id: id,
            section: section,
            title: labels[id]!,
            options: List.of(choices[id] ?? []),
          ),
    ];
  }

  FormQuestion question(String id) => questions.firstWhere((q) => q.id == id);
  String label(String id, [String? fallback]) =>
      questions.where((q) => q.id == id).firstOrNull?.title ?? fallback ?? id;
  String choice(String id, String value) =>
      questions.where((q) => q.id == id).firstOrNull?.choiceLabels[value] ??
      value;
  String? helperForOriginal(String original) {
    final id = labels.entries
        .where((e) => e.value == original)
        .firstOrNull
        ?.key;
    if (id == null) return null;
    final value = question(id).helper;
    return value.isEmpty ? null : value;
  }

  String labelForOriginal(String original) {
    final id = labels.entries
        .where((e) => e.value == original)
        .firstOrNull
        ?.key;
    return id == null ? original : label(id, original);
  }

  Iterable<FormQuestion> extraQuestions(int section) =>
      questions.where((q) => !q.core && q.enabled && q.section == section);
  String? validateExtras(Map<String, dynamic> answers, {int? section}) {
    for (final q in questions.where(
      (q) => !q.core && q.enabled && (section == null || q.section == section),
    )) {
      final value = answers[q.id];
      final empty =
          value == null ||
          value is String && value.trim().isEmpty ||
          value is List && value.isEmpty;
      if (empty) {
        if (q.requiredAnswer) return 'پاسخ «${q.title}» را تکمیل کن.';
        continue;
      }
      if (q.kind == QuestionKind.single &&
          (value is! String || !q.options.contains(value))) {
        return 'گزینهٔ «${q.title}» را دوباره انتخاب کن.';
      }
      if (q.kind == QuestionKind.multiple &&
          (value is! List || value.any((v) => !q.options.contains(v)))) {
        return 'گزینه‌های «${q.title}» را دوباره انتخاب کن.';
      }
      if (q.kind == QuestionKind.text && value is! String) {
        return 'پاسخ «${q.title}» را دوباره وارد کن.';
      }
      if (q.kind == QuestionKind.number) {
        final n = double.tryParse(
          value
              .toString()
              .replaceAllMapped(
                RegExp('[۰-۹]'),
                (m) => '${'۰۱۲۳۴۵۶۷۸۹'.indexOf(m[0]!)}',
              )
              .replaceAll('٫', '.'),
        );
        if (n == null || !n.isFinite) {
          return 'برای «${q.title}» عدد معتبر وارد کن.';
        }
      }
    }
    return null;
  }

  Map<String, String> extraSummary(Map<String, dynamic> answers) => {
    for (final q in questions.where((q) => !q.core && q.enabled))
      if (answers[q.id] != null)
        q.title: answers[q.id] is List
            ? (answers[q.id] as List).join('، ')
            : answers[q.id].toString(),
  };
  bool get valid =>
      sections.length == 6 &&
      sections.every((v) => v.trim().isNotEmpty) &&
      questions.map((q) => q.id).toSet().length == questions.length &&
      questions.every(
        (q) =>
            q.section >= 0 &&
            q.section < 5 &&
            q.title.trim().isNotEmpty &&
            (q.kind != QuestionKind.single && q.kind != QuestionKind.multiple ||
                q.options.length >= 2 &&
                    q.options.toSet().length == q.options.length),
      );
  FormConfiguration copy() => FormConfiguration.fromJson(toJson());
  Map<String, Object?> toJson() => {
    'sections': sections,
    'questions': questions.map((q) => q.toJson()).toList(),
  };
  factory FormConfiguration.fromJson(Map<String, dynamic> j) {
    final incoming = (j['questions'] as List? ?? [])
        .map((q) => FormQuestion.fromJson(Map<String, dynamic>.from(q as Map)))
        .toList();
    final merged =
        defaultQuestions()
            .map(
              (q) =>
                  incoming.where((v) => v.id == q.id && v.core).firstOrNull ??
                  q,
            )
            .toList()
          ..addAll(incoming.where((q) => !q.core && !labels.containsKey(q.id)));
    return FormConfiguration(
      questions: merged,
      sections: (j['sections'] as List? ?? defaultSections)
          .cast<String>()
          .toList(),
    );
  }
}
