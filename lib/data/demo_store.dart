import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'wallet_catalog.dart';
import 'package:flutter/material.dart';
import 'questionnaire_storage.dart';
import 'nutrition_log_storage.dart';
import 'day.dart';
import 'wallet_state_storage.dart';
import 'session_storage.dart';
import 'form_config.dart';
import 'workspace_settings_storage.dart';

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

@immutable
class Meal {
  const Meal({
    required this.name,
    required this.title,
    required this.time,
    required this.amount,
    required this.details,
    this.kind = 0,
    this.calories = 0,
  });
  final String name, title, time, amount, details;
  final int kind, calories;
  Meal copyWith({
    String? name,
    String? title,
    String? time,
    String? amount,
    String? details,
    int? kind,
    int? calories,
  }) => Meal(
    name: name ?? this.name,
    title: title ?? this.title,
    time: time ?? this.time,
    amount: amount ?? this.amount,
    details: details ?? this.details,
    kind: kind ?? this.kind,
    calories: calories ?? this.calories,
  );
}

// UI fixtures. The energy and portions below are examples, not patient prescriptions.
List<Meal> sampleMeals([int day = 0]) {
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
  ];
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
  String revisionReason = '', revisionDetails = '', question = '';
  String infoAnswer = '';
  bool infoAnswerReviewed = false;
  bool get canApproveInformation => question.isEmpty
      ? status != PlanStatus.needsInfo
      : infoAnswer.isNotEmpty && infoAnswerReviewed;
  DateTime? programStartsOn;
  DateTime? programWeek;

  String draftNote =
      'اگر تهیهٔ غذایی برات سخت بود، از متخصص دربارهٔ جایگزین بپرس.';
  String publishedNote = '';
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
  bool get isPublished => published.isNotEmpty;
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
  DemoStore({
    QuestionnaireStorage? storage,
    NutritionLogStorage? nutritionStorage,
    WalletStateStorage? walletStorage,
    SessionStorage? sessionStorage,
    WorkspaceSettingsStorage? settingsStorage,
    DateTime Function()? clock,
  }) : _sessionStorage = sessionStorage,
       _walletStorage = walletStorage,
       _storage = storage,
       _settingsStorage = settingsStorage,
       _nutritionStorage = nutritionStorage,
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
  String patientName(ChatThread t) =>
      t.id == 'user-main' || t.id == 'support-main'
      ? questionnaire.name
      : t.patientName;
  String threadTitle(ChatThread t, AppRole role) => role == AppRole.user
      ? (t.support
            ? 'پشتیبانی سبزینه'
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
  bool savingMeal = false;
  String mealLogKey(DateTime date, int index) =>
      '${dateKey(date)}|${userRequestId ?? 'none'}|$index|${mealsOn(date)[index].title}|${mealsOn(date)[index].calories}';
  List<Meal> mealsOn(DateTime date) {
    if (userRequestId == null) return const [];
    final week = userRequest.programWeek;
    if (week != null && dateKey(startOfWeek(date)) != dateKey(week)) {
      return const [];
    }
    return userRequest.mealsForDay(weekDayIndex(date));
  }

  int calorieTarget(DateTime date) =>
      mealsOn(date).fold(0, (n, m) => n + m.calories);
  int consumedCalories(DateTime date) => _mealCalories.entries
      .where(
        (e) => e.key.startsWith('${dateKey(date)}|${userRequestId ?? 'none'}|'),
      )
      .fold(0, (n, e) => n + e.value);
  bool mealEaten(DateTime date, int index) =>
      _mealCalories.containsKey(mealLogKey(date, index));
  int eatenCount(DateTime date) => List.generate(
    mealsOn(date).length,
    (i) => i,
  ).where((i) => mealEaten(date, i)).length;
  Future<void> restoreNutritionLog() async {
    try {
      final raw = await _nutritionStorage?.read();
      if (raw == null) return;
      final data = jsonDecode(raw);
      if (data is! Map<String, dynamic> ||
          data['version'] != 1 ||
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
      completedMeals
        ..clear()
        ..addAll(_mealCalories.keys);
      update();
    } catch (_) {
      debugPrint('Meal log restore unavailable.');
    }
  }

  Future<void> setMealEaten(DateTime date, int index, bool eaten) async {
    if (savingMeal) return;
    final meals = mealsOn(date);
    if (index < 0 || index >= meals.length) return;
    final key = mealLogKey(date, index),
        next = Map<String, int>.of(_mealCalories);
    if (eaten) {
      next[key] = meals[index].calories;
    } else {
      next.remove(key);
    }
    savingMeal = true;
    update();
    try {
      await _nutritionStorage?.write(jsonEncode({'version': 1, 'meals': next}));
      _mealCalories
        ..clear()
        ..addAll(next);
      completedMeals
        ..clear()
        ..addAll(next.keys);
      claimWeeklyReward();
    } finally {
      savingMeal = false;
      update();
    }
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

  bool claimWeeklyReward() {
    if (!weeklyProgramCompleted) return false;
    final week = dateKey(userRequest.programWeek ?? startOfWeek(today));
    completedProgramIds.add(userRequest.id);
    if (rewardedWeeks.contains(week)) return false;
    rewardedWeeks.add(week);
    rewardAmounts[week] = weeklyRewardToman;
    pendingWeeklyRewards.add(week);
    walletBalance += weeklyRewardToman;
    walletTransactions.insert(
      0,
      MockWalletTransaction(
        operationId: 'weekly-reward-$week',
        title: 'جایزهٔ تکمیل برنامهٔ هفتگی',
        amountToman: weeklyRewardToman,
        balanceAfter: walletBalance,
        credit: true,
      ),
    );
    saveWalletState();
    update();
    return true;
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
  bool notificationsEnabled = true,
      mealReminders = false,
      questionnaireComplete = false;
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
    'به سبزینه خوش اومدی.',
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
    role = null;
    selectedRole = null;
    _userAuthenticated = false;
    sessionIssuedAt = sessionExpiresAt = null;
    sessionPhone = '';
    pendingPlanAcquisition = false;
    saveUserSession();
    userRequestId = null;
    userRequestIds.clear();
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

  DietRequest? get feedbackProgram {
    for (final r in requests) {
      if (userRequestIds.contains(r.id) && completedProgramIds.contains(r.id)) {
        return r;
      }
    }
    return null;
  }

  bool get canReviewCurrentProgram => userSignedIn && feedbackProgram != null;
  List<ProgramReview> get clinicianFeedback => programReviews;
  double get clinicianRating => clinicianFeedback.isEmpty
      ? 0
      : clinicianFeedback.fold<int>(0, (n, r) => n + r.rating) /
            clinicianFeedback.length;
  int get positiveFeedbackCount =>
      clinicianFeedback.where((r) => r.rating >= 4).length;

  void submitProgramReview(String text, {int rating = 5}) {
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
    messages.add(
      ChatMessage(
        'بازخورد برنامهٔ هفته · امتیاز ${fa(rating)} از ۵\n$trimmed',
        AppRole.user,
        support: true,
        threadId: 'support-main',
      ),
    );
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
    if (id == userRequestId) {
      notices.insert(0, 'نسخهٔ ${fa(r.version)} برنامه‌ات آماده است.');
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
    if (sender == AppRole.user &&
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
