import '../../data/day.dart';
import '../../data/demo_store.dart';
import '../../domain/common/number_format.dart';
import '../../domain/onboarding/onboarding.dart';
import '../../domain/plan/plan.dart';

const _goals = {
  'weight_loss': 'کاهش وزن',
  'weight_gain': 'افزایش وزن',
  'pregnancy': 'بارداری و شیردهی',
  'detox': 'سلامت و پاکسازی',
  'lose': 'کاهش وزن',
};

/// Puts the server's plan into the original app's store, so the existing home,
/// plan and tracking screens render it.
void showServerPlan(
  DemoStore store, {
  required String name,
  String? track,
  PlanRequestInfo? request,
  PublishedPlan? plan,
  int? walletToman,
  int? targetKcal,
  ProfileSummary? profile,
}) {
  final goal = _goals[track] ?? (track ?? 'تغذیه');
  store.questionnaire.name = name.trim().isEmpty ? 'دوست' : name.trim();
  if (track != null && track.isNotEmpty) {
    store.questionnaire.goal = goal;
  }
  if (profile != null) {
    store.questionnaire.age = fa(profile.age);
    store.questionnaire.height = fa(profile.heightCm.round());
    store.applyOnboardingWeight(profile.weightKg);
    final target = profile.targetWeightKg;
    store.questionnaire.targetWeight = target == null
        ? ''
        : persianNumber(target);
  }
  store.questionnaireComplete = true;
  store.entryStage = EntryStage.home;
  if (targetKcal != null) store.liveTargetKcal = targetKcal;
  store.serverMealUids.clear();
  store.serverFeedbackOptionIds.clear();
  if (walletToman != null) store.walletBalance = walletToman;

  final id = plan?.requestId ?? request?.id;
  store.planHoldReason = request?.holdReason;
  store.planAwaitingDoctor = request?.awaitingDoctor == true;
  if (profile != null) {
    store.pendingWebPlanDelivery =
        profile.hasPendingWebPurchase && request == null;
  } else if (request != null) {
    store.pendingWebPlanDelivery = false;
  }
  store.mealFrequencyNote =
      profile != null &&
          !profile.doctorOnly &&
          (profile.reportedMealsPerDay ?? 3) < 3 &&
          profile.plannedMealsPerDay == 3
      ? 'برای اینکه مقدار روزانه در یک یا دو وعده جمع نشود، الگوی پیشنهادی برنامهٔ جدیدت سه وعده است. اگر خوردن وعدهٔ بیشتر برایت سخت است، با متخصصت هماهنگ کن.'
      : null;
  if (id == null) {
    store.userRequestId = null;
    store.liveReady = true;
    store.update();
    return;
  }
  store.requests.removeWhere((r) => r.id == id);
  final diet = DietRequest(
    id: id,
    name: store.questionnaire.name,
    goal: goal,
    status: _status(request, plan),
    specialist: 'متخصص تغذیه',
    wait: '',
  );
  if (plan != null && plan.days.any((d) => d.meals.isNotEmpty)) {
    final byDay = List<List<Meal>>.generate(7, (_) => []);
    for (final day in plan.days) {
      final index = weekDayIndex(DateTime.parse(day.date));
      if (index >= 0 && index < 7) byDay[index] = day.meals.map(_meal).toList();
    }
    diet.published = List.unmodifiable(byDay[0]);
    diet.publishedOtherDays = [
      for (var i = 1; i < 7; i++) List<Meal>.unmodifiable(byDay[i]),
    ];
    diet.programWeek = DateTime.parse(plan.weekStart);
    diet.programStartsOn = diet.programWeek;
    diet.version = 1;
    diet.status = PlanStatus.ready;
  }
  store.requests.insert(0, diet);
  store.userRequestId = id;
  store.userRequestIds.add(id);
  if (plan != null) {
    for (final day in plan.days) {
      final date = DateTime.parse(day.date);
      for (var i = 0; i < day.meals.length; i++) {
        final meal = day.meals[i];
        final option = meal.selected;
        store.serverFeedbackOptionIds['$id|${diet.version}|${weekDayIndex(date)}|$i'] =
            option?.id ?? meal.uid;
        store.rememberServerMeal(
          date: date,
          index: i,
          uid: meal.uid,
          eaten: meal.eaten,
          calories: meal.selected?.calories ?? meal.calories,
        );
      }
    }
  }
  store.liveReady = true;
  store.update();
}

PlanStatus _status(PlanRequestInfo? request, PublishedPlan? plan) {
  if (plan != null && plan.days.any((d) => d.meals.isNotEmpty)) {
    return PlanStatus.ready;
  }
  return switch (request?.phase) {
    RequestPhase.queued => PlanStatus.queued,
    RequestPhase.generating => PlanStatus.generating,
    RequestPhase.needsInfo => PlanStatus.needsInfo,
    RequestPhase.published => PlanStatus.ready,
    RequestPhase.cancelled => PlanStatus.incomplete,
    _ => PlanStatus.reviewing,
  };
}

Meal _meal(MealView meal) {
  Meal from(MealOptionView option) {
    final items = option.ingredientDetails.isNotEmpty
        ? [
            for (final (index, item) in option.ingredientDetails.indexed)
              MealIngredient(
                '${option.id}-$index',
                item['name'] as String? ?? '',
                (item['quantity'] as num?)?.toDouble(),
                item['unit'] as String? ?? '',
                category: item['category'] as String? ?? 'سایر',
                basis: item['basis'] as String? ?? '',
              ),
          ]
        : option.ingredients.isEmpty
        ? [MealIngredient(option.id, option.title, 1, 'وعده')]
        : [
            for (final name in option.ingredients)
              MealIngredient(name, name, 1, 'واحد'),
          ];
    return Meal(
      name: meal.typeLabel,
      title: option.title,
      time: meal.time ?? '',
      amount: option.servingDisplay.isNotEmpty
          ? option.servingDisplay
          : option.ingredients.isEmpty
          ? '۱ وعده'
          : option.ingredients.join('، '),
      details: meal.notes,
      calories: option.calories ?? meal.calories,
      preparationMinutes: option.prepMinutes,
      instructions: option.instructions.trim().isEmpty
          ? 'طبق برنامه سرو شود.'
          : option.instructions,
      quantityBasis: 'آمادهٔ سرو',
      ingredients: items,
      nutrition: option.nutrition,
    );
  }

  MealOptionView? primary;
  for (final option in meal.options) {
    if (option.kind == 'primary') primary = option;
  }
  if (primary == null && meal.options.isNotEmpty) primary = meal.options.first;
  final base = primary == null
      ? Meal(
          name: meal.typeLabel,
          title: meal.title,
          time: meal.time ?? '',
          amount: '۱ وعده',
          details: meal.notes,
          calories: meal.calories,
          preparationMinutes: 15,
          instructions: 'طبق برنامه سرو شود.',
          quantityBasis: 'آمادهٔ سرو',
          ingredients: [MealIngredient(meal.uid, meal.title, 1, 'وعده')],
        )
      : from(primary);
  return base.copyWith(
    alternatives: [
      for (final option in meal.options)
        if (option.kind != 'primary' && option.id != primary?.id)
          MealAlternative(
            id: option.id,
            source: option.kind == 'ai_alternative'
                ? AlternativeSource.ai
                : AlternativeSource.specialist,
            meal: from(option),
            approved: true,
            reviewedBy: 'متخصص تغذیه',
            reviewedAt: DateTime.now(),
          ),
    ],
  );
}
