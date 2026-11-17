import 'package:flutter/material.dart';

import '../../../core/icons/diet_icon.dart';
export '../../../core/icons/diet_icon.dart';

// Resolve server codes by question; shared codes such as `low`, `mixed` and
// `none` must never borrow an unrelated topic's artwork.
const _topics = <String, Map<String, (DietIconKind, int)>>{
  'age': {
    '18_30': (DietIconKind.person, 1),
    '30_40': (DietIconKind.person, 2),
    '40_50': (DietIconKind.person, 3),
    '50_plus': (DietIconKind.person, 4),
  },
  'sex': {'female': (DietIconKind.female, 0), 'male': (DietIconKind.male, 0)},
  'activity': {
    'very_low': (DietIconKind.seated, 0),
    'low': (DietIconKind.walking, 0),
    'medium': (DietIconKind.cycling, 0),
    'high': (DietIconKind.running, 0),
    'very_high': (DietIconKind.strength, 0),
  },
  'meals_per_day': {
    '1': (DietIconKind.mealOne, 0),
    '2': (DietIconKind.mealTwo, 0),
    '3': (DietIconKind.mealThree, 0),
    '4_plus': (DietIconKind.mealMore, 0),
  },
  'allergies': {
    'none': (DietIconKind.shield, 0),
    'dairy': (DietIconKind.dairy, 0),
    'nuts': (DietIconKind.nuts, 0),
    'egg': (DietIconKind.egg, 0),
    'gluten': (DietIconKind.wheat, 0),
    'other': (DietIconKind.foodAllergy, 0),
  },
  'diet_style': {
    'omnivore': (DietIconKind.balancedMeal, 0),
    'vegetarian': (DietIconKind.vegetarianMeal, 0),
    'vegan': (DietIconKind.veganMeal, 0),
  },
  'conditions': {
    'none': (DietIconKind.shield, 0),
    'diabetes': (DietIconKind.bloodSugar, 0),
    'hypertension': (DietIconKind.bloodPressure, 0),
    'kidney': (DietIconKind.kidneys, 0),
    'thyroid': (DietIconKind.thyroid, 0),
    'digestive': (DietIconKind.stomach, 0),
    'other': (DietIconKind.medicalNotes, 0),
  },
  'medications': {
    'no': (DietIconKind.shield, 0),
    'yes': (DietIconKind.medicine, 0),
  },
  'prep_time': {
    'lt15': (DietIconKind.cookingPot, 15),
    '15_30': (DietIconKind.cookingPot, 30),
    'more': (DietIconKind.cookingPot, 60),
  },
  'budget': {
    'low': (DietIconKind.wallet, 1),
    'medium': (DietIconKind.wallet, 2),
    'open': (DietIconKind.wallet, 3),
  },
  'job_activity': {
    'sitting': (DietIconKind.seated, 0),
    'mixed': (DietIconKind.walking, 0),
    'standing': (DietIconKind.standing, 0),
    'heavy': (DietIconKind.strength, 0),
  },
  'exercise_days': {
    '0': (DietIconKind.seated, 0),
    '1': (DietIconKind.calendar, 1),
    '2': (DietIconKind.calendar, 2),
    '3': (DietIconKind.calendar, 3),
    '4': (DietIconKind.calendar, 4),
    '5': (DietIconKind.calendar, 5),
    '6': (DietIconKind.calendar, 6),
    '7': (DietIconKind.calendar, 7),
  },
  'exercise_duration': {
    'lt30': (DietIconKind.clock, 15),
    '30_60': (DietIconKind.clock, 45),
    'gt60': (DietIconKind.clock, 60),
  },
  'sport_type': {
    'strength': (DietIconKind.strength, 0),
    'cardio': (DietIconKind.running, 0),
    'combined': (DietIconKind.workout, 0),
    'other': (DietIconKind.question, 0),
  },
  'loss_pace': {
    'slow': (DietIconKind.slowPace, 0),
    'balanced': (DietIconKind.steadyPace, 0),
    'fast': (DietIconKind.running, 0),
    'auto': (DietIconKind.coach, 0),
  },
  'loss_challenges': {
    'snacking': (DietIconKind.snack, 0),
    'sweets': (DietIconKind.sweets, 0),
    'overeating': (DietIconKind.mealMore, 0),
    'stress_eating': (DietIconKind.stress, 0),
    'low_activity': (DietIconKind.seated, 0),
    'irregular_meals': (DietIconKind.irregularMeals, 0),
  },
  'hunger_time': {
    'morning': (DietIconKind.sunrise, 0),
    'noon': (DietIconKind.sun, 0),
    'afternoon': (DietIconKind.sunset, 0),
    'night': (DietIconKind.moon, 0),
    'all_day': (DietIconKind.clock, 60),
  },
  'fast_food_freq': {
    'rare': (DietIconKind.fastFood, 1),
    '1_2': (DietIconKind.fastFood, 2),
    '3_4': (DietIconKind.fastFood, 3),
    'daily': (DietIconKind.fastFood, 4),
  },
  'previous_diet': {
    'first': (DietIconKind.firstPlan, 0),
    'kept': (DietIconKind.goalReached, 0),
    'regained': (DietIconKind.weightReturn, 0),
    'hard': (DietIconKind.pausedPlan, 0),
  },
  'craving_level': {
    'very_low': (DietIconKind.mealOne, 0),
    'medium': (DietIconKind.mealTwo, 0),
    'high': (DietIconKind.mealThree, 0),
    'very_high': (DietIconKind.mealMore, 0),
  },
  'binge_history': {
    'no': (DietIconKind.shield, 0),
    'yes': (DietIconKind.stress, 0),
    'skip': (DietIconKind.question, 0),
  },
  'gain_goal': {
    'muscle': (DietIconKind.strength, 0),
    'healthy_weight': (DietIconKind.scale, 0),
    'fuller': (DietIconKind.person, 0),
    'regain': (DietIconKind.weightReturn, 0),
  },
  'appetite': {
    'very_low': (DietIconKind.mealOne, 0),
    'low': (DietIconKind.mealTwo, 0),
    'normal': (DietIconKind.balancedMeal, 0),
    'high': (DietIconKind.mealMore, 0),
  },
  'gain_obstacle': {
    'early_full': (DietIconKind.stomach, 0),
    'forget_meals': (DietIconKind.irregularMeals, 0),
    'high_activity': (DietIconKind.running, 0),
    'no_gain': (DietIconKind.scale, 0),
    'unknown': (DietIconKind.question, 0),
  },
  'unintended_loss': {
    'no': (DietIconKind.shield, 0),
    'little': (DietIconKind.scale, 1),
    'significant': (DietIconKind.scale, 2),
  },
  'gain_sport': {
    'none': (DietIconKind.seated, 0),
    'bodybuilding': (DietIconKind.strength, 0),
    'cardio': (DietIconKind.running, 0),
    'combined': (DietIconKind.workout, 0),
    'heavy_work': (DietIconKind.strength, 0),
  },
  'big_meals': {
    'easy': (DietIconKind.balancedMeal, 0),
    'small_pref': (DietIconKind.mealOne, 0),
    'full_fast': (DietIconKind.stomach, 0),
  },
  'snack_readiness': {
    'two_plus': (DietIconKind.snack, 2),
    'one': (DietIconKind.snack, 1),
    'more_main': (DietIconKind.mealThree, 0),
  },
  'life_stage': {
    'pregnant': (DietIconKind.pregnancy, 0),
    'breastfeeding': (DietIconKind.breastfeeding, 0),
  },
  'babies': {
    'singleton': (DietIconKind.baby, 1),
    'twins': (DietIconKind.baby, 2),
    'triplets_plus': (DietIconKind.baby, 3),
  },
  'doctor_advice': {
    'no': (DietIconKind.shield, 0),
    'control_gain': (DietIconKind.scale, 1),
    'more_gain': (DietIconKind.scale, 2),
    'other': (DietIconKind.medicalNotes, 0),
  },
  'preg_symptoms': {
    'nausea': (DietIconKind.nausea, 0),
    'vomiting': (DietIconKind.nausea, 2),
    'constipation': (DietIconKind.intestines, 1),
    'heartburn': (DietIconKind.heartburn, 0),
    'no_appetite': (DietIconKind.mealOne, 0),
    'none': (DietIconKind.shield, 0),
  },
  'preg_conditions': {
    'gestational_diabetes': (DietIconKind.bloodSugar, 0),
    'preeclampsia': (DietIconKind.bloodPressure, 0),
    'anemia': (DietIconKind.bloodDrop, 0),
    'thyroid': (DietIconKind.thyroid, 0),
    'other': (DietIconKind.medicalNotes, 0),
    'none': (DietIconKind.shield, 0),
  },
  'preg_supplements': {
    'folic_acid': (DietIconKind.vitamin, 1),
    'iron': (DietIconKind.vitamin, 2),
    'vitamin_d': (DietIconKind.vitamin, 3),
    'prenatal_multi': (DietIconKind.vitamin, 4),
    'other': (DietIconKind.medicine, 0),
    'none': (DietIconKind.shield, 0),
  },
  'doctor_restrictions': {
    'no': (DietIconKind.shield, 0),
    'yes': (DietIconKind.medicalNotes, 0),
  },
  'feeding_mode': {
    'breast_only': (DietIconKind.breastfeeding, 0),
    'mixed': (DietIconKind.babyBottle, 2),
    'occasional': (DietIconKind.breastfeeding, 1),
  },
  'lactation_goal': {
    'balanced': (DietIconKind.balancedMeal, 0),
    'maintain': (DietIconKind.scale, 0),
    'gradual_loss': (DietIconKind.steadyPace, 0),
    'more_energy': (DietIconKind.sun, 0),
  },
  'lactation_energy': {
    'good': (DietIconKind.sun, 0),
    'tired': (DietIconKind.bed, 0),
    'big_appetite': (DietIconKind.mealMore, 0),
    'small_appetite': (DietIconKind.mealOne, 0),
  },
  'baby_concern': {
    'no': (DietIconKind.shield, 0),
    'yes': (DietIconKind.baby, 4),
    'reviewing': (DietIconKind.medicalNotes, 0),
  },
  'lactation_meds': {
    'no': (DietIconKind.shield, 0),
    'yes': (DietIconKind.medicine, 0),
  },
  'health_focus': {
    'energy': (DietIconKind.sun, 0),
    'nutrition_quality': (DietIconKind.balancedMeal, 0),
    'digestive': (DietIconKind.stomach, 0),
    'sleep': (DietIconKind.bed, 0),
    'healthy_weight': (DietIconKind.scale, 0),
    'less_junk': (DietIconKind.fastFood, 5),
  },
  'water': {
    'under_4': (DietIconKind.water, 1),
    '4_6': (DietIconKind.water, 2),
    '7_9': (DietIconKind.water, 3),
    '10_plus': (DietIconKind.water, 4),
  },
  'fruit_veg': {
    'none': (DietIconKind.fruitBasket, 0),
    '1_2': (DietIconKind.fruitBasket, 1),
    '3_4': (DietIconKind.fruitBasket, 2),
    '5_plus': (DietIconKind.fruitBasket, 3),
  },
  'digestion': {
    'normal': (DietIconKind.shield, 0),
    'constipation': (DietIconKind.intestines, 1),
    'bloating': (DietIconKind.stomach, 2),
    'heartburn': (DietIconKind.heartburn, 0),
    'diarrhea': (DietIconKind.intestines, 2),
    'other': (DietIconKind.medicalNotes, 0),
  },
  'sweets_freq': {
    'rare': (DietIconKind.sweets, 1),
    'weekly': (DietIconKind.sweets, 2),
    'daily': (DietIconKind.sweets, 3),
    'multi_daily': (DietIconKind.sweets, 4),
  },
  'sleep_quality': {
    'very_good': (DietIconKind.bed, 4),
    'good': (DietIconKind.bed, 3),
    'medium': (DietIconKind.bed, 2),
    'poor': (DietIconKind.bed, 1),
  },
  'diet_change': {
    'regular_meals': (DietIconKind.calendar, 0),
    'more_veg': (DietIconKind.fruitBasket, 3),
    'less_sugar': (DietIconKind.sweets, 5),
    'home_cooked': (DietIconKind.homeCooking, 0),
    'variety': (DietIconKind.balancedMeal, 0),
    'sustainable': (DietIconKind.progress, 0),
  },
  'doctor_diet_advice': {
    'no': (DietIconKind.shield, 0),
    'blood_sugar': (DietIconKind.bloodSugar, 0),
    'blood_pressure': (DietIconKind.bloodPressure, 0),
    'blood_lipids': (DietIconKind.bloodDrop, 0),
    'digestive': (DietIconKind.stomach, 0),
    'other': (DietIconKind.medicalNotes, 0),
  },
};

bool hasOnboardingSymbol(String question, String code) =>
    _topics[question]?.containsKey(code) ?? false;

int onboardingVariant(String question, String code) =>
    _topics[question]?[code]?.$2 ?? 0;

DietIconKind onboardingSymbol(
  String question,
  String code, {
  String label = '',
}) {
  final configured = _topics[question]?[code];
  if (configured != null) return configured.$1;
  if (question == 'age_range' || question == 'age_band') {
    return DietIconKind.person;
  }
  if (question == 'activity') {
    return switch (label) {
      'خیلی کم' || 'بیشتر نشسته' => DietIconKind.seated,
      'کم' || 'فعالیت سبک' => DietIconKind.walking,
      'متوسط' || 'فعالیت متوسط' => DietIconKind.cycling,
      'زیاد' || 'فعالیت زیاد' => DietIconKind.running,
      'خیلی زیاد' => DietIconKind.strength,
      _ => DietIconKind.walking,
    };
  }
  return switch (code) {
    'weight_loss' ||
    'weight_gain' ||
    'lose' ||
    'gain' ||
    'کاهش وزن' ||
    'افزایش وزن' ||
    'تثبیت وزن' => DietIconKind.scale,
    'pregnancy' || 'lactation' => DietIconKind.pregnancy,
    'detox' || 'wellness' => DietIconKind.leaf,
    'yes' => DietIconKind.check,
    'no' => DietIconKind.close,
    'none' => DietIconKind.shield,
    'other' => DietIconKind.medicalNotes,
    _ => DietIconKind.question,
  };
}

/// Existing control identifiers share the same rounded vector family as topics.
DietIconKind onboardingControl(IconData? icon) => switch (icon) {
  Icons.arrow_back_rounded => DietIconKind.back,
  Icons.arrow_upward_rounded ||
  Icons.keyboard_arrow_up_rounded => DietIconKind.up,
  Icons.arrow_downward_rounded ||
  Icons.keyboard_arrow_down_rounded => DietIconKind.down,
  Icons.add => DietIconKind.plus,
  Icons.remove => DietIconKind.minus,
  Icons.check || Icons.check_rounded => DietIconKind.check,
  Icons.edit_outlined || Icons.edit_note => DietIconKind.edit,
  Icons.home_outlined => DietIconKind.home,
  Icons.fingerprint => DietIconKind.fingerprint,
  Icons.nightlight_round => DietIconKind.moon,
  Icons.wb_sunny_rounded => DietIconKind.sun,
  Icons.medical_services_outlined ||
  Icons.health_and_safety_outlined ||
  Icons.verified_user_outlined ||
  Icons.admin_panel_settings_outlined => DietIconKind.shield,
  Icons.favorite_rounded => DietIconKind.heart,
  Icons.monitor_weight_outlined ||
  Icons.trending_down_rounded ||
  Icons.trending_up_rounded => DietIconKind.scale,
  Icons.rice_bowl_outlined || Icons.restaurant_rounded => DietIconKind.meal,
  Icons.pregnant_woman_rounded => DietIconKind.pregnancy,
  Icons.assignment_outlined => DietIconKind.plan,
  Icons.people_outline => DietIconKind.person,
  Icons.chat_bubble_outline || Icons.support_agent => DietIconKind.coach,
  Icons.chair_alt_rounded => DietIconKind.seated,
  Icons.directions_walk_rounded => DietIconKind.walking,
  Icons.directions_bike_rounded => DietIconKind.cycling,
  Icons.directions_run_rounded => DietIconKind.running,
  Icons.fitness_center_rounded => DietIconKind.strength,
  Icons.cloud_off_rounded => DietIconKind.offline,
  _ => DietIconKind.leaf,
};

class OnboardingIcon extends StatelessWidget {
  const OnboardingIcon(
    this.icon, {
    super.key,
    this.size = 24,
    this.color,
    this.textDirection,
  });
  final IconData icon;
  final double size;
  final Color? color;
  final TextDirection? textDirection;

  @override
  Widget build(BuildContext context) => Transform.flip(
    flipX:
        onboardingControl(icon) == DietIconKind.back &&
        (textDirection ?? Directionality.of(context)) == TextDirection.rtl,
    child: DietIcon(
      onboardingControl(icon),
      size: size,
      color: color,
      monochrome: color != null,
    ),
  );
}
