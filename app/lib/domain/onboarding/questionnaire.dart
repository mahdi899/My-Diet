import 'dart:convert';
import '../common/digits.dart';

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
