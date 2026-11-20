/// Where a purchased plan is on its way to the person.
enum RequestPhase {
  queued,
  generating,
  inReview,
  needsInfo,
  published,
  cancelled,
}

RequestPhase phaseOf(String status) => switch (status) {
  'queued' => RequestPhase.queued,
  'generating' => RequestPhase.generating,
  'awaiting_user' || 'response_received' => RequestPhase.needsInfo,
  'published' => RequestPhase.published,
  'cancelled' => RequestPhase.cancelled,
  _ => RequestPhase.inReview,
};

class InfoQuestion {
  const InfoQuestion({
    required this.id,
    required this.prompt,
    required this.required,
    required this.status,
  });
  final String id, prompt, status;
  final bool required;
}

class PlanRequestInfo {
  const PlanRequestInfo({
    required this.id,
    required this.status,
    required this.kind,
    required this.questions,
    this.displayName,
    this.holdReason,
  });
  factory PlanRequestInfo.fromJson(Map<String, dynamic> j) => PlanRequestInfo(
    id: j['id'] as String,
    status: j['status'] as String,
    kind: j['kind'] as String,
    displayName: j['displayName'] as String?,
    holdReason: j['holdReason'] as String?,
    questions: [
      for (final q in (j['questions'] as List?) ?? const [])
        InfoQuestion(
          id: (q as Map)['id'] as String,
          prompt: q['prompt'] as String,
          required: q['required'] == true,
          status: q['status'] as String,
        ),
    ],
  );
  final String id, status, kind;
  final String? displayName;
  final String? holdReason;
  final List<InfoQuestion> questions;
  RequestPhase get phase => phaseOf(status);
  List<InfoQuestion> get openQuestions =>
      questions.where((q) => q.status == 'open').toList();
}

class MealOptionView {
  const MealOptionView({
    required this.id,
    required this.kind,
    required this.title,
    required this.calories,
    required this.prepMinutes,
    required this.instructions,
    required this.ingredients,
    this.ingredientDetails = const [],
    this.nutrition = const {},
    this.servingDisplay = '',
  });
  factory MealOptionView.fromJson(Map<String, dynamic> j) => MealOptionView(
    id: j['optionId'] as String,
    kind: j['kind'] as String,
    title: j['title'] as String,
    calories: (j['calories'] as num?)?.round(),
    prepMinutes: (j['preparationMinutes'] as num?)?.round() ?? 0,
    instructions: j['instructions'] as String? ?? '',
    servingDisplay: j['servingDisplay'] as String? ?? '',
    ingredients: [
      for (final i in (j['ingredients'] as List?) ?? const [])
        '${(i as Map)['name']}',
    ],
    ingredientDetails: [
      for (final item in (j['ingredients'] as List?) ?? const [])
        Map<String, dynamic>.from(item as Map),
    ],
    nutrition: {
      for (final entry in ((j['nutrition'] as Map?) ?? const {}).entries)
        if (entry.key is String && entry.value is num)
          entry.key as String: entry.value as num,
    },
  );
  final String id, kind, title, instructions;
  final int? calories;
  final int prepMinutes;
  final List<String> ingredients;
  final List<Map<String, dynamic>> ingredientDetails;
  final Map<String, num> nutrition;
  final String servingDisplay;

  String get kindLabel => switch (kind) {
    'primary' => 'پیشنهاد اصلی',
    'ai_alternative' => 'جایگزین هوشمند',
    _ => 'جایگزین دکتر',
  };
}

class MealView {
  const MealView({
    required this.uid,
    required this.mealType,
    required this.time,
    required this.title,
    required this.calories,
    required this.notes,
    required this.options,
    required this.selectedId,
    required this.eaten,
    required this.loggable,
  });
  factory MealView.fromJson(Map<String, dynamic> j) => MealView(
    uid: j['mealUid'] as String,
    mealType: j['mealType'] as String,
    time: j['suggestedTime'] as String?,
    title: j['title'] as String,
    calories: ((j['plannedCalories'] ?? j['calories']) as num).round(),
    notes: j['notes'] as String? ?? '',
    options: [
      for (final o in (j['options'] as List?) ?? const [])
        MealOptionView.fromJson(o as Map<String, dynamic>),
    ],
    selectedId: j['selectedOptionId'] as String?,
    eaten: j['eaten'] == true,
    loggable: j['loggable'] == true,
  );
  final String uid, mealType, title, notes;
  final String? time, selectedId;
  final int calories;
  final List<MealOptionView> options;
  final bool eaten, loggable;

  MealOptionView? get selected {
    for (final o in options) {
      if (o.id == selectedId) return o;
    }
    return options.isEmpty ? null : options.first;
  }

  String get typeLabel => switch (mealType) {
    'breakfast' => 'صبحانه',
    'lunch' => 'ناهار',
    'dinner' => 'شام',
    _ => 'میان‌وعده',
  };

  MealView copyWith({bool? eaten}) => MealView(
    uid: uid,
    mealType: mealType,
    time: time,
    title: title,
    calories: calories,
    notes: notes,
    options: options,
    selectedId: selectedId,
    eaten: eaten ?? this.eaten,
    loggable: loggable,
  );
}

class DayView {
  const DayView({
    required this.date,
    required this.dayIndex,
    required this.meals,
  });
  factory DayView.fromJson(Map<String, dynamic> j) => DayView(
    date: j['date'] as String,
    dayIndex: (j['dayIndex'] as num?)?.toInt() ?? 0,
    meals: [
      for (final m in (j['meals'] as List?) ?? const [])
        MealView.fromJson(m as Map<String, dynamic>),
    ],
  );
  final String date;
  final int dayIndex;
  final List<MealView> meals;
  int get kcal => meals.fold(0, (s, m) => s + m.calories);
  int get eatenKcal =>
      meals.where((m) => m.eaten).fold(0, (s, m) => s + m.calories);
  DateTime get dateTime => DateTime.parse(date);
}

class PublishedPlan {
  const PublishedPlan({
    required this.requestId,
    required this.weekStart,
    required this.expired,
    required this.days,
  });
  factory PublishedPlan.fromJson(Map<String, dynamic> j) => PublishedPlan(
    requestId: j['requestId'] as String,
    weekStart: j['weekStart'] as String,
    expired: j['expired'] == true,
    days: [
      for (final d in j['days'] as List)
        DayView.fromJson(d as Map<String, dynamic>),
    ],
  );
  final String requestId, weekStart;
  final bool expired;
  final List<DayView> days;
}

class ShoppingItem {
  const ShoppingItem({
    required this.key,
    required this.name,
    required this.category,
    required this.quantity,
    required this.unit,
    required this.alreadyHave,
    required this.purchased,
    required this.incomplete,
  });
  factory ShoppingItem.fromJson(Map<String, dynamic> j) => ShoppingItem(
    key: j['key'] as String,
    name: j['name'] as String,
    category: j['category'] as String? ?? '',
    quantity: (j['quantity'] as num?)?.toDouble(),
    unit: j['unit'] as String?,
    alreadyHave: j['alreadyHave'] == true,
    purchased: j['purchased'] == true,
    incomplete: j['incomplete'] == true,
  );
  final String key, name, category;
  final double? quantity;
  final String? unit;
  final bool alreadyHave, purchased, incomplete;
}

class ShoppingList {
  const ShoppingList({
    required this.weekStart,
    required this.revision,
    required this.items,
    required this.incomplete,
  });
  factory ShoppingList.fromJson(Map<String, dynamic> j) => ShoppingList(
    weekStart: j['weekStart'] as String,
    revision: j['revision'] as int,
    incomplete: j['incomplete'] == true,
    items: [
      for (final i in j['items'] as List)
        ShoppingItem.fromJson(i as Map<String, dynamic>),
    ],
  );
  final String weekStart;
  final int revision;
  final bool incomplete;
  final List<ShoppingItem> items;
}

abstract interface class PlanRepository {
  Future<ShoppingList> shopping(String weekStart);
  Future<ShoppingList> flagShopping(
    String weekStart,
    ShoppingItem item,
    int revision, {
    required bool alreadyHave,
    required bool purchased,
  });

  /// Latest request of this person, or null before the first purchase.
  Future<PlanRequestInfo?> latestRequest();
  Future<PublishedPlan?> publishedPlan();
  Future<void> setEaten(String mealUid, bool eaten);
  Future<void> answerQuestion(String questionId, String body);
}
