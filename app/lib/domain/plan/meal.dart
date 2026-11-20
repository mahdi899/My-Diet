enum AlternativeSource { ai, specialist }

class Meal {
  const Meal({
    required this.name,
    required this.title,
    required this.time,
    required this.amount,
    required this.details,
    this.kind = 0,
    this.calories = 0,
    this.preparationMinutes,
    this.instructions = '',
    this.quantityBasis = '',
    this.ingredients = const [],
    this.alternatives = const [],
    this.nutrition = const {},
  });
  final String name, title, time, amount, details, instructions, quantityBasis;
  final int kind, calories;
  final int? preparationMinutes;
  final List<MealIngredient> ingredients;
  final List<MealAlternative> alternatives;
  final Map<String, num> nutrition;
  Meal copyWith({
    String? name,
    String? title,
    String? time,
    String? amount,
    String? details,
    int? kind,
    int? calories,
    int? preparationMinutes,
    String? instructions,
    String? quantityBasis,
    List<MealIngredient>? ingredients,
    List<MealAlternative>? alternatives,
    Map<String, num>? nutrition,
  }) => Meal(
    name: name ?? this.name,
    title: title ?? this.title,
    time: time ?? this.time,
    amount: amount ?? this.amount,
    details: details ?? this.details,
    kind: kind ?? this.kind,
    calories: calories ?? this.calories,
    preparationMinutes: preparationMinutes ?? this.preparationMinutes,
    instructions: instructions ?? this.instructions,
    quantityBasis: quantityBasis ?? this.quantityBasis,
    ingredients: List.unmodifiable(ingredients ?? this.ingredients),
    alternatives: List.unmodifiable(alternatives ?? this.alternatives),
    nutrition: nutrition ?? this.nutrition,
  );
  bool get hasPortion =>
      title.trim().isNotEmpty && amount.trim().isNotEmpty && calories > 0;
  List<String> get publicationIssues => [
    if (!hasPortion) 'نام، مقدار یا کالری وعده ناقص است',
    if (preparationMinutes == null || preparationMinutes! < 0)
      'زمان آماده‌سازی ثبت نشده',
    if (instructions.trim().isEmpty) 'روش آماده‌سازی ثبت نشده',
    if (quantityBasis.trim().isEmpty) 'مبنای وزن خام یا پخته ثبت نشده',
    if (ingredients.isEmpty || ingredients.any((i) => !i.complete))
      'مواد اولیه یا مقدار آن‌ها ناقص است',
  ];
}

class MealIngredient {
  const MealIngredient(
    this.id,
    this.name,
    this.quantity,
    this.unit, {
    this.category = 'سایر',
    this.basis = '',
  });
  final String id, name, unit, category, basis;
  final double? quantity;
  bool get complete =>
      id.isNotEmpty &&
      name.isNotEmpty &&
      quantity != null &&
      quantity! > 0 &&
      unit.isNotEmpty;
}

class MealAlternative {
  const MealAlternative({
    required this.id,
    required this.source,
    required this.meal,
    this.approved = false,
    this.reviewedBy,
    this.reviewedAt,
  });
  final String id;
  final AlternativeSource source;
  final Meal meal;
  final bool approved;
  final String? reviewedBy;
  final DateTime? reviewedAt;
  String get sourceLabel =>
      source == AlternativeSource.ai ? 'پیشنهاد هوش مصنوعی' : 'پیشنهاد متخصص';
  bool get available =>
      approved &&
      id.isNotEmpty &&
      id != 'original' &&
      reviewedBy != null &&
      reviewedBy!.trim().isNotEmpty &&
      reviewedAt != null &&
      meal.publicationIssues.isEmpty;
}

List<String> mealApprovalIssues(Meal meal) => [
  ...meal.publicationIssues,
  for (final source in AlternativeSource.values)
    if (meal.alternatives.where((a) => a.source == source).length != 1)
      source == AlternativeSource.ai
          ? 'یک جایگزین AI لازم است'
          : 'یک جایگزین متخصص لازم است',
  for (final a in meal.alternatives)
    if (!a.available) '${a.sourceLabel}: جزئیات یا تأیید متخصص ناقص است',
  if (meal.alternatives.map((a) => a.id).toSet().length !=
      meal.alternatives.length)
    'شناسه جایگزین‌ها تکراری است',
];

class MealSelection {
  const MealSelection({
    required this.key,
    required this.optionId,
    required this.reasonId,
    required this.reasonLabel,
    required this.explanation,
    required this.at,
    required this.previousOptionId,
    required this.foodTitle,
  });
  final String key,
      optionId,
      previousOptionId,
      reasonId,
      reasonLabel,
      explanation,
      foodTitle;
  final DateTime at;
  Map<String, Object?> toJson() => {
    'key': key,
    'optionId': optionId,
    'previousOptionId': previousOptionId,
    'reasonId': reasonId,
    'reasonLabel': reasonLabel,
    'explanation': explanation,
    'at': at.toIso8601String(),
    'foodTitle': foodTitle,
  };
  factory MealSelection.fromJson(Map<String, dynamic> json) => MealSelection(
    key: json['key'] as String,
    optionId: json['optionId'] as String,
    previousOptionId: json['previousOptionId'] as String,
    reasonId: json['reasonId'] as String,
    reasonLabel: json['reasonLabel'] as String,
    explanation: json['explanation'] as String,
    at: DateTime.parse(json['at'] as String),
    foodTitle: json['foodTitle'] as String,
  );
}

class ShoppingIngredient {
  const ShoppingIngredient(this.ingredient, this.quantity);
  final MealIngredient ingredient;
  final double quantity;
}
