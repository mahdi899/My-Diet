import 'weekly_feedback.dart';
export 'weekly_feedback.dart';
import 'shopping_list.dart';
export 'shopping_list.dart';
import 'dart:convert';
import 'meal_plan.dart';
import 'meal_fixtures.dart';
export 'meal_plan.dart';
import 'package:flutter/foundation.dart';
import 'wallet_catalog.dart';
import 'package:flutter/material.dart';
import 'questionnaire_storage.dart';
import 'nutrition_log_storage.dart';
import 'day.dart';
import 'wallet_state_storage.dart';
import 'session_storage.dart';
import 'customer_auth.dart';
import 'form_config.dart';
import 'workspace_settings_storage.dart';
import 'messaging.dart';
import 'streak_campaign.dart';
import 'journey_analytics.dart';
import '../domain/commerce/commerce.dart';
import '../domain/plan/plan.dart';
import 'session/services.dart';

enum AppRole { user, expert, admin }

enum EntryStage { roles, onboarding, login, home }

extension RoleLabel on AppRole {
  String get label => switch (this) {
    AppRole.user => 'کاربر',
    AppRole.expert => 'متخصص',
    AppRole.admin => 'مدیر',
  };
}

enum PlanStatus { incomplete, queued, generating, reviewing, needsInfo, ready }

extension StatusLabel on PlanStatus {
  String get label => switch (this) {
    PlanStatus.incomplete => 'اطلاعات ناقص',
    PlanStatus.queued => 'درخواست ثبت شد',
    PlanStatus.generating => 'آماده‌سازی برنامه',
    PlanStatus.reviewing => 'در حال بررسی متخصص',
    PlanStatus.needsInfo => 'منتظر پاسخ کاربر',
    PlanStatus.ready => 'برنامه آماده است',
  };
}

String fa(Object value) => value.toString().replaceAllMapped(
  RegExp(r'\d'),
  (m) => '۰۱۲۳۴۵۶۷۸۹'[int.parse(m[0]!)],
);
String latinDigits(String value) => value
    .replaceAllMapped(RegExp('[۰-۹٠-٩]'), (m) {
      final digit = '۰۱۲۳۴۵۶۷۸۹'.indexOf(m[0]!);
      return '${digit >= 0 ? digit : '٠١٢٣٤٥٦٧٨٩'.indexOf(m[0]!)}';
    })
    .replaceAll('٫', '.');

class QuestionnaireData {
  static const goals = {
    'کاهش وزن',
    'افزایش وزن',
    'تثبیت وزن',
    'تغذیهٔ سالم',
    'تغذیهٔ ورزشی',
    'رژیم برای شرایط پزشکی',
  };
  QuestionnaireData();
  QuestionnaireData.empty() {
    name = age = height = weight = goal = activity = preference = sex =
        lifeStage = '';
    health.clear();
    babies = exercise = sleep = mealPattern = water = previousDiet = '';
  }
  String name = 'سارا احمدی', age = '۲۸', height = '۱۶۵', weight = '۷۲';
  String goal = 'تغذیهٔ سالم',
      targetWeight = '',
      sex = 'زن',
      lifeStage = 'هیچ‌کدام';
  String pregnancyWeek = '',
      prePregnancyWeight = '',
      babies = 'تک‌قلو',
      nursingAge = '';
  String healthDetails = '',
      medicines = '',
      allergies = '',
      previousDiet = 'نداشته‌ام';
  String activity = 'فعالیت سبک',
      exercise = '۱ تا ۲ جلسه',
      sleep = '۷ تا ۹ ساعت';
  String mealPattern = 'سه وعدهٔ منظم',
      water = '۴ تا ۶ لیوان',
      preference = 'غذای ایرانی';
  String budget = 'متوسط', cooking = 'کمتر از ۳۰ دقیقه', dislikes = '';
  final Set<String> health = {'موردی ندارم'};
  bool consent = false;
  final Map<String, dynamic> extraAnswers = {};
  bool get pregnant => lifeStage == 'باردار هستم';
  bool get weightGoal => goal == 'کاهش وزن' || goal == 'افزایش وزن';
  QuestionnaireData copy() => QuestionnaireData.fromJson(toJson());
  void copyFrom(QuestionnaireData other) {
    final copy = other.toJson();
    name = other.name;
    age = other.age;
    height = other.height;
    weight = other.weight;
    goal = other.goal;
    activity = other.activity;
    preference = other.preference;
    targetWeight = other.targetWeight;
    sex = other.sex;
    lifeStage = other.lifeStage;
    pregnancyWeek = other.pregnancyWeek;
    prePregnancyWeight = other.prePregnancyWeight;
    babies = other.babies;
    nursingAge = other.nursingAge;
    healthDetails = other.healthDetails;
    medicines = other.medicines;
    allergies = other.allergies;
    previousDiet = other.previousDiet;
    exercise = other.exercise;
    sleep = other.sleep;
    mealPattern = other.mealPattern;
    water = other.water;
    budget = other.budget;
    cooking = other.cooking;
    dislikes = other.dislikes;
    consent = other.consent;
    extraAnswers
      ..clear()
      ..addAll(
        jsonDecode(jsonEncode(other.extraAnswers)) as Map<String, dynamic>,
      );
    health
      ..clear()
      ..addAll((copy['health'] as List).cast<String>());
  }

  static double? number(String v) => double.tryParse(latinDigits(v.trim()));
  bool get hasBasicAnswers =>
      name.trim().isNotEmpty &&
      [age, height, weight].every(
        (v) => number(v) != null && number(v)! > 0 && number(v)! <= 500,
      ) &&
      goal.isNotEmpty &&
      health.isNotEmpty &&
      activity.isNotEmpty &&
      preference.isNotEmpty &&
      consent;
  bool get isComplete =>
      hasBasicAnswers &&
      goals.contains(goal) &&
      (targetWeight.trim().isEmpty ||
          (number(targetWeight) != null &&
              number(targetWeight)! > 0 &&
              number(targetWeight)! <= 500)) &&
      (!pregnant || babies.isNotEmpty) &&
      (lifeStage != 'شیرده هستم' || nursingAge.isNotEmpty) &&
      [
        exercise,
        sleep,
        mealPattern,
        water,
        previousDiet,
      ].every((v) => v.isNotEmpty) &&
      sex.isNotEmpty &&
      lifeStage.isNotEmpty &&
      (health.contains('موردی ندارم') || healthDetails.trim().isNotEmpty) &&
      (!health.contains('حساسیت غذایی دارم') || allergies.trim().isNotEmpty) &&
      (!health.contains('دارو مصرف می‌کنم') || medicines.trim().isNotEmpty) &&
      (!pregnant ||
          (number(pregnancyWeek) != null &&
              number(pregnancyWeek)! >= 1 &&
              number(pregnancyWeek)! <= 42 &&
              number(pregnancyWeek)! ==
                  number(pregnancyWeek)!.roundToDouble() &&
              number(prePregnancyWeight) != null &&
              number(prePregnancyWeight)! > 0 &&
              number(prePregnancyWeight)! <= 500)) &&
      (!(weightGoal && !pregnant) ||
          (number(targetWeight) != null &&
              number(targetWeight)! > 0 &&
              number(targetWeight)! <= 500 &&
              (goal == 'کاهش وزن'
                  ? number(targetWeight)! < number(weight)!
                  : number(targetWeight)! > number(weight)!)));
  Map<String, Object?> toJson() => {
    'name': name.trim(),
    'age': age.trim(),
    'height': height.trim(),
    'weight': weight.trim(),
    'goal': goal,
    'targetWeight': targetWeight.trim(),
    'sex': sex,
    'lifeStage': lifeStage,
    'pregnancyWeek': pregnancyWeek,
    'prePregnancyWeight': prePregnancyWeight,
    'babies': babies,
    'nursingAge': nursingAge,
    'health': health.toList(),
    'healthDetails': healthDetails.trim(),
    'medicines': medicines.trim(),
    'allergies': allergies.trim(),
    'previousDiet': previousDiet,
    'activity': activity,
    'exercise': exercise,
    'sleep': sleep,
    'mealPattern': mealPattern,
    'water': water,
    'preference': preference,
    'budget': budget,
    'cooking': cooking,
    'dislikes': dislikes.trim(),
    'consent': consent,
    'extraAnswers': extraAnswers,
  };
  factory QuestionnaireData.fromJson(Map<String, dynamic> json) {
    final q = QuestionnaireData.empty();
    String text(String k, [String d = '']) =>
        json[k] is String ? json[k] as String : d;
    q.name = text('name');
    q.age = text('age');
    q.height = text('height');
    q.weight = text('weight');
    q.goal = switch (text('goal')) {
      'تغذیهٔ متعادل' => 'تغذیهٔ سالم',
      'بهبود عادت غذایی' => 'تغذیهٔ سالم',
      final v => v,
    };
    q.targetWeight = text('targetWeight');
    q.sex = text('sex');
    q.lifeStage = text('lifeStage');
    q.pregnancyWeek = text('pregnancyWeek');
    q.prePregnancyWeight = text('prePregnancyWeight');
    q.babies = text('babies', 'تک‌قلو');
    q.nursingAge = text('nursingAge');
    q.healthDetails = text('healthDetails');
    q.medicines = text('medicines');
    q.allergies = text('allergies');
    if (json['health'] is List) {
      q.health.addAll((json['health'] as List).whereType<String>());
    }
    q.previousDiet = text('previousDiet');
    q.activity = text('activity');
    q.exercise = text('exercise');
    q.sleep = text('sleep');
    q.mealPattern = text('mealPattern');
    q.water = text('water');
    q.preference = text('preference');
    q.budget = text('budget', 'متوسط');
    q.cooking = text('cooking', 'کمتر از ۳۰ دقیقه');
    q.dislikes = text('dislikes');
    q.consent = json['consent'] == true;
    if (json['extraAnswers'] is Map) {
      q.extraAnswers.addAll(
        jsonDecode(jsonEncode(json['extraAnswers'])) as Map<String, dynamic>,
      );
    }
    return q;
  }
  Map<String, String> get summary => {
    'نام': name,
    'سن': '$age سال',
    'جنسیت': sex,
    'قد': '$height سانتی‌متر',
    'وزن فعلی': '$weight کیلوگرم',
    'هدف': goal,
    if (targetWeight.isNotEmpty)
      'وزن هدف پیشنهادی شما': '$targetWeight کیلوگرم',
    'شرایط': lifeStage,
    if (pregnant) ...{
      'هفتهٔ بارداری': pregnancyWeek,
      'وزن پیش از بارداری': '$prePregnancyWeight کیلوگرم',
      'تعداد جنین': babies,
    },
    if (lifeStage == 'شیرده هستم') 'سن کودک': nursingAge,
    'سلامت': health.join('، '),
    if (healthDetails.isNotEmpty) 'توضیحات سلامت': healthDetails,
    if (medicines.isNotEmpty) 'دارو و مکمل': medicines,
    if (allergies.isNotEmpty) 'حساسیت و واکنش': allergies,
    'فعالیت': activity,
    'ورزش در هفته': exercise,
    'خواب': sleep,
    'الگوی وعده‌ها': mealPattern,
    'آب در روز': water,
    'سابقهٔ رژیم': previousDiet,
    'سلیقهٔ غذایی': preference,
    'بودجه': budget,
    'زمان آشپزی': cooking,
    if (dislikes.isNotEmpty) 'غذاهای نامطلوب': dislikes,
  };
}

// UI fixtures. The energy and portions below are examples, not patient prescriptions.
List<Meal> sampleMeals([int day = 0, bool withAlternatives = true]) {
  const breakfasts = [
    (
      'نان سبوس‌دار و تخم‌مرغ',
      'نان سنگک: ۶۰ گرم (حدود ۲ کف دست بدون انگشت)\nتخم‌مرغ آب‌پز: ۲ عدد متوسط\nخیار و گوجه: ۱ لیوان خردشده\nگردو: ۲ عدد کامل',
      440,
    ),
    (
      'جو دوسر با شیر و موز',
      'جو دوسر خشک: ۵۰ گرم (نصف پیمانه)\nشیر: ۱ لیوان ۲۴۰ میلی‌لیتری\nموز: ۱ عدد کوچک\nدارچین: به مقدار دلخواه',
      430,
    ),
    (
      'نان و پنیر و گردو',
      'نان سبوس‌دار: ۷۰ گرم\nپنیر: ۴۰ گرم (بیشتر از ۱ قوطی کبریت)\nگردو: ۳ عدد کامل\nسبزی خوردن: ۱ لیوان',
      450,
    ),
    (
      'عدسی با نان',
      'عدس پخته: ۱ پیمانه ۲۰۰ گرمی\nنان سبوس‌دار: ۴۰ گرم\nروغن زیتون: ۱ قاشق چای‌خوری\nآب‌لیمو: ۱ قاشق غذاخوری',
      420,
    ),
    (
      'املت گوجه با نان',
      'تخم‌مرغ: ۲ عدد\nگوجه: ۲ عدد متوسط\nروغن: ۱ قاشق چای‌خوری\nنان سبوس‌دار: ۶۰ گرم',
      460,
    ),
    (
      'ماست و جو و میوه',
      'ماست ساده: ۱ لیوان ۲۴۰ گرمی\nجو دوسر: ۴۰ گرم\nسیب: ۱ عدد کوچک\nبادام: ۱۰ عدد',
      410,
    ),
    (
      'ساندویچ تخم‌مرغ',
      'نان سبوس‌دار: ۷۰ گرم\nتخم‌مرغ: ۲ عدد\nپنیر: ۲۰ گرم\nگوجه و کاهو: نصف لیوان',
      470,
    ),
  ];
  const lunches = [
    (
      'مرغ و برنج با سبزیجات',
      'برنج پخته: ۱ پیمانه (حدود ۱۵۰ گرم)\nسینهٔ مرغ پخته: ۱۲۰ گرم\nسبزیجات بخارپز: ۱ لیوان\nروغن زیتون: ۱ قاشق غذاخوری',
      650,
    ),
    (
      'خوراک لوبیا و سیب‌زمینی',
      'لوبیای پخته: ۱ پیمانه ۲۰۰ گرمی\nسیب‌زمینی: ۱ عدد متوسط ۱۵۰ گرمی\nنان: ۴۰ گرم\nروغن: ۲ قاشق چای‌خوری',
      620,
    ),
    (
      'ماهی و سبزی‌پلو',
      'ماهی پخته: ۱۵۰ گرم\nسبزی‌پلوی پخته: ۱ پیمانه ۱۵۰ گرمی\nسالاد: ۱ لیوان\nروغن زیتون: ۲ قاشق چای‌خوری',
      640,
    ),
    (
      'خورش قیمه با برنج',
      'خورش قیمه: ۱ پیمانه ۲۰۰ گرمی\nبرنج پخته: ۱ پیمانه ۱۵۰ گرمی\nسالاد بدون سس: ۱ لیوان',
      670,
    ),
    (
      'عدس‌پلو با گوشت',
      'عدس‌پلوی پخته: ۱.۵ پیمانه (۲۲۵ گرم)\nگوشت پخته: ۷۰ گرم\nماست ساده: نصف لیوان',
      660,
    ),
    (
      'پاستا با مرغ و سبزیجات',
      'پاستای پخته: ۱.۵ پیمانه (۲۱۰ گرم)\nمرغ پخته: ۱۰۰ گرم\nسبزیجات: ۱ لیوان\nروغن زیتون: ۲ قاشق چای‌خوری',
      680,
    ),
    (
      'خوراک گوشت و سبزیجات',
      'گوشت پخته: ۱۲۰ گرم\nسیب‌زمینی پخته: ۲۰۰ گرم\nسبزیجات: ۱ لیوان\nنان: ۴۰ گرم\nروغن: ۱ قاشق چای‌خوری',
      630,
    ),
  ];
  const snacks = [
    (
      'سیب و بادام',
      'سیب: ۱ عدد متوسط (۱۵۰ گرم)\nبادام خام: ۱۵ عدد (۲۰ گرم)',
      210,
    ),
    ('ماست و میوه', 'ماست ساده: ۱ لیوان (۲۴۰ گرم)\nتوت‌فرنگی: نصف لیوان', 190),
    ('شیر و خرما', 'شیر: ۱ لیوان (۲۴۰ میلی‌لیتر)\nخرما: ۳ عدد کوچک', 220),
    ('پرتقال و پسته', 'پرتقال: ۱ عدد متوسط\nپستهٔ بدون پوست: ۲۰ گرم', 200),
    ('گلابی و گردو', 'گلابی: ۱ عدد متوسط\nگردو: ۳ عدد کامل', 230),
    (
      'موز و کرهٔ بادام‌زمینی',
      'موز: ۱ عدد کوچک\nکرهٔ بادام‌زمینی: ۱ قاشق غذاخوری (۱۵ گرم)',
      210,
    ),
    ('میوه و ماست', 'سیب: ۱ عدد کوچک\nماست ساده: سه‌چهارم لیوان', 180),
  ];
  const dinners = [
    (
      'سالاد مرغ و نان',
      'مرغ پخته: ۹۰ گرم\nکاهو و خیار و گوجه: ۲ لیوان\nنان سبوس‌دار: ۶۰ گرم\nروغن زیتون: ۲ قاشق چای‌خوری',
      490,
    ),
    (
      'سوپ جو و مرغ',
      'سوپ جو و مرغ: ۲ لیوان (۴۸۰ میلی‌لیتر)\nنان سبوس‌دار: ۵۰ گرم\nماست: نصف لیوان',
      460,
    ),
    (
      'کوکو سبزی و نان',
      'کوکو سبزی: ۲ برش (۱۵۰ گرم)\nنان سبوس‌دار: ۵۰ گرم\nسالاد: ۱ لیوان',
      480,
    ),
    (
      'خوراک نخود و سبزیجات',
      'نخود پخته: ۱ پیمانه (۱۶۰ گرم)\nسبزیجات پخته: ۱ لیوان\nنان: ۴۰ گرم\nروغن: ۱ قاشق چای‌خوری',
      450,
    ),
    (
      'ساندویچ مرغ خانگی',
      'مرغ پخته: ۹۰ گرم\nنان سبوس‌دار: ۸۰ گرم\nکاهو و گوجه: ۱ لیوان\nماست ساده برای سس: ۲ قاشق غذاخوری',
      470,
    ),
    (
      'سیب‌زمینی و تخم‌مرغ',
      'سیب‌زمینی آب‌پز: ۲۰۰ گرم\nتخم‌مرغ: ۲ عدد\nسبزیجات: ۱ لیوان\nروغن زیتون: ۱ قاشق چای‌خوری',
      460,
    ),
    (
      'آش رشتهٔ خانگی',
      'آش رشته: ۱.۵ لیوان (۳۶۰ میلی‌لیتر)\nکشک: ۲ قاشق غذاخوری\nنان: ۳۰ گرم',
      500,
    ),
  ];
  final b = breakfasts[day % 7],
      l = lunches[day % 7],
      s = snacks[day % 7],
      d = dinners[day % 7];
  return [
    Meal(
      name: 'صبحانه',
      title: b.$1,
      time: '۸:۰۰',
      amount: b.$2,
      details:
          'مقدارها برای همین وعده هستند؛ وزن مواد پخته است مگر اینکه خلاف آن نوشته شده باشد.',
      kind: 1,
      calories: b.$3,
    ),
    Meal(
      name: 'ناهار',
      title: l.$1,
      time: '۱۳:۳۰',
      amount: l.$2,
      details: 'برای اندازه‌گیری دقیق‌تر از ترازو و پیمانه استفاده کن.',
      kind: 0,
      calories: l.$3,
    ),
    Meal(
      name: 'میان‌وعده',
      title: s.$1,
      time: '۱۶:۳۰',
      amount: s.$2,
      details: 'اندازهٔ میوه و مغزها را مطابق همین فهرست در نظر بگیر.',
      kind: 2,
      calories: s.$3,
    ),
    Meal(
      name: 'شام',
      title: d.$1,
      time: '۱۹:۳۰',
      amount: d.$2,
      details: 'مقدار مواد و روغن این وعده در فهرست زیر آمده است.',
      kind: 0,
      calories: d.$3,
    ),
  ].asMap().entries.map((entry) {
    final meal = enrichDemoMeal(entry.value);
    if (!withAlternatives) return meal;
    return meal.copyWith(
      alternatives: [
        MealAlternative(
          id: 'ai',
          source: AlternativeSource.ai,
          meal: sampleMeals(day + 1, false)[entry.key],
          approved: true,
          reviewedBy: 'demo-specialist',
          reviewedAt: DateTime(2026, 10, 24),
        ),
        MealAlternative(
          id: 'specialist',
          source: AlternativeSource.specialist,
          meal: sampleMeals(day + 2, false)[entry.key],
          approved: true,
          reviewedBy: 'demo-specialist',
          reviewedAt: DateTime(2026, 10, 24),
        ),
      ],
    );
  }).toList();
}

class DietRequest {
  DietRequest({
    required this.id,
    required this.name,
    required this.goal,
    required this.status,
    this.specialist = 'دکتر نازنین رضایی',
    this.wait = '۲ ساعت',
    this.priority = false,
  }) : draft = sampleMeals();
  final String id;
  String name, goal, specialist, wait;
  PlanStatus status;
  bool priority;
  bool revisionRequested = false;
  bool revisionAwaitingUser = false;
  String revisionMessage = '', revisionReply = '';
  String revisionReason = '', revisionDetails = '', question = '';
  String infoAnswer = '';
  bool infoAnswerReviewed = false;
  bool get canApproveInformation =>
      !revisionAwaitingUser &&
      (question.isEmpty
          ? status != PlanStatus.needsInfo
          : infoAnswer.isNotEmpty && infoAnswerReviewed);
  DateTime? programStartsOn;
  DateTime? programWeek;

  String draftNote =
      'اگر تهیهٔ غذایی برات سخت بود، از متخصص دربارهٔ جایگزین بپرس.';
  String publishedNote = '';
  FoodPreferences? preferenceSnapshot;
  Map<String, dynamic> questionnaireSnapshot = {};
  List<Meal> draft;
  List<Meal> published = [];
  final List<List<Meal>> draftOtherDays = List.generate(
    6,
    (i) => sampleMeals(i + 1),
  );
  List<List<Meal>> publishedOtherDays = [];
  List<Meal> draftForDay(int day) => day == 0 ? draft : draftOtherDays[day - 1];
  List<Meal> mealsForDay(int day) => day == 0
      ? published
      : (publishedOtherDays.length == 6
            ? publishedOtherDays[day - 1]
            : <Meal>[]);
  int version = 0;
  bool get isPublished =>
      published.isNotEmpty || publishedOtherDays.any((day) => day.isNotEmpty);
}

class ChatMessage {
  const ChatMessage(
    this.text,
    this.sender, {
    this.support = false,
    this.threadId = '',
  });
  final String text;
  final AppRole sender;
  final bool support;
  final String threadId;
}

class ProgramReview {
  ProgramReview({
    required this.id,
    required this.authorName,
    required this.text,
    this.approved = false,
    this.rating = 5,
    this.requestId = '',
    this.weekKey = '',
  });
  final String id;
  final String authorName;
  String text;
  bool approved;
  bool rejected = false;
  final int rating;
  final String requestId, weekKey;
}

class ExpertRecord {
  ExpertRecord(
    this.name,
    this.specialty,
    this.active,
    this.capacity, {
    this.medicalCode = '',
    this.address = '',
    this.clinicPhone = '',
    this.mobile = '',
    this.city = '',
    this.degree = '',
    this.experience = '',
    this.hours = '',
    this.bio = '',
  });
  String name,
      specialty,
      medicalCode,
      address,
      clinicPhone,
      mobile,
      city,
      degree,
      experience,
      hours,
      bio;
  bool active;
  int capacity;
  ExpertRecord copy() => ExpertRecord.fromJson(toJson());
  Map<String, Object?> toJson() => {
    'name': name,
    'specialty': specialty,
    'active': active,
    'capacity': capacity,
    'medicalCode': medicalCode,
    'address': address,
    'clinicPhone': clinicPhone,
    'mobile': mobile,
    'city': city,
    'degree': degree,
    'experience': experience,
    'hours': hours,
    'bio': bio,
  };
  factory ExpertRecord.fromJson(Map<String, dynamic> j) => ExpertRecord(
    j['name'] as String,
    j['specialty'] as String,
    j['active'] == true,
    j['capacity'] as int? ?? 10,
    medicalCode: j['medicalCode'] as String? ?? '',
    address: j['address'] as String? ?? '',
    clinicPhone: j['clinicPhone'] as String? ?? '',
    mobile: j['mobile'] as String? ?? '',
    city: j['city'] as String? ?? '',
    degree: j['degree'] as String? ?? '',
    experience: j['experience'] as String? ?? '',
    hours: j['hours'] as String? ?? '',
    bio: j['bio'] as String? ?? '',
  );
}

class ChatThread {
  ChatThread(this.id, this.patientName, {this.support = false});
  final String id;
  String patientName;
  final bool support;
}

/// Demo UI data. Only the questionnaire has optional local persistence; no backend.
class DemoStore extends ChangeNotifier {
  final messaging = DemoMessaging();
  final journey = JourneyAnalytics();
  DemoStore({
    QuestionnaireStorage? storage,
    NutritionLogStorage? nutritionStorage,
    WeeklyFeedbackRepository? feedbackRepository,
    WalletStateStorage? walletStorage,
    SessionStorage? sessionStorage,
    this.customerAuth,
    WorkspaceSettingsStorage? settingsStorage,
    DateTime Function()? clock,
  }) : _sessionStorage = sessionStorage,
       _walletStorage = walletStorage,
       _storage = storage,
       _settingsStorage = settingsStorage,
       _nutritionStorage = nutritionStorage,
       feedbackRepository =
           feedbackRepository ?? MemoryWeeklyFeedbackRepository(),
       _clock = clock ?? DateTime.now {
    final approved = requests[4];
    approved.published = List.unmodifiable(approved.draft);
    approved.publishedOtherDays = List.generate(
      6,
      (i) => List<Meal>.unmodifiable(approved.draftOtherDays[i]),
    );
    approved.publishedNote = approved.draftNote;
    approved.version = 1;
    approved.programWeek = startOfWeek(today);
    approved.programStartsOn = startOfWeek(today);
    request('1040').question = 'ساعت معمول شام و داروهای مصرفی خود را بنویس.';
    requests.last.revisionRequested = true;
    requests.last.revisionReason = 'زمان تهیهٔ غذاها زیاده';
  }
  final WorkspaceSettingsStorage? _settingsStorage;
  int newPlanPrice = 500000,
      aiRevisionPrice = 150000,
      expertRevisionPrice = 250000;
  int weeklyRewardToman = 200000;
  StreakRewardServer? _streakServer;
  StreakRewardServer get streakServer => _streakServer ??= StreakRewardServer(
    campaign: StreakCampaign(
      version: 1,
      consecutiveDays: 7,
      milestones: [StreakMilestone(day: 7, amountToman: weeklyRewardToman)],
      effectiveOn: DateTime(2026, 1, 1),
    ),
  );
  final Set<String> _qualifiedDays = {};
  StreakProgress get streakProgress => streakServer.progress;
  List<PlanServiceOffer> get serviceOffers => planServiceOffers
      .map(
        (offer) => PlanServiceOffer(
          id: offer.id,
          title: offer.title,
          subtitle: offer.subtitle,
          icon: offer.icon,
          successLine: offer.successLine,
          priceToman: switch (offer.id) {
            'new-plan' => newPlanPrice,
            'ai-change' => aiRevisionPrice,
            _ => expertRevisionPrice,
          },
        ),
      )
      .toList();
  PlanServiceOffer? serviceById(String? id) {
    for (final offer in serviceOffers) {
      if (offer.id == id) return offer;
    }
    return null;
  }

  Future<void> savePricing({
    required int plan,
    required int ai,
    required int expert,
    required int reward,
  }) async {
    if (plan <= 0 || ai <= 0 || expert <= 0 || reward < 0) {
      throw StateError('مبلغ‌ها را بررسی کن.');
    }
    final snapshot = settingsSnapshot();
    snapshot['pricing'] = {
      'plan': plan,
      'ai': ai,
      'expert': expert,
      'reward': reward,
    };
    await _settingsStorage?.write(jsonEncode(snapshot));
    newPlanPrice = plan;
    aiRevisionPrice = ai;
    expertRevisionPrice = expert;
    weeklyRewardToman = reward;
    streakServer.noteAmount(reward);
    update();
  }

  /// Publishes a new campaign version. A user already inside a cycle keeps the old one.
  void publishStreakCampaign({
    required int consecutiveDays,
    required List<StreakMilestone> milestones,
    required DateTime effectiveOn,
    DateTime? endsOn,
    String repeat = 'cycle',
  }) {
    streakServer.publish(
      StreakCampaign(
        version: 0,
        consecutiveDays: consecutiveDays,
        milestones: milestones,
        effectiveOn: effectiveOn,
        endsOn: endsOn,
        repeat: repeat,
      ),
    );
    update();
  }

  FormConfiguration formConfiguration = FormConfiguration();
  Map<String, Object?> settingsSnapshot({
    FormConfiguration? form,
    ExpertRecord? expert,
  }) => {
    'version': 1,
    'pricing': {
      'plan': newPlanPrice,
      'ai': aiRevisionPrice,
      'expert': expertRevisionPrice,
      'reward': weeklyRewardToman,
    },
    'form': (form ?? formConfiguration).toJson(),
    'expert': (expert ?? experts.first).toJson(),
  };
  Future<void> restoreWorkspaceSettings() async {
    try {
      final raw = await _settingsStorage?.read();
      if (raw == null) return;
      final data = jsonDecode(raw);
      if (data is! Map<String, dynamic> || data['version'] != 1) return;
      if (data['pricing'] is Map) {
        final p = data['pricing'] as Map;
        if (p['plan'] is int && p['plan'] > 0) newPlanPrice = p['plan'];
        if (p['ai'] is int && p['ai'] > 0) aiRevisionPrice = p['ai'];
        if (p['expert'] is int && p['expert'] > 0) {
          expertRevisionPrice = p['expert'];
        }
        if (p['reward'] is int && p['reward'] >= 0) {
          weeklyRewardToman = p['reward'];
        }
      }
      if (data['form'] is Map) {
        final form = FormConfiguration.fromJson(
          Map<String, dynamic>.from(data['form'] as Map),
        );
        if (form.valid) formConfiguration = form;
      }
      if (data['expert'] is Map) {
        _applyExpert(
          ExpertRecord.fromJson(
            Map<String, dynamic>.from(data['expert'] as Map),
          ),
        );
      }
      if (questionnaireComplete &&
          formConfiguration.validateExtras(questionnaire.extraAnswers) !=
              null) {
        questionnaireComplete = false;
        questionnaireNeedsReview = true;
      }
      update();
    } catch (_) {
      debugPrint('Workspace settings restore unavailable.');
    }
  }

  Future<void> saveFormConfiguration(FormConfiguration next) async {
    final copy = next.copy();
    if (!copy.valid) throw StateError('سؤال‌ها و گزینه‌ها را بررسی کن.');
    await _settingsStorage?.write(jsonEncode(settingsSnapshot(form: copy)));
    formConfiguration = copy;
    if (questionnaire.hasBasicAnswers) {
      questionnaireComplete =
          questionnaire.isComplete &&
          copy.validateExtras(questionnaire.extraAnswers) == null;
      questionnaireNeedsReview = !questionnaireComplete;
    }
    update();
  }

  void _applyExpert(ExpertRecord next) {
    final previous = experts.first.name;
    experts[0] = next.copy();
    for (final r in requests) {
      if (r.specialist == previous) r.specialist = next.name;
    }
  }

  Future<void> saveExpertProfile(ExpertRecord next) async {
    final copy = next.copy();
    await _settingsStorage?.write(jsonEncode(settingsSnapshot(expert: copy)));
    _applyExpert(copy);
    update();
  }

  ExpertRecord? get assignedDoctor {
    if (userRequestId == null) return experts.firstOrNull;
    return experts.where((e) => e.name == userRequest.specialist).firstOrNull;
  }

  final chatThreads = <ChatThread>[
    ChatThread('user-main', 'سارا احمدی'),
    ChatThread('patient-amir', 'امیر حسینی'),
    ChatThread('patient-neda', 'ندا محمدی'),
    ChatThread('support-main', 'سارا احمدی', support: true),
    ChatThread('support-amir', 'امیر حسینی', support: true),
  ];
  final Map<AppRole, Set<ChatMessage>> _seenMessages = {};
  String messageThread(ChatMessage m) => m.threadId.isNotEmpty
      ? m.threadId
      : (m.support ? 'support-main' : 'user-main');
  List<ChatMessage> threadMessages(String id) =>
      messages.where((m) => messageThread(m) == id).toList();
  ChatThread thread(String id) => chatThreads.firstWhere((t) => t.id == id);
  // Local UI conversations. Reuse a patient's thread, or start an empty one.
  ChatThread conversationForRequest(String requestId) {
    final r = request(requestId);
    if (userRequestIds.contains(requestId) || requestId == userRequestId) {
      return thread('user-main');
    }
    final stableId = 'patient-request-$requestId';
    final existing = chatThreads.where((t) => t.id == stableId).firstOrNull;
    if (existing != null) return existing;
    final matching = chatThreads
        .where((t) => !t.support && patientName(t) == r.name)
        .firstOrNull;
    if (matching != null) return matching;
    final created = ChatThread(stableId, r.name);
    chatThreads.add(created);
    update();
    return created;
  }

  String patientName(ChatThread t) =>
      t.id == 'user-main' || t.id == 'support-main'
      ? questionnaire.name
      : t.patientName;
  String threadTitle(ChatThread t, AppRole role) => role == AppRole.user
      ? (t.support
            ? 'پشتیبانی رژیم من'
            : (hasUserRequest ? userRequest.specialist : experts.first.name))
      : patientName(t);
  bool incoming(ChatMessage m, AppRole role) => role == AppRole.user
      ? m.sender != AppRole.user
      : m.sender == AppRole.user;
  int unreadCount(ChatThread t, AppRole role) => threadMessages(t.id)
      .where(
        (m) =>
            incoming(m, role) && !(_seenMessages[role]?.contains(m) ?? false),
      )
      .length;
  void markThreadRead(String id, AppRole role) {
    (_seenMessages[role] ??= <ChatMessage>{}).addAll(threadMessages(id));
  }

  List<ChatThread> visibleThreads(AppRole role, {bool support = false}) {
    final result = chatThreads
        .where(
          (t) => role == AppRole.user
              ? (support
                    ? t.id == 'support-main'
                    : t.id == 'user-main' || t.id == 'support-main')
              : t.support == (role == AppRole.admin),
        )
        .toList();
    result.sort(
      (a, b) => messages
          .lastIndexWhere((m) => messageThread(m) == b.id)
          .compareTo(messages.lastIndexWhere((m) => messageThread(m) == a.id)),
    );
    return result;
  }

  List<ChatThread> receivedThreads(AppRole role, {bool support = false}) =>
      visibleThreads(role, support: support)
          .where((t) => threadMessages(t.id).any((m) => incoming(m, role)))
          .toList();

  final QuestionnaireStorage? _storage;
  final NutritionLogStorage? _nutritionStorage;
  final DateTime Function() _clock;
  DateTime get today => _clock();
  final Map<String, int> _mealCalories = {};
  final Map<String, Map<String, dynamic>> _consumptionDetails = {};
  Map<String, dynamic>? consumedMealOn(DateTime date, int index) {
    final prefix = '${dateKey(date)}|${userRequestId ?? 'none'}|$index|';
    final found = _consumptionDetails.entries.where(
      (e) => e.key.startsWith(prefix),
    );
    return found.isEmpty ? null : Map.unmodifiable(found.first.value);
  }

  bool savingMeal = false;
  String mealLogKey(DateTime date, int index) =>
      '${dateKey(date)}|${userRequestId ?? 'none'}|$index|${mealsOn(date)[index].title}|${mealsOn(date)[index].calories}';
  final Map<String, String> _selectedOptions = {};
  final List<MealSelection> _substitutionHistory = [];
  List<MealSelection> get substitutionHistory =>
      List.unmodifiable(_substitutionHistory);
  bool savingSubstitution = false;
  final Map<String, String> substitutionReasons = {
    'expensive': 'گران است',
    'dislike': 'دوست ندارم',
    'unavailable': 'مواد اولیه موجود نیست',
    'time': 'آماده‌سازی طولانی است',
    'other': 'سایر',
  };
  String selectionKey(DateTime date, int index) =>
      '$userRequestId|${userRequest.version}|${dateKey(date)}|$index';
  List<Meal> originalMealsOn(DateTime date) {
    // Sample patients (numeric ids) stay in the file for tests. A real session never shows them.
    if (serverAuthEnabled && int.tryParse(userRequestId ?? '') != null) {
      return const [];
    }
    if (userRequestId == null || !userRequest.isPublished) return const [];
    final week = userRequest.programWeek;
    if (week == null || dateKey(startOfWeek(date)) != dateKey(week)) {
      return const [];
    }
    return userRequest.mealsForDay(weekDayIndex(date));
  }

  Meal originalMealOn(DateTime date, int index) => originalMealsOn(date)[index];
  String selectedOptionOn(DateTime date, int index) =>
      _selectedOptions[selectionKey(date, index)] ?? 'original';
  List<MealAlternative> alternativesOn(DateTime date, int index) {
    final all = originalMealOn(
      date,
      index,
    ).alternatives.where((a) => a.available).toList();
    // Customer UI: one specialist-approved swap; AI draft stays for workspace checks.
    final approved = all
        .where((a) => a.source == AlternativeSource.specialist)
        .toList();
    return approved.isNotEmpty ? approved : all.take(1).toList();
  }

  bool canSubstituteOn(DateTime date) =>
      originalMealsOn(date).isNotEmpty &&
      dateKey(date).compareTo(dateKey(today)) >= 0;
  List<Meal> mealsOn(DateTime date) =>
      originalMealsOn(date).asMap().entries.map((entry) {
        final option = selectedOptionOn(date, entry.key);
        final alternatives = entry.value.alternatives.where(
          (a) => a.id == option && a.available,
        );
        return alternatives.isEmpty
            ? entry.value
            : alternatives.first.meal.copyWith(
                name: entry.value.name,
                time: entry.value.time,
              );
      }).toList();
  Future<bool> substituteMeal(
    DateTime date,
    int index,
    String optionId,
    String reasonId, {
    String explanation = '',
    bool confirmConsumed = false,
  }) async {
    if (savingSubstitution || savingMeal || savingShopping) return false;
    if (!canSubstituteOn(date) ||
        index < 0 ||
        index >= originalMealsOn(date).length) {
      throw StateError(
        'تغییر فقط برای روزهای باقی‌مانده همین برنامه مجاز است.',
      );
    }
    if (selectedOptionOn(date, index) == optionId) return false;
    if (mealEaten(date, index) && !confirmConsumed) {
      throw StateError('تغییر وعده مصرف‌شده نیاز به تأیید دارد.');
    }
    if (dateKey(date) == dateKey(today) &&
        !substitutionReasons.containsKey(reasonId)) {
      throw StateError('دلیل جایگزینی را انتخاب کن.');
    }
    if (explanation.length > 500) {
      throw StateError('توضیحات حداکثر ۵۰۰ نویسه باشد.');
    }
    final original = originalMealOn(date, index);
    final options = original.alternatives.where(
      (a) => a.id == optionId && a.available,
    );
    if (optionId != 'original' && options.length != 1) {
      throw StateError('این جایگزین تأیید نشده یا اطلاعاتش ناقص است.');
    }
    final selected = optionId == 'original' ? original : options.single.meal;
    final key = selectionKey(date, index);
    final record = MealSelection(
      key: key,
      optionId: optionId,
      previousOptionId: selectedOptionOn(date, index),
      reasonId: reasonId,
      reasonLabel: substitutionReasons[reasonId] ?? '',
      explanation: explanation.trim(),
      at: today,
      foodTitle: selected.title,
    );
    final next = {..._selectedOptions, key: optionId};
    final history = [..._substitutionHistory, record];
    final before = {
      for (final row in shoppingList().rows)
        shoppingRowKey(row.ingredient): row,
    };
    final after = {
      for (final row in shoppingList(options: next).rows)
        shoppingRowKey(row.ingredient): row,
    };
    final changes = Map<String, Map<String, dynamic>>.of(_shoppingChanges);
    for (final rowKey in {...before.keys, ...after.keys}) {
      final oldQuantity = before[rowKey]?.quantity ?? 0,
          newQuantity = after[rowKey]?.quantity ?? 0;
      if ((oldQuantity - newQuantity).abs() < 1e-9) continue;
      final changeKey = '$shoppingContext|$rowKey';
      final previous = changes[changeKey]?['previous'] ?? oldQuantity;
      final ingredient = (after[rowKey] ?? before[rowKey])!.ingredient;
      if (((previous as num).toDouble() - newQuantity).abs() < 1e-9) {
        changes.remove(changeKey);
      } else {
        changes[changeKey] = {
          'name': ingredient.name,
          'unit': ingredient.unit,
          'basis': ingredient.basis,
          'previous': previous,
          'next': newQuantity,
        };
      }
    }
    savingSubstitution = true;
    update();
    try {
      await _nutritionStorage?.write(
        _nutritionSnapshot(
          options: next,
          history: history,
          shoppingChanges: changes,
        ),
      );
      _shoppingChanges
        ..clear()
        ..addAll(changes);
      _selectedOptions
        ..clear()
        ..addAll(next);
      _substitutionHistory
        ..clear()
        ..addAll(history);
      journey.record('alternative_selected', {'optionId': optionId});
      return true;
    } finally {
      savingSubstitution = false;
      update();
    }
  }

  String _nutritionSnapshot({
    Map<String, int>? meals,
    Map<String, String>? options,
    List<MealSelection>? history,
    Map<String, Map<String, dynamic>>? consumption,
    Map<String, ShoppingMark>? shoppingMarks,
    Map<String, Map<String, dynamic>>? shoppingChanges,
  }) => jsonEncode({
    'shoppingMarks': (shoppingMarks ?? _shoppingMarks).map(
      (key, value) => MapEntry(key, value.toJson()),
    ),
    'shoppingChanges': shoppingChanges ?? _shoppingChanges,
    'version': 2,
    'consumption': consumption ?? _consumptionDetails,
    'meals': meals ?? _mealCalories,
    'options': options ?? _selectedOptions,
    'history': (history ?? _substitutionHistory)
        .map((r) => r.toJson())
        .toList(),
  });
  final Map<String, ShoppingMark> _shoppingMarks = {};
  final Map<String, Map<String, dynamic>> _shoppingChanges = {};
  bool savingShopping = false;
  bool get hasActiveShoppingPlan =>
      hasUserRequest &&
      userRequest.isPublished &&
      userRequest.programWeek != null &&
      dateKey(userRequest.programWeek!) == dateKey(startOfWeek(today));
  String get shoppingContext =>
      '$userRequestId|${userRequest.version}|${dateKey(userRequest.programWeek!)}';
  ShoppingListData shoppingList({
    Iterable<DateTime>? dates,
    Map<String, String>? options,
  }) {
    if (!hasActiveShoppingPlan) return const ShoppingListData([], []);
    final week = userRequest.programWeek!;
    final days =
        (dates ??
                List.generate(
                  7,
                  (i) => DateTime(week.year, week.month, week.day + i),
                ))
            .map(dateKey)
            .toSet();
    final meals = <Meal>[];
    for (var day = 0; day < 7; day++) {
      final date = DateTime(week.year, week.month, week.day + day);
      if (!days.contains(dateKey(date))) continue;
      final originals = originalMealsOn(date);
      for (var i = 0; i < originals.length; i++) {
        final selected = (options ?? _selectedOptions)[selectionKey(date, i)];
        final matches = originals[i].alternatives.where(
          (a) => a.id == selected && a.available,
        );
        meals.add(matches.isEmpty ? originals[i] : matches.first.meal);
      }
    }
    return aggregateShoppingIngredients(meals);
  }

  List<ShoppingIngredient> shoppingIngredients({Iterable<DateTime>? dates}) =>
      shoppingList(dates: dates).rows;
  String _shoppingMarkKey(ShoppingIngredient row) =>
      '$shoppingContext|${shoppingRowKey(row.ingredient)}';
  ShoppingMark? shoppingMark(ShoppingIngredient row) =>
      _shoppingMarks[_shoppingMarkKey(row)];
  List<Map<String, dynamic>> get shoppingChanges => hasActiveShoppingPlan
      ? _shoppingChanges.entries
            .where((e) => e.key.startsWith('$shoppingContext|'))
            .map((e) => Map<String, dynamic>.unmodifiable(e.value))
            .toList()
      : [];
  Future<void> setShoppingMark(ShoppingIngredient row, String? status) async {
    if (savingShopping || savingMeal || savingSubstitution) {
      throw StateError('ذخیره دیگری در جریان است.');
    }
    if (!hasActiveShoppingPlan ||
        ![null, 'have', 'purchased'].contains(status)) {
      throw StateError('برنامه فعال یا وضعیت معتبر نیست.');
    }
    final current = shoppingList().rows.where(
      (r) => shoppingRowKey(r.ingredient) == shoppingRowKey(row.ingredient),
    );
    if (current.isEmpty ||
        row.quantity <= 0 ||
        row.quantity > current.first.quantity + 1e-9) {
      throw StateError('فهرست تغییر کرده؛ دوباره بررسی کن.');
    }
    final next = Map<String, ShoppingMark>.of(_shoppingMarks);
    final key = _shoppingMarkKey(row);
    if (status == null) {
      next.remove(key);
    } else {
      next[key] = ShoppingMark(status, row.quantity);
    }
    savingShopping = true;
    update();
    try {
      await _nutritionStorage?.write(_nutritionSnapshot(shoppingMarks: next));
      _shoppingMarks
        ..clear()
        ..addAll(next);
      await reportShopping?.call(row.ingredient.name, status);
    } finally {
      savingShopping = false;
      update();
    }
  }

  /// Copies a server shopping flag onto the local row with the same ingredient name.
  void applyRemoteShopping(
    String ingredientName, {
    required bool alreadyHave,
    required bool purchased,
  }) {
    if (!hasActiveShoppingPlan) return;
    final wanted = _shoppingName(ingredientName);
    ShoppingIngredient? row;
    for (final candidate in shoppingIngredients()) {
      if (_shoppingName(candidate.ingredient.name) == wanted) {
        row = candidate;
        break;
      }
    }
    if (row == null) return;
    final key = _shoppingMarkKey(row);
    final previous = reportShopping;
    reportShopping = null;
    if (purchased) {
      _shoppingMarks[key] = ShoppingMark('purchased', row.quantity);
    } else if (alreadyHave) {
      _shoppingMarks[key] = ShoppingMark('have', row.quantity);
    } else {
      _shoppingMarks.remove(key);
    }
    reportShopping = previous;
  }

  String _shoppingName(String value) => value
      .replaceAll('ي', 'ی')
      .replaceAll('ك', 'ک')
      .replaceAll(RegExp(r'\s+'), ' ')
      .trim();

  Future<void> acknowledgeShoppingChanges() async {
    if (!hasActiveShoppingPlan ||
        savingShopping ||
        savingMeal ||
        savingSubstitution) {
      return;
    }
    final next = Map<String, Map<String, dynamic>>.of(_shoppingChanges)
      ..removeWhere((key, _) => key.startsWith('$shoppingContext|'));
    savingShopping = true;
    update();
    try {
      await _nutritionStorage?.write(_nutritionSnapshot(shoppingChanges: next));
      _shoppingChanges
        ..clear()
        ..addAll(next);
    } finally {
      savingShopping = false;
      update();
    }
  }

  Map<String, dynamic>? mealRecordOn(DateTime date, int index) =>
      consumedMealOn(date, index);
  int recordedCount(DateTime date) => List.generate(
    mealsOn(date).length,
    (i) => i,
  ).where((i) => mealRecordOn(date, i) != null || mealEaten(date, i)).length;
  bool hasUnknownCalories(DateTime date) =>
      List.generate(mealsOn(date).length, (i) => i).any((i) {
        final record = mealRecordOn(date, i);
        return record != null &&
            record['mode'] != 'skipped' &&
            record['calories'] == null;
      });
  bool followedPlan(DateTime date, int index) {
    final record = mealRecordOn(date, index);
    return record == null
        ? mealEaten(date, index)
        : (record['mode'] == null || record['mode'] == 'according');
  }

  Future<void> recordMeal(
    DateTime date,
    int index,
    String mode, {
    String foodName = '',
    double? quantity,
    String unit = '',
  }) async {
    if (savingMeal || savingSubstitution || savingShopping) {
      throw StateError('ذخیره دیگری در جریان است.');
    }
    if (dateKey(date) != dateKey(today) ||
        index < 0 ||
        index >= mealsOn(date).length) {
      throw StateError('ثبت و اصلاح فقط برای امروز مجاز است.');
    }
    if (!['according', 'adjusted', 'different', 'skipped'].contains(mode)) {
      throw ArgumentError('وضعیت نامعتبر');
    }
    if (mode == 'adjusted' || mode == 'different') {
      if (quantity == null ||
          !quantity.isFinite ||
          quantity <= 0 ||
          quantity > 100000 ||
          unit.trim().isEmpty ||
          unit.length > 40) {
        throw ArgumentError('مقدار مثبت و واحد روشن وارد کن.');
      }
    }
    if (mode == 'different' &&
        (foodName.trim().isEmpty || foodName.length > 120)) {
      throw ArgumentError('نام غذا را وارد کن.');
    }
    final meal = mealsOn(date)[index], key = mealLogKey(date, index);
    final prefix = '${dateKey(date)}|${userRequestId ?? 'none'}|$index|';
    final next = Map<String, int>.of(_mealCalories)
      ..removeWhere((k, _) => k.startsWith(prefix));
    final details = Map<String, Map<String, dynamic>>.of(_consumptionDetails)
      ..removeWhere((k, _) => k.startsWith(prefix));
    // Only an exact approved portion has a known energy value. No arbitrary-food estimates.
    final int? calories = mode == 'according' && meal.calories > 0
        ? meal.calories
        : mode == 'skipped'
        ? 0
        : null;
    if (mode != 'skipped' && calories != null) next[key] = calories;
    details[key] = {
      'mode': mode,
      'title': mode == 'different' ? foodName.trim() : meal.title,
      'amount': mode == 'according'
          ? meal.amount
          : mode == 'skipped'
          ? 'این وعده مصرف نشد'
          : '$quantity ${unit.trim()}',
      'quantity': quantity,
      'unit': unit.trim(),
      'calories': calories,
      'optionId': selectedOptionOn(date, index),
      'recordedAt': today.toIso8601String(),
    };
    savingMeal = true;
    update();
    try {
      await _nutritionStorage?.write(
        _nutritionSnapshot(meals: next, consumption: details),
      );
      _mealCalories
        ..clear()
        ..addAll(next);
      _consumptionDetails
        ..clear()
        ..addAll(details);
      completedMeals
        ..clear()
        ..addAll(next.keys);
      if (mode != 'skipped') {
        journey.record('meal_recorded', {'mealId': '${dateKey(date)}|$index'});
      }
      _noteMealDay(date);
      claimWeeklyReward();
    } finally {
      savingMeal = false;
      update();
    }
  }

  /// Doctor-side daily target from the nutrition profile. Meal sums are only the fallback.
  int? liveTargetKcal;

  /// Latest `GET /v1/me/coach/today`, used so the ring matches the coach log.
  String? coachDay;
  int? coachConsumedKcal;
  int? coachTargetKcal;
  int? coachProtein;
  int? coachCarbs;
  int? coachFat;
  int? coachWaterGlasses;

  int calorieTarget(DateTime date) {
    if (coachDay == dateKey(date) &&
        coachTargetKcal != null &&
        coachTargetKcal! > 0) {
      return coachTargetKcal!;
    }
    final target = liveTargetKcal;
    if (target != null &&
        hasUserRequest &&
        userRequest.programWeek != null &&
        dateKey(startOfWeek(date)) == dateKey(userRequest.programWeek!)) {
      return target;
    }
    return mealsOn(date).fold(0, (n, m) => n + m.calories);
  }

  int consumedCalories(DateTime date) {
    if (coachDay == dateKey(date) && coachConsumedKcal != null) {
      return coachConsumedKcal!;
    }
    return _mealCalories.entries
        .where(
          (e) =>
              e.key.startsWith('${dateKey(date)}|${userRequestId ?? 'none'}|'),
        )
        .fold(0, (n, e) => n + e.value);
  }

  /// Copies a coach `today` payload into the ring, water and plan checkmarks.
  bool applyCoachToday(Map<String, dynamic> today) {
    final date = today['date'];
    if (date is! String || date.isEmpty) return false;
    coachDay = date;
    final calories = today['calories'];
    if (calories is Map) {
      final consumed = calories['consumed'];
      final target = calories['target'];
      if (consumed is num) coachConsumedKcal = consumed.round();
      if (target is num && target > 0) {
        coachTargetKcal = target.round();
        liveTargetKcal = target.round();
      }
    }
    final macros = today['macros'];
    if (macros is Map) {
      coachProtein = _coachMacro(macros['proteinG']);
      coachCarbs = _coachMacro(macros['carbsG']);
      coachFat = _coachMacro(macros['fatG']);
    }
    final water = today['water'];
    if (water is Map && water['ml'] is num) {
      coachWaterGlasses = ((water['ml'] as num) / 250).round();
    }
    _mirrorCoachPlan(date, today['planMeals']);
    final weight = today['weight'];
    if (weight is Map && weight['latestKg'] is num) {
      final kg = (weight['latestKg'] as num).toDouble();
      final stamp = weight['latestDate'];
      if (kg > 0 &&
          (stamp == null || stamp == date) &&
          (latestWeight - kg).abs() >= 0.05) {
        addWeight(kg);
        return true;
      }
    }
    update();
    return true;
  }

  int? _coachMacro(Object? value) {
    if (value is Map && value['consumed'] is num) {
      return (value['consumed'] as num).round();
    }
    return null;
  }

  void _mirrorCoachPlan(String date, Object? raw) {
    if (raw is! List) return;
    DateTime day;
    try {
      day = DateTime.parse(date);
    } catch (_) {
      return;
    }
    final prefix = '${dateKey(day)}|';
    for (final item in raw) {
      if (item is! Map) continue;
      final uid = item['mealUid']?.toString() ?? '';
      final state = item['state']?.toString() ?? 'unrecorded';
      if (uid.isEmpty || state == 'unrecorded' || state == 'skipped') continue;
      String? slot;
      for (final entry in serverMealUids.entries) {
        if (entry.value == uid && entry.key.startsWith(prefix)) {
          slot = entry.key;
          break;
        }
      }
      if (slot == null) continue;
      final index = int.tryParse(slot.split('|').last);
      if (index == null) continue;
      final dayMeals = mealsOn(day);
      if (index < 0 || index >= dayMeals.length) continue;
      final planned = item['plannedKcal'];
      final kcal = planned is num ? planned.round() : dayMeals[index].calories;
      final key = mealLogKey(day, index);
      _mealCalories[key] = kcal;
      completedMeals.add(key);
      _consumptionDetails[key] = {
        'mode': state == 'different' ? 'different' : 'according',
        'title': item['title'] ?? dayMeals[index].title,
        'calories': kcal,
      };
    }
  }
  bool mealEaten(DateTime date, int index) {
    final record = consumedMealOn(date, index);
    if (record != null) return record['mode'] != 'skipped';
    return _mealCalories.keys.any(
      (key) =>
          key.startsWith('${dateKey(date)}|${userRequestId ?? 'none'}|$index|'),
    );
  }

  int eatenCount(DateTime date) => List.generate(
    mealsOn(date).length,
    (i) => i,
  ).where((i) => followedPlan(date, i)).length;
  Future<void> restoreNutritionLog() async {
    try {
      final raw = await _nutritionStorage?.read();
      if (raw == null) return;
      final data = jsonDecode(raw);
      if (data is! Map<String, dynamic> ||
          ![1, 2].contains(data['version']) ||
          data['meals'] is! Map) {
        return;
      }
      final entries = (data['meals'] as Map).entries.where(
        (e) => e.key is String && e.value is int && (e.value as int) >= 0,
      );
      _mealCalories
        ..clear()
        ..addEntries(
          entries.map((e) => MapEntry(e.key as String, e.value as int)),
        );
      if (data['version'] == 2) {
        _shoppingMarks
          ..clear()
          ..addAll(
            (data['shoppingMarks'] as Map? ?? {}).map(
              (k, v) => MapEntry(
                k as String,
                ShoppingMark.fromJson(Map<String, dynamic>.from(v as Map)),
              ),
            ),
          );
        _shoppingChanges
          ..clear()
          ..addAll(
            (data['shoppingChanges'] as Map? ?? {}).map(
              (k, v) =>
                  MapEntry(k as String, Map<String, dynamic>.from(v as Map)),
            ),
          );
        _consumptionDetails
          ..clear()
          ..addAll(
            (data['consumption'] as Map? ?? {}).map(
              (k, v) =>
                  MapEntry(k as String, Map<String, dynamic>.from(v as Map)),
            ),
          );
        final options = Map<String, String>.from(data['options'] as Map? ?? {});
        final history = (data['history'] as List? ?? [])
            .map(
              (r) =>
                  MealSelection.fromJson(Map<String, dynamic>.from(r as Map)),
            )
            .toList();
        _selectedOptions
          ..clear()
          ..addAll(options);
        _substitutionHistory
          ..clear()
          ..addAll(history);
      }
      completedMeals
        ..clear()
        ..addAll(_mealCalories.keys);
      update();
    } catch (_) {
      debugPrint('Meal log restore unavailable.');
    }
  }

  Future<void> setMealEaten(DateTime date, int index, bool eaten) async {
    if (savingMeal || savingSubstitution || savingShopping) return;
    final meals = mealsOn(date);
    if (index < 0 || index >= meals.length) return;
    final key = mealLogKey(date, index),
        next = Map<String, int>.of(_mealCalories);
    final details = Map<String, Map<String, dynamic>>.of(_consumptionDetails);
    if (eaten && mealEaten(date, index)) return;
    if (eaten) {
      next[key] = meals[index].calories;
      details[key] = {
        'title': meals[index].title,
        'amount': meals[index].amount,
        'calories': meals[index].calories,
        'optionId': selectedOptionOn(date, index),
      };
    } else {
      next.removeWhere(
        (k, _) =>
            k.startsWith('${dateKey(date)}|${userRequestId ?? 'none'}|$index|'),
      );
    }
    if (!eaten) {
      details.removeWhere(
        (k, _) =>
            k.startsWith('${dateKey(date)}|${userRequestId ?? 'none'}|$index|'),
      );
    }
    savingMeal = true;
    update();
    try {
      await _nutritionStorage?.write(
        _nutritionSnapshot(meals: next, consumption: details),
      );
      _consumptionDetails
        ..clear()
        ..addAll(details);
      _mealCalories
        ..clear()
        ..addAll(next);
      completedMeals
        ..clear()
        ..addAll(next.keys);
      if (eaten) {
        journey.record('meal_recorded', {'mealId': '${dateKey(date)}|$index'});
      }
      _noteMealDay(date);
      claimWeeklyReward();
      final uid = serverMealUids['${dateKey(date)}|$index'];
      if (uid != null) await reportEaten?.call(uid, eaten);
    } finally {
      savingMeal = false;
      update();
    }
  }

  /// Records a server meal so the existing checkbox and the API stay on the same bite.
  void rememberServerMeal({
    required DateTime date,
    required int index,
    required String uid,
    required bool eaten,
    required int calories,
  }) {
    serverMealUids['${dateKey(date)}|$index'] = uid;
    if (!eaten) return;
    final key = mealLogKey(date, index);
    _mealCalories[key] = calories;
    completedMeals.add(key);
  }

  bool questionnaireNeedsReview = false;
  final questionnaire = QuestionnaireData();

  /// Restore only this app's questionnaire key. Demo plans stay in memory.
  Future<void> restoreQuestionnaire() async {
    try {
      final raw = await _storage?.read();
      if (raw == null) return;
      final json = jsonDecode(raw);
      if (json is! Map<String, dynamic> ||
          json['version'] != 1 ||
          json['completed'] != true ||
          json['answers'] is! Map<String, dynamic>) {
        return;
      }
      final restored = QuestionnaireData.fromJson(
        json['answers'] as Map<String, dynamic>,
      );
      if (!restored.hasBasicAnswers) return;
      latestWeight = double.parse(latinDigits(restored.weight));
      questionnaire.copyFrom(restored);
      questionnaireComplete =
          restored.isComplete &&
          formConfiguration.validateExtras(restored.extraAnswers) == null;
      questionnaireNeedsReview = !questionnaireComplete;
      if (userRequestId != null) {
        userRequest.name = restored.name;
        userRequest.goal = restored.goal;
      }
      update();
    } catch (error) {
      // A missing/corrupt local preference must not block opening the app.
      debugPrint('Questionnaire restore unavailable (${error.runtimeType}).');
    }
  }

  /// Commit only after storage succeeds; cancellation never changes the profile.
  Future<void> saveQuestionnaire(
    QuestionnaireData answers, {
    required bool onboarding,
  }) async {
    final snapshot = answers.copy();
    if (!snapshot.isComplete ||
        formConfiguration.validateExtras(snapshot.extraAnswers) != null) {
      throw StateError('اطلاعات ضروری پرسش‌نامه کامل نشده است.');
    }
    await _storage?.write(
      jsonEncode({
        'version': 1,
        'completed': true,
        'answers': snapshot.toJson(),
      }),
    );
    if (!questionnaireComplete || questionnaire.weight != snapshot.weight) {
      latestWeight = double.parse(latinDigits(snapshot.weight));
    }
    questionnaire.copyFrom(snapshot);
    questionnaireNeedsReview = false;
    questionnaireComplete = true;
    journey.record('questionnaire_completed', {'schemaVersion': '1'});
    update();
  }

  // Mock wallet stored on this device only; no backend or real payment.
  final WalletStateStorage? _walletStorage;
  Future<void> _walletWrites = Future<void>.value();
  final Set<String> rewardedWeeks = {};
  final Set<String> completedProgramIds = {};
  final Map<String, int> rewardAmounts = {};
  int rewardForWeek(String week) => rewardAmounts[week] ?? weeklyRewardToman;
  final List<String> pendingWeeklyRewards = [];

  Future<void> restoreWalletState() async {
    try {
      final raw = await _walletStorage?.read();
      if (raw == null) return;
      final data = jsonDecode(raw) as Map<String, dynamic>;
      if (data['version'] != 1 ||
          data['balance'] is! int ||
          (data['balance'] as int) < 0) {
        return;
      }
      walletBalance = data['balance'] as int;
      rewardedWeeks.addAll(
        (data['rewardedWeeks'] as List? ?? []).whereType<String>().where(
          (week) => DateTime.tryParse(week) != null,
        ),
      );
      if (data['rewardAmounts'] is Map) {
        for (final entry in (data['rewardAmounts'] as Map).entries) {
          if (entry.key is String && entry.value is int) {
            rewardAmounts[entry.key] = entry.value;
          }
        }
      }
      pendingWeeklyRewards.addAll(
        (data['pendingRewards'] as List? ?? []).whereType<String>().where(
          rewardedWeeks.contains,
        ),
      );
      _walletSequence = data['sequence'] as int? ?? 0;
      for (final raw in (data['transactions'] as List? ?? [])) {
        final t = raw as Map<String, dynamic>;
        walletTransactions.add(
          MockWalletTransaction(
            operationId: t['id'] as String,
            title: t['title'] as String,
            amountToman: t['amountToman'] as int,
            balanceAfter: t['balanceAfter'] as int,
            credit: t['credit'] == true,
          ),
        );
        _appliedWalletOperations.add(t['id'] as String);
      }
      update();
    } catch (_) {
      debugPrint('Mock wallet restore unavailable.');
    }
  }

  Future<void> saveWalletState() {
    final snapshot = jsonEncode({
      'version': 1,
      'balance': walletBalance,
      'sequence': _walletSequence,
      'rewardedWeeks': rewardedWeeks.toList(),
      'rewardAmounts': rewardAmounts,
      'pendingRewards': pendingWeeklyRewards,
      'transactions': walletTransactions
          .map(
            (t) => {
              'id': t.operationId,
              'title': t.title,
              'amountToman': t.amountToman,
              'balanceAfter': t.balanceAfter,
              'credit': t.credit,
            },
          )
          .toList(),
    });
    _walletWrites = _walletWrites
        .then((_) async {
          await _walletStorage?.write(snapshot);
        })
        .catchError((Object e) {
          debugPrint('Mock wallet save unavailable.');
        });
    return _walletWrites;
  }

  List<DateTime> get scheduledWeekDates {
    if (!hasUserRequest || !userRequest.isPublished) return [];
    final r = userRequest, start = r.programWeek ?? startOfWeek(today);
    final first = r.programStartsOn ?? start;
    return List.generate(
      7,
      (i) => DateTime(start.year, start.month, start.day + i),
    ).where((date) => !date.isBefore(first)).toList();
  }

  bool dayCompleted(DateTime date) {
    final meals = mealsOn(date);
    return meals.isNotEmpty && eatenCount(date) == meals.length;
  }

  int get completedProgramDays => scheduledWeekDates.where(dayCompleted).length;
  bool get weeklyProgramCompleted {
    final dates = scheduledWeekDates;
    return dates.isNotEmpty &&
        !dates.last.isAfter(DateTime(today.year, today.month, today.day)) &&
        dates.every(dayCompleted);
  }

  int get weeklyStreak {
    final weeks = rewardedWeeks.toList()..sort();
    if (weeks.isEmpty) return 0;
    var previous = DateTime.parse(weeks.last), count = 1;
    if (startOfWeek(today).difference(previous).inDays > 7) return 0;
    for (final key in weeks.reversed.skip(1)) {
      final week = DateTime.parse(key);
      if (previous.difference(week).inDays != 7) break;
      count++;
      previous = week;
    }
    return count;
  }

  void _noteMealDay(DateTime date) {
    final key = dateKey(date);
    if (dayCompleted(date)) {
      _qualifiedDays.add(key);
    } else {
      _qualifiedDays.remove(key);
    }
  }

  /// Asks the reward server to settle. Recording meals is the only qualifying activity.
  bool claimWeeklyReward() {
    if (!hasUserRequest || !userRequest.isPublished) return false;
    final anchor = userRequest.programWeek ?? startOfWeek(today);
    final joined = userRequest.programStartsOn ?? anchor;
    final day = DateTime(today.year, today.month, today.day);
    final partial = <String>{};
    final todayKey = dateKey(day);
    if (!_qualifiedDays.contains(todayKey) && eatenCount(day) > 0) {
      partial.add(todayKey);
    }
    final result = streakServer.settle(
      today: day,
      cycleAnchor: anchor,
      participationStart: joined,
      qualifiedDates: _qualifiedDays,
      partialDates: partial,
      claim: true,
    );
    var credited = false;
    for (final grant in result.grants) {
      final operationId = grant.day == result.requiredDays
          ? 'weekly-reward-${grant.weekKey}'
          : 'weekly-reward-${grant.weekKey}-d${grant.day}';
      if (walletTransactions.any((item) => item.operationId == operationId)) {
        continue;
      }
      walletBalance += grant.amountToman;
      if (grant.day == result.requiredDays) {
        rewardedWeeks.add(grant.weekKey);
        rewardAmounts[grant.weekKey] = grant.amountToman;
        if (!pendingWeeklyRewards.contains(grant.weekKey)) {
          pendingWeeklyRewards.add(grant.weekKey);
        }
        completedProgramIds.add(userRequest.id);
      }
      walletTransactions.insert(
        0,
        MockWalletTransaction(
          operationId: operationId,
          title: 'پاداش ${fa(grant.day)} روز پیاپی',
          amountToman: grant.amountToman,
          balanceAfter: walletBalance,
          credit: true,
        ),
      );
      credited = true;
    }
    if (credited) saveWalletState();
    update();
    return credited;
  }

  void acknowledgeWeeklyReward(String week) {
    pendingWeeklyRewards.remove(week);
    saveWalletState();
    update();
  }

  int walletBalance = kInitialWalletBalance;
  String? selectedPlanServiceId, selectedChargeId;
  bool walletPurchaseBusy = false, walletPricingOpen = false;
  int _walletSequence = 0;
  final Set<String> _appliedWalletOperations = {};
  final List<MockWalletTransaction> walletTransactions = [];
  String nextWalletOperationId() => 'mock-wallet-${++_walletSequence}';
  bool canAfford(int amount) => amount > 0 && walletBalance >= amount;
  bool tryPurchasePlanService(String serviceId, {String? operationId}) {
    final offer = serviceById(serviceId),
        key = operationId ?? nextWalletOperationId();
    if (walletPurchaseBusy ||
        offer == null ||
        !canAfford(offer.priceToman) ||
        _appliedWalletOperations.contains(key)) {
      return false;
    }
    walletPurchaseBusy = true;
    try {
      walletBalance -= offer.priceToman;
      _appliedWalletOperations.add(key);
      walletTransactions.insert(
        0,
        MockWalletTransaction(
          operationId: key,
          title: offer.title,
          amountToman: offer.priceToman,
          balanceAfter: walletBalance,
          credit: false,
        ),
      );
      if (offer.id == 'new-plan') {
        submitQuestionnaire();
      } else if (hasUserRequest) {
        userRequest.revisionRequested = true;
        userRequest.revisionAwaitingUser = false;
        userRequest.revisionMessage = '';
        userRequest.revisionReply = '';
        userRequest.revisionReason = offer.id == 'ai-change'
            ? 'تغییر برنامه با هوش مصنوعی'
            : 'تغییر برنامه با متخصص';
        userRequest.revisionDetails =
            'درخواست نمایشی با پرداخت ${formatMoneyNumber(offer.priceToman)} تومان ثبت شد.';
      }
      saveWalletState();
      notices.insert(0, '${offer.successLine} (نمایشی)');
      return true;
    } finally {
      walletPurchaseBusy = false;
      update();
    }
  }

  bool addWalletCredit(int amountToman, {String? operationId}) {
    final key = operationId ?? nextWalletOperationId();
    if (amountToman <= 0 || _appliedWalletOperations.contains(key)) {
      return false;
    }
    _appliedWalletOperations.add(key);
    walletBalance += amountToman;
    walletTransactions.insert(
      0,
      MockWalletTransaction(
        operationId: key,
        title: 'شارژ نمایشی کیف پول',
        amountToman: amountToman,
        balanceAfter: walletBalance,
        credit: true,
      ),
    );
    saveWalletState();
    update();
    return true;
  }

  bool completeMockPayment(String packageId, String attemptId) {
    final offer = walletChargeById(packageId);
    if (offer == null) return false;
    final result = addWalletCredit(offer.amountToman, operationId: attemptId);
    if (result) {
      selectedChargeId = null;
      update();
    }
    return result;
  }

  void setDebugWalletBalance(int value) {
    if (!kDebugMode || value < 0) return;
    walletBalance = value;
    saveWalletState();
    update();
  }

  void resetWalletDebug() => setDebugWalletBalance(kInitialWalletBalance);

  AppRole? role = AppRole.user;
  AppRole? selectedRole = AppRole.user;
  EntryStage entryStage = EntryStage.home;
  final CustomerAuth? customerAuth;
  bool get serverAuthEnabled => customerAuth != null;
  String? sessionError;

  Future<void> requestLoginCode(String phone) async {
    if (customerAuth != null) await customerAuth!.requestCode(phone);
  }

  Future<void> verifyLoginCode(String phone, String code) async {
    if (customerAuth == null) {
      if (code != '123456') throw const AuthFailure('کد نمونه ۱۲۳۴۵۶ است.');
      login(AppRole.user, phone: phone);
      return;
    }
    final session = await customerAuth!.verify(phone, code);
    _applyServerSession(session, phone: phone);
    if (pendingPlanAcquisition && !questionnaireComplete) {
      entryStage = EntryStage.onboarding;
    }
    update();
  }

  void _applyServerSession(CustomerSession session, {String? phone}) {
    _userAuthenticated = true;
    sessionIssuedAt = today;
    sessionExpiresAt = session.expiresAt;
    if (phone != null) sessionPhone = phone;
    sessionError = null;
    role = selectedRole = AppRole.user;
    entryStage = EntryStage.home;
  }

  Future<void> refreshServerSession() async {
    if (customerAuth == null) return;
    try {
      final session = await customerAuth!.restore();
      if (session == null) {
        _userAuthenticated = false;
        sessionIssuedAt = sessionExpiresAt = null;
      } else {
        _applyServerSession(session);
      }
      sessionError = null;
    } catch (error) {
      sessionError = error.toString();
      // Block private screens until the server session can be checked.
      _userAuthenticated = false;
    }
    update();
  }

  Future<void> signOutCustomer() async {
    if (customerAuth != null) await customerAuth!.logout();
    logout();
  }

  final SessionStorage? _sessionStorage;
  Future<void> _sessionWrites = Future<void>.value();
  DateTime? sessionIssuedAt, sessionExpiresAt;
  String sessionPhone = '';
  bool _userAuthenticated = false;
  bool get userSignedIn =>
      _userAuthenticated &&
      sessionExpiresAt != null &&
      today.isBefore(sessionExpiresAt!);
  bool pendingPlanAcquisition = false;

  Future<void> saveUserSession() {
    if (serverAuthEnabled) return Future<void>.value();
    final issued = sessionIssuedAt,
        expires = sessionExpiresAt,
        phone = sessionPhone;
    final snapshot = issued == null || expires == null
        ? null
        : jsonEncode({
            'version': 1,
            'issuedAt': issued.toUtc().toIso8601String(),
            'expiresAt': expires.toUtc().toIso8601String(),
            'phone': phone,
          });
    _sessionWrites = _sessionWrites
        .then((_) async {
          if (snapshot == null) {
            await _sessionStorage?.clear();
          } else {
            await _sessionStorage?.write(snapshot);
          }
        })
        .catchError((Object e) {
          debugPrint('Demo session save unavailable.');
        });
    return _sessionWrites;
  }

  Future<void> restoreUserSession() async {
    if (serverAuthEnabled) {
      await refreshServerSession();
      return;
    }
    try {
      final raw = await _sessionStorage?.read();
      if (raw == null) return;
      final data = jsonDecode(raw) as Map<String, dynamic>;
      final issued = DateTime.tryParse(data['issuedAt'] as String? ?? '');
      final expires = DateTime.tryParse(data['expiresAt'] as String? ?? '');
      if (data['version'] != 1 ||
          issued == null ||
          expires == null ||
          issued.isAfter(today) ||
          !today.isBefore(expires) ||
          expires.difference(issued) != const Duration(days: 30)) {
        await _sessionStorage?.clear();
        return;
      }
      sessionIssuedAt = issued;
      sessionExpiresAt = expires;
      sessionPhone = data['phone'] as String? ?? '';
      _userAuthenticated = true;
      role = selectedRole = AppRole.user;
      entryStage = EntryStage.home;
      update();
    } catch (_) {
      debugPrint('Demo session restore unavailable.');
    }
  }

  void startPlanAcquisition() {
    pendingPlanAcquisition = true;
    selectedRole = AppRole.user;
    if (!userSignedIn) {
      openUserLogin();
      return;
    }
    if (!questionnaireComplete) {
      role = AppRole.user;
      entryStage = EntryStage.onboarding;
      update();
    }
  }

  void completeUserOnboarding() {
    if (!userSignedIn) {
      openUserLogin();
      return;
    }
    role = selectedRole = AppRole.user;
    entryStage = EntryStage.home;
    update();
  }

  void cancelUserEntry() {
    pendingPlanAcquisition = false;
    role = selectedRole = AppRole.user;
    entryStage = EntryStage.home;
    update();
  }

  void showRoleSelection() {
    pendingPlanAcquisition = false;
    role = null;
    selectedRole = null;
    entryStage = EntryStage.roles;
    update();
  }

  String? userRequestId;
  final userRequestIds = <String>{};
  bool notificationsEnabled = true;
  bool mealReminders = false;
  bool questionnaireComplete = false;

  /// Real sessions stay on the sign-in gate until the server plan is loaded.
  bool liveReady = false;

  /// Keeps the login screen under an in-app signup questionnaire until that route closes.
  bool suppressLiveEntry = false;
  String? profilePhoto;

  /// Meal uid per civil date and index, so "خوردم" updates the server plan.
  final serverMealUids = <String, String>{};
  Future<void> Function(String uid, bool eaten)? reportEaten;

  /// Shared server clients for this signed-in session. Null in fixture mode.
  Services? liveServices;
  List<InfoQuestion> liveOpenQuestions = [];
  List<TopupPackage> liveTopups = [];
  ShoppingList? liveShopping;
  String? liveOrderKey;
  String? liveNotice;

  /// Pushes a shopping tick to the server. Null in fixture mode.
  Future<void> Function(String ingredientName, String? status)? reportShopping;
  double latestWeight = 72;
  final List<DateTime> weightDates = [];
  List<DateTime> get weightEntryDates =>
      weightDates.length == weightEntries.length
      ? weightDates
      : List.generate(
          weightEntries.length,
          (i) => DateTime(
            today.year,
            today.month,
            today.day - (weightEntries.length - 1 - i) * 7,
          ),
        );
  final weightEntries = <double>[73.1, 72.8, 72.6, 72.2, 72];
  final completedMeals = <String>{}, completedHabits = <String>{};
  String feedback = '';
  final notices = <String>[
    'متخصص بررسی پرونده‌ات را شروع کرده.',
    'به رژیم من خوش اومدی.',
  ];
  final messages = <ChatMessage>[
    const ChatMessage(
      'سارا جان سلام. اگر دربارهٔ سلیقه یا تهیهٔ غذا نکته‌ای هست، برام بنویس.',
      AppRole.expert,
    ),
    const ChatMessage(
      'سلام، ترجیح می‌دم غذاها ساده و کم‌هزینه باشن.',
      AppRole.user,
    ),
    const ChatMessage('حتماً، در بررسی برنامه در نظر می‌گیرم.', AppRole.expert),
    const ChatMessage(
      'سلام، چطور می‌تونیم کمکت کنیم؟',
      AppRole.admin,
      support: true,
    ),
    const ChatMessage(
      'برای وعدهٔ ناهار جایگزین ساده‌تری می‌خواهم.',
      AppRole.user,
      threadId: 'patient-amir',
    ),
    const ChatMessage(
      'امروز پیاده‌روی را شروع کردم؛ زمان میان‌وعده مناسب است؟',
      AppRole.user,
      threadId: 'patient-neda',
    ),
    const ChatMessage(
      'نسخهٔ برنامه‌ام را در بخش برنامه نمی‌بینم.',
      AppRole.user,
      support: true,
      threadId: 'support-main',
    ),
    const ChatMessage(
      'لطفاً زمان بررسی درخواستم را پیگیری کنید.',
      AppRole.user,
      support: true,
      threadId: 'support-amir',
    ),
  ];
  final requests = <DietRequest>[
    DietRequest(
      id: '1042',
      name: 'سارا احمدی',
      goal: 'تغذیهٔ متعادل',
      status: PlanStatus.reviewing,
    ),
    DietRequest(
      id: '1041',
      name: 'امیر حسینی',
      goal: 'مدیریت وزن',
      status: PlanStatus.queued,
      wait: '۳ ساعت',
      priority: true,
    ),
    DietRequest(
      id: '1040',
      name: 'مریم کریمی',
      goal: 'بهبود عادت غذایی',
      status: PlanStatus.needsInfo,
      wait: '۱۹ ساعت',
    ),
    DietRequest(
      id: '1039',
      name: 'رضا موسوی',
      goal: 'تغذیهٔ متعادل',
      status: PlanStatus.reviewing,
      wait: '۲۱ ساعت',
    ),
    DietRequest(
      id: '1038',
      name: 'نگار محمدی',
      goal: 'مدیریت وزن',
      status: PlanStatus.ready,
      wait: '۱ روز',
    ),
    DietRequest(
      id: '1037',
      name: 'علی شریفی',
      goal: 'تغذیهٔ متعادل',
      status: PlanStatus.reviewing,
      wait: '۲ روز',
    ),
  ];
  final programReviews = <ProgramReview>[
    ProgramReview(
      id: 'rev-1',
      authorName: 'نگار محمدی',
      text:
          'برنامهٔ هفتگی خیلی منظم بود و مقدارها برای آشپزخانهٔ خانگی قابل‌اجرا بود.',
      approved: true,
    ),
    ProgramReview(
      id: 'rev-2',
      authorName: 'امیر حسینی',
      text: 'پیگیری متخصص و امکان اصلاح برنامه حس خوبی می‌دهد.',
      approved: true,
    ),
    ProgramReview(
      id: 'rev-3',
      authorName: 'مریم کریمی',
      text: 'دوست دارم بعد از تأیید، خلاصهٔ هفتگی هم در خانه دیده شود.',
      approved: false,
    ),
  ];
  int _reviewSeq = 4;
  final experts = <ExpertRecord>[
    ExpertRecord(
      'دکتر نازنین رضایی',
      'تغذیه و رژیم‌درمانی',
      true,
      10,
      medicalCode: '۱۲۳۴۵۶',
      address: 'خیابان نمونه، ساختمان سلامت، طبقهٔ دوم',
      clinicPhone: '۰۲۱۰۰۰۰۰۰۰۰',
      mobile: '۰۹۱۲۰۰۰۰۰۰۰',
      city: 'تهران',
      degree: 'دکترای تخصصی تغذیه',
      experience: '۸',
      hours: 'شنبه تا چهارشنبه، ۱۶ تا ۲۰',
      bio: 'همراه شما برای ساختن عادت‌های غذایی پایدار.',
    ),
  ];
  final supportTickets = <Map<String, String>>[
    {
      'title': 'دریافت نسخهٔ برنامه',
      'name': 'سارا احمدی',
      'status': 'باز',
      'reply': '',
    },
    {
      'title': 'پیگیری زمان بررسی',
      'name': 'امیر حسینی',
      'status': 'در حال رسیدگی',
      'reply': '',
    },
  ];
  final questionTitles = [
    'اطلاعات پایه',
    'هدف تو',
    'وضعیت سلامت',
    'سبک زندگی',
    'سلیقهٔ غذایی',
    'بازبینی و تأیید',
  ];
  bool get hasUserRequest => userRequestId != null;

  DietRequest get userRequest => request(userRequestId!);
  DietRequest request(String id) => requests.firstWhere((r) => r.id == id);
  void update() => notifyListeners();
  void selectRole(AppRole value) {
    if (value == AppRole.admin) return;
    selectedRole = value;
    role = null;
    if (value == AppRole.user) {
      role = value;
      entryStage = EntryStage.home;
    } else {
      entryStage = EntryStage.onboarding;
    }
    update();
  }

  void continueToLogin() {
    if (selectedRole == null) return;
    role = null;
    entryStage = EntryStage.login;
    update();
  }

  void continueToUserHome() {
    if (selectedRole != AppRole.user) return;
    role = AppRole.user;
    entryStage = EntryStage.home;
    update();
  }

  void openUserLogin() {
    selectedRole = AppRole.user;
    role = null;
    entryStage = EntryStage.login;
    update();
  }

  void returnToOnboarding() {
    if (selectedRole == null) {
      logout();
      return;
    }
    role = null;
    entryStage = EntryStage.onboarding;
    update();
  }

  void login(AppRole value, {String phone = '09120000000'}) {
    if (value == AppRole.admin) return;
    role = value;
    selectedRole = value;
    entryStage = EntryStage.home;
    if (value == AppRole.user) {
      _userAuthenticated = true;
      sessionPhone = phone;
      sessionIssuedAt = today;
      sessionExpiresAt = today.add(const Duration(days: 30));
      streakServer.login();
      journey.startSession(authenticated: true, now: today);
      journey.viewScreen('home', today);
      saveUserSession();
      if (pendingPlanAcquisition && !questionnaireComplete) {
        entryStage = EntryStage.onboarding;
      }
    }
    update();
  }

  // Explicit fixture helper for local previews/tests; production login never
  // creates a service request before a mock wallet purchase.
  void loginDemoUser() {
    login(AppRole.user);
    attachDemoUserRequest();
    update();
  }

  void attachDemoUserRequest() {
    userRequestId = '1042';
    userRequestIds.add('1042');
    if (questionnaire.name.isNotEmpty) {
      final r = request('1042');
      r.name = questionnaire.name;
      r.goal = questionnaire.goal;
    }
  }

  void logout() {
    messaging.reset();
    role = null;
    selectedRole = null;
    _userAuthenticated = false;
    sessionIssuedAt = sessionExpiresAt = null;
    sessionPhone = '';
    pendingPlanAcquisition = false;
    saveUserSession();
    userRequestId = null;
    foodPreferences = null;
    userRequestIds.clear();
    liveReady = false;
    suppressLiveEntry = false;
    profilePhoto = null;
    liveTargetKcal = null;
    coachDay = null;
    coachConsumedKcal = null;
    coachTargetKcal = null;
    coachProtein = null;
    coachCarbs = null;
    coachFat = null;
    coachWaterGlasses = null;
    serverMealUids.clear();
    reportEaten = null;
    liveServices = null;
    liveOpenQuestions = [];
    liveTopups = [];
    liveShopping = null;
    liveOrderKey = null;
    liveNotice = null;
    reportShopping = null;
    role = selectedRole = AppRole.user;
    entryStage = EntryStage.home;
    update();
  }

  void submitQuestionnaire() {
    questionnaireComplete = true;
    final id =
        (requests.map((r) => int.parse(r.id)).reduce((a, b) => a > b ? a : b) +
                1)
            .toString();
    requests.insert(
      0,
      DietRequest(
        id: id,
        name: questionnaire.name,
        goal: questionnaire.goal,
        status: PlanStatus.queued,
        specialist: experts.first.name,
        wait: 'همین حالا',
      ),
    );
    request(id).preferenceSnapshot = foodPreferences?.accepted == true
        ? foodPreferences
        : null;
    request(id).questionnaireSnapshot = Map<String, dynamic>.from(
      questionnaire.toJson(),
    );
    userRequestId = id;
    userRequestIds.add(id);
    notices.insert(0, 'درخواست ${fa(id)} ثبت شد و در انتظار رسیدگی است.');
    update();
  }

  void beginReview(String id) {
    final r = request(id);
    if (r.status != PlanStatus.ready && r.status != PlanStatus.needsInfo) {
      r.status = PlanStatus.reviewing;
    }
    update();
  }

  void updateProfileName(String name) {
    if (role == AppRole.expert) {
      final previous = experts.first.name;
      experts.first.name = name;
      for (final r in requests) {
        if (r.specialist == previous) r.specialist = name;
      }
    } else {
      questionnaire.name = name;
    }
    update();
  }

  void editMeal(String id, int index, Meal meal, {int day = 0}) {
    request(id).draftForDay(day)[index] = meal;
    update();
  }

  void addMeal(String id, Meal meal, {int day = 0}) {
    request(id).draftForDay(day).add(meal);
    update();
  }

  void removeMeal(String id, int index, {int day = 0}) {
    final meals = request(id).draftForDay(day);
    if (index < 0 || index >= meals.length) return;
    meals.removeAt(index);
    update();
  }

  List<ProgramReview> approvedReviewsForDashboard() =>
      programReviews.where((r) => r.approved).toList();

  List<ProgramReview> pendingProgramReviews() =>
      programReviews.where((r) => !r.approved && !r.rejected).toList();

  ProgramReview? userPendingReview() {
    final name = questionnaire.name.trim();
    for (final r in programReviews) {
      if (r.authorName.trim() == name && !r.approved) return r;
    }
    return null;
  }

  final WeeklyFeedbackRepository feedbackRepository;
  final List<WeeklyFeedback> _weeklyFeedback = [];
  bool savingFeedback = false;
  String get feedbackOwner =>
      'demo:${sessionPhone.isEmpty ? 'local' : sessionPhone}';
  List<WeeklyFeedback> get weeklyFeedback =>
      List.unmodifiable(_weeklyFeedback.where((f) => f.owner == feedbackOwner));
  FoodPreferences? foodPreferences;
  String? feedbackLoadError;
  Future<void> restoreWeeklyFeedback() async {
    if (!userSignedIn) return;
    final owner = feedbackOwner;
    try {
      final records = await feedbackRepository.list(owner);
      final preferences = await feedbackRepository.preferences(owner);
      if (!userSignedIn || owner != feedbackOwner) return;
      _weeklyFeedback
        ..removeWhere((r) => r.owner == owner)
        ..addAll(records);
      foodPreferences = preferences;
      for (final record in records) {
        _projectPublicFeedback(record);
      }
      feedbackLoadError = null;
      update();
    } catch (_) {
      feedbackLoadError = 'بازیابی بازخورد انجام نشد؛ دوباره تلاش کن.';
      update();
    }
  }

  bool feedbackEligible(DietRequest request) {
    final week = request.programWeek;
    return userRequestIds.contains(request.id) &&
        request.isPublished &&
        week != null &&
        (completedProgramIds.contains(request.id) ||
            dateKey(today).compareTo(
                  dateKey(DateTime(week.year, week.month, week.day + 6)),
                ) >=
                0);
  }

  DietRequest? get feedbackProgram {
    final eligible = requests.where(feedbackEligible).toList();
    if (eligible.isEmpty) return null;
    return eligible.first;
  }

  bool get canReviewCurrentProgram => userSignedIn && feedbackProgram != null;
  WeeklyFeedback? feedbackFor(DietRequest request) {
    final matching = weeklyFeedback.where(
      (f) =>
          f.requestId == request.id &&
          f.planVersion == request.version &&
          f.week == dateKey(request.programWeek!),
    );
    return matching.isEmpty ? null : matching.first;
  }

  List<FeedbackMeal> feedbackMeals(DietRequest request) {
    final result = <FeedbackMeal>[], week = request.programWeek!;
    for (var day = 0; day < 7; day++) {
      final date = DateTime(week.year, week.month, week.day + day);
      final originals = request.mealsForDay(day);
      for (var index = 0; index < originals.length; index++) {
        final selected =
            _selectedOptions['${request.id}|${request.version}|${dateKey(date)}|$index'];
        final alternatives = originals[index].alternatives.where(
          (a) => a.id == selected && a.available,
        );
        final meal = alternatives.isEmpty
            ? originals[index]
            : alternatives.first.meal;
        result.add(
          FeedbackMeal(
            '${request.id}|${request.version}|$day|$index',
            '${persianWeekDays[day]} · ${originals[index].name} · ${meal.title}',
          ),
        );
      }
    }
    return result;
  }

  Future<void> saveWeeklyFeedback(WeeklyFeedback feedback) async {
    if (savingFeedback) throw StateError('ذخیره در جریان است.');
    final request = feedbackProgram;
    if (!userSignedIn ||
        request == null ||
        feedback.owner != feedbackOwner ||
        feedback.requestId != request.id ||
        feedback.planVersion != request.version ||
        feedback.week != dateKey(request.programWeek!) ||
        feedbackFor(request) != null) {
      throw StateError('برنامه یا هفته معتبر نیست یا بازخورد قبلاً ثبت شده.');
    }
    final ids = feedbackMeals(request).map((m) => m.id).toSet();
    if ([
          ...feedback.favorite,
          ...feedback.disliked,
          ...feedback.difficult,
        ].any((id) => !ids.contains(id)) ||
        feedback.favorite
            .toSet()
            .intersection(feedback.disliked.toSet())
            .isNotEmpty) {
      throw ArgumentError('غذاهای انتخاب‌شده معتبر نیستند.');
    }
    if (!['easy', 'sometimes', 'hard'].contains(feedback.availability) ||
        !['comfortable', 'mixed', 'expensive'].contains(feedback.budget) ||
        !['small', 'suitable', 'large'].contains(feedback.portion) ||
        !['good', 'average', 'poor', 'not_used'].contains(feedback.service) ||
        (feedback.service == 'not_used'
            ? feedback.rating != 0
            : feedback.rating < 1 || feedback.rating > 5) ||
        feedback.comment.length > 1500 ||
        feedback.publicText.length > 500 ||
        (feedback.publicConsent && feedback.publicText.trim().isEmpty) ||
        (!feedback.publicConsent && feedback.publicText.isNotEmpty)) {
      throw ArgumentError('پاسخ‌ها را کامل کن.');
    }
    final owner = feedbackOwner;
    savingFeedback = true;
    update();
    try {
      await feedbackRepository.save(feedback);
      _weeklyFeedback.add(feedback);
      if (userSignedIn && owner == feedbackOwner) {
        _projectPublicFeedback(feedback);
      }
    } finally {
      savingFeedback = false;
      update();
    }
  }

  void _projectPublicFeedback(WeeklyFeedback feedback) {
    if (!feedback.publicConsent || feedback.owner != feedbackOwner) return;
    final id = 'weekly:${feedback.key}';
    if (programReviews.any((r) => r.id == id)) return;
    programReviews.insert(
      0,
      ProgramReview(
        id: id,
        authorName: questionnaire.name.trim().isEmpty
            ? 'کاربر رژیم من'
            : questionnaire.name.trim(),
        text: feedback.publicText,
        rating: feedback.rating,
        requestId: feedback.requestId,
        weekKey: feedback.week,
      ),
    );
  }

  FoodPreferences get suggestedFoodPreferences {
    final previous = weeklyFeedback.toList()
      ..sort((a, b) => b.at.compareTo(a.at));
    if (previous.isEmpty) return const FoodPreferences();
    final latest = previous.first;
    String names(List<String> ids) => latest.meals
        .where((m) => ids.contains(m.id))
        .map((m) => m.title)
        .join('\n');
    return FoodPreferences(
      favorites: names(latest.favorite),
      avoid: names(latest.disliked),
      preparation: latest.difficult.isEmpty ? '' : 'غذاهای ساده‌تر و سریع‌تر',
      budget: latest.budget == 'expensive' ? 'مواد اولیه اقتصادی‌تر' : '',
    );
  }

  Future<void> confirmFoodPreferences(FoodPreferences preferences) async {
    if (!userSignedIn || savingFeedback) {
      throw StateError('ابتدا وارد شو یا پایان ذخیره را صبر کن.');
    }
    if ([
      preferences.favorites,
      preferences.avoid,
      preferences.preparation,
      preferences.budget,
    ].any((v) => v.length > 1500)) {
      throw ArgumentError('متن طولانی است.');
    }
    final owner = feedbackOwner;
    savingFeedback = true;
    update();
    try {
      await feedbackRepository.savePreferences(owner, preferences);
      if (userSignedIn && owner == feedbackOwner) foodPreferences = preferences;
    } finally {
      savingFeedback = false;
      update();
    }
  }

  List<ProgramReview> get clinicianFeedback =>
      programReviews.where((r) => r.rating > 0).toList();
  double get clinicianRating => clinicianFeedback.isEmpty
      ? 0
      : clinicianFeedback.fold<int>(0, (n, r) => n + r.rating) /
            clinicianFeedback.length;
  int get positiveFeedbackCount =>
      clinicianFeedback.where((r) => r.rating >= 4).length;

  void submitProgramReview(
    String text, {
    int rating = 5,
    bool publishConsent = false,
  }) {
    if (!canReviewCurrentProgram) {
      throw StateError(
        'پس از تکمیل برنامهٔ هفته و دریافت جایزه می‌توانی بازخورد ثبت کنی.',
      );
    }
    if (rating < 1 || rating > 5) throw StateError('امتیاز را انتخاب کن.');
    final trimmed = text.trim();
    if (trimmed.isEmpty) {
      throw StateError('متن نظر را وارد کن.');
    }
    final completed = feedbackProgram!;
    final week = dateKey(completed.programWeek ?? startOfWeek(today));
    if (programReviews.any(
      (r) => r.weekKey == week && r.authorName == questionnaire.name.trim(),
    )) {
      throw StateError('بازخورد این هفته قبلاً ارسال شده است.');
    }
    final name = questionnaire.name.trim();

    if (publishConsent) {
      programReviews.insert(
        0,
        ProgramReview(
          id: 'rev-${_reviewSeq++}',
          authorName: name,
          text: trimmed,
          rating: rating,
          requestId: completed.id,
          weekKey: week,
        ),
      );
    }
    messages.add(
      ChatMessage(
        'بازخورد برنامهٔ هفته · امتیاز ${fa(rating)} از ۵\n$trimmed',
        AppRole.user,
        support: true,
        threadId: 'support-main',
      ),
    );
    journey.record('feedback_submitted', {'rating': rating});
    update();
  }

  void approveProgramReview(String id) {
    final review = programReviews.firstWhere((r) => r.id == id);
    review.approved = true;
    review.rejected = false;
    update();
  }

  void rejectProgramReview(String id) {
    final review = programReviews.firstWhere((r) => r.id == id);
    review.rejected = true;
    review.approved = false;
    update();
  }

  void approveActiveUserRequest() {
    final id = userRequestId;
    if (id != null) approve(id);
  }

  void approve(String id) {
    final r = request(id);
    if (!r.canApproveInformation) {
      throw StateError('ابتدا پاسخ کاربر را دریافت و بررسی کن.');
    }
    if (List.generate(7, r.draftForDay).any((day) => day.isEmpty)) {
      throw StateError('برای هر روز حداقل یک وعده ثبت کن.');
    }
    if (List.generate(7, r.draftForDay)
        .expand((d) => d)
        .any(
          (m) =>
              m.title.trim().isEmpty ||
              m.amount.trim().isEmpty ||
              m.calories <= 0,
        )) {
      throw StateError('نام و مقدار همهٔ وعده‌ها باید تکمیل باشد.');
    }
    final issues = List.generate(
      7,
      r.draftForDay,
    ).expand((d) => d).expand(mealApprovalIssues).toList();
    if (issues.isNotEmpty) throw StateError('پیش از انتشار: ${issues.first}');
    r.published = List.unmodifiable(r.draft);
    r.publishedOtherDays = List.generate(
      6,
      (i) => List<Meal>.unmodifiable(r.draftOtherDays[i]),
    );
    r.publishedNote = r.draftNote;
    r.programStartsOn ??= DateTime(today.year, today.month, today.day);
    r.programWeek ??= startOfWeek(today);
    r.version++;
    r.status = PlanStatus.ready;
    r.revisionRequested = false;
    r.revisionAwaitingUser = false;
    r.revisionMessage = '';
    r.revisionReply = '';
    if (id == userRequestId) {
      notices.insert(0, 'نسخهٔ ${fa(r.version)} برنامه‌ات آماده است.');
      claimWeeklyReward();
    }
    update();
  }

  void needInfo(String id, String question) {
    final r = request(id);
    if (question.trim().isEmpty) return;
    r.question = question.trim();
    r.infoAnswer = '';
    r.infoAnswerReviewed = false;
    r.status = PlanStatus.needsInfo;
    if (id == userRequestId) {
      messages.add(ChatMessage(question, AppRole.expert));
    }
    update();
  }

  void markInfoAnswerReviewed(String id) {
    final r = request(id);
    if (r.infoAnswer.isEmpty) return;
    r.infoAnswerReviewed = true;
    update();
  }

  void requestRevision(String reason, String detail) {
    if (!hasUserRequest) return;
    userRequest.revisionRequested = true;
    userRequest.revisionAwaitingUser = false;
    userRequest.revisionMessage = '';
    userRequest.revisionReply = '';
    userRequest.revisionReason = reason;
    userRequest.revisionDetails = detail;
    update();
  }

  void setDemoStatus(PlanStatus status) {
    if (!hasUserRequest) return;
    if (status == PlanStatus.ready) {
      approve(userRequestId!);
      return;
    }
    userRequest.status = status;
    update();
  }

  void toggleMeal(String key) {
    if (!completedMeals.remove(key)) completedMeals.add(key);
    update();
  }

  void toggleHabit(String key) {
    if (!completedHabits.remove(key)) completedHabits.add(key);
    update();
  }

  void addWeight(double value) {
    final dates = weightEntryDates.toList();
    final date = DateTime(today.year, today.month, today.day);
    if (dates.isNotEmpty && dateKey(dates.last) == dateKey(date)) {
      weightEntries[weightEntries.length - 1] = value;
    } else {
      dates.add(date);
      weightEntries.add(value);
    }
    weightDates
      ..clear()
      ..addAll(dates);
    latestWeight = value;
    update();
  }

  void send(String text, {bool support = false, String? threadId}) {
    if (text.trim().isEmpty) return;
    final id = threadId ?? (support ? 'support-main' : 'user-main'),
        target = thread(id),
        sender = role ?? AppRole.user;
    if (sender == AppRole.user && id != 'user-main' && id != 'support-main') {
      return;
    }
    if (sender == AppRole.expert && target.support ||
        sender == AppRole.admin && !target.support) {
      return;
    }
    messages.add(
      ChatMessage(text.trim(), sender, support: target.support, threadId: id),
    );
    final revision = id == 'user-main'
        ? (hasUserRequest && userRequest.revisionRequested ? userRequest : null)
        : requests
              .where(
                (r) =>
                    r.revisionRequested &&
                    (id == 'patient-request-${r.id}' ||
                        (!target.support && patientName(target) == r.name)),
              )
              .firstOrNull;
    if (revision != null && !target.support) {
      if (sender == AppRole.expert) {
        revision.revisionMessage = text.trim();
        revision.revisionReply = '';
        revision.revisionAwaitingUser = true;
        revision.status = PlanStatus.needsInfo;
      } else if (sender == AppRole.user && revision.revisionAwaitingUser) {
        revision.revisionReply = text.trim();
        revision.revisionAwaitingUser = false;
        revision.status = PlanStatus.reviewing;
      }
    } else if (sender == AppRole.user &&
        id == 'user-main' &&
        hasUserRequest &&
        userRequest.status == PlanStatus.needsInfo) {
      userRequest.infoAnswer = text.trim();
      userRequest.infoAnswerReviewed = false;
      userRequest.status = PlanStatus.reviewing;
    }
    update();
  }
}

class DemoScope extends InheritedNotifier<DemoStore> {
  const DemoScope({super.key, required DemoStore store, required super.child})
    : super(notifier: store);
  static DemoStore of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<DemoScope>()!.notifier!;
}
