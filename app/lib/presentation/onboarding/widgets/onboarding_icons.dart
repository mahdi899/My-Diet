import 'package:flutter/material.dart';

import '../../../core/icons/diet_icon.dart';
export '../../../core/icons/diet_icon.dart';

/// Resolve against the question first: codes like `low` and `mixed` are shared
/// by activity, appetite, budget and several unrelated questions.
DietIconKind onboardingSymbol(
  String question,
  String code, {
  String label = '',
}) {
  switch (question) {
    case 'activity':
      return switch (code) {
        'very_low' => DietIconKind.seated,
        'low' => DietIconKind.walking,
        'medium' => DietIconKind.cycling,
        'high' => DietIconKind.running,
        'very_high' => DietIconKind.strength,
        _ => switch (label) {
          'خیلی کم' || 'بیشتر نشسته' => DietIconKind.seated,
          'کم' || 'فعالیت سبک' => DietIconKind.walking,
          'متوسط' || 'فعالیت متوسط' => DietIconKind.cycling,
          'زیاد' || 'فعالیت زیاد' => DietIconKind.running,
          'خیلی زیاد' => DietIconKind.strength,
          _ => DietIconKind.walking,
        },
      };
    case 'job_activity':
      return switch (code) {
        'sitting' => DietIconKind.seated,
        'heavy' => DietIconKind.strength,
        'standing' => DietIconKind.person,
        _ => DietIconKind.walking,
      };
    case 'sport_type':
    case 'gain_sport':
      return switch (code) {
        'none' => DietIconKind.seated,
        'strength' || 'bodybuilding' || 'heavy_work' => DietIconKind.strength,
        'cardio' => DietIconKind.running,
        _ => DietIconKind.cycling,
      };
    case 'sex':
      return code == 'female' ? DietIconKind.female : DietIconKind.male;
    case 'age':
    case 'age_range':
    case 'age_band':
      return DietIconKind.person;
    case 'diet_style':
      return code == 'omnivore' ? DietIconKind.meal : DietIconKind.leaf;
    case 'water':
      return DietIconKind.water;
    case 'budget':
      return DietIconKind.wallet;
    case 'prep_time':
    case 'exercise_duration':
    case 'hunger_time':
      return DietIconKind.clock;
    case 'exercise_days':
    case 'fast_food_freq':
    case 'previous_diet':
      return DietIconKind.plan;
    case 'sleep_quality':
      return DietIconKind.moon;
    case 'life_stage':
    case 'babies':
    case 'feeding_mode':
      return DietIconKind.pregnancy;
    case 'medications':
    case 'preg_supplements':
    case 'lactation_meds':
      return code == 'no' || code == 'none'
          ? DietIconKind.shield
          : DietIconKind.medicine;
    case 'conditions':
    case 'preg_conditions':
    case 'doctor_advice':
    case 'doctor_restrictions':
    case 'doctor_diet_advice':
    case 'baby_concern':
    case 'binge_history':
      return code == 'none' || code == 'no'
          ? DietIconKind.shield
          : DietIconKind.heart;
    case 'gain_goal':
      return code == 'muscle' ? DietIconKind.strength : DietIconKind.scale;
    case 'loss_pace':
    case 'unintended_loss':
    case 'lactation_goal':
      return DietIconKind.progress;
    case 'health_focus':
      return switch (code) {
        'sleep' || 'sleep_quality' => DietIconKind.moon,
        'healthy_weight' => DietIconKind.scale,
        'energy' => DietIconKind.sun,
        'digestive' => DietIconKind.heart,
        _ => DietIconKind.leaf,
      };
    case 'lactation_energy':
      return DietIconKind.sun;
    case 'allergies':
      return switch (code) {
        'none' => DietIconKind.shield,
        'dairy' => DietIconKind.dairy,
        'nuts' => DietIconKind.nuts,
        'egg' => DietIconKind.egg,
        'gluten' => DietIconKind.wheat,
        _ => DietIconKind.foodAllergy,
      };
    case 'meals_per_day':
      return switch (code) {
        '1' => DietIconKind.mealOne,
        '2' => DietIconKind.mealTwo,
        '3' => DietIconKind.mealThree,
        _ => DietIconKind.mealMore,
      };
    case 'appetite':
    case 'big_meals':
    case 'snack_readiness':
    case 'craving_level':
    case 'loss_challenges':
    case 'gain_obstacle':
    case 'diet_change':
    case 'fruit_veg':
    case 'sweets_freq':
      return DietIconKind.meal;
    case 'preg_symptoms':
    case 'digestion':
      return DietIconKind.heart;
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
    'other' => DietIconKind.edit,
    _ => DietIconKind.leaf,
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
