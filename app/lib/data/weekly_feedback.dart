import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class FeedbackMeal {
  const FeedbackMeal(this.id, this.title);
  final String id, title;
  Map<String, Object> toJson() => {'id': id, 'title': title};
  factory FeedbackMeal.fromJson(Map<String, dynamic> j) =>
      FeedbackMeal(j['id'] as String, j['title'] as String);
}

class WeeklyFeedback {
  const WeeklyFeedback({
    required this.owner,
    required this.requestId,
    required this.planVersion,
    required this.week,
    required this.at,
    required this.meals,
    required this.favorite,
    required this.disliked,
    required this.difficult,
    required this.availability,
    required this.budget,
    required this.portion,
    required this.service,
    required this.rating,
    this.comment = '',
    this.publicConsent = false,
    this.publicText = '',
  });
  final String owner,
      requestId,
      week,
      availability,
      budget,
      portion,
      service,
      comment,
      publicText;
  final int planVersion, rating;
  final DateTime at;
  final List<FeedbackMeal> meals;
  final List<String> favorite, disliked, difficult;
  final bool publicConsent;
  String get key => jsonEncode([owner, requestId, planVersion, week]);
  Map<String, Object?> toJson() => {
    'owner': owner,
    'requestId': requestId,
    'planVersion': planVersion,
    'week': week,
    'at': at.toIso8601String(),
    'meals': meals.map((m) => m.toJson()).toList(),
    'favorite': favorite,
    'disliked': disliked,
    'difficult': difficult,
    'availability': availability,
    'budget': budget,
    'portion': portion,
    'service': service,
    'rating': rating,
    'comment': comment,
    'publicConsent': publicConsent,
    'publicText': publicText,
  };
  factory WeeklyFeedback.fromJson(Map<String, dynamic> j) => WeeklyFeedback(
    owner: j['owner'] as String,
    requestId: j['requestId'] as String,
    planVersion: j['planVersion'] as int,
    week: j['week'] as String,
    at: DateTime.parse(j['at'] as String),
    meals: (j['meals'] as List)
        .map((m) => FeedbackMeal.fromJson(Map<String, dynamic>.from(m as Map)))
        .toList(),
    favorite: List<String>.from(j['favorite'] as List),
    disliked: List<String>.from(j['disliked'] as List),
    difficult: List<String>.from(j['difficult'] as List),
    availability: j['availability'] as String,
    budget: j['budget'] as String,
    portion: j['portion'] as String,
    service: j['service'] as String,
    rating: j['rating'] as int,
    comment: j['comment'] as String,
    publicConsent: j['publicConsent'] as bool,
    publicText: j['publicText'] as String,
  );
}

class FoodPreferences {
  const FoodPreferences({
    this.favorites = '',
    this.avoid = '',
    this.preparation = '',
    this.budget = '',
    this.accepted = false,
  });
  final String favorites, avoid, preparation, budget;
  final bool accepted;
  Map<String, Object> toJson() => {
    'favorites': favorites,
    'avoid': avoid,
    'preparation': preparation,
    'budget': budget,
    'accepted': accepted,
  };
  factory FoodPreferences.fromJson(Map<String, dynamic> j) => FoodPreferences(
    favorites: j['favorites'] as String? ?? '',
    avoid: j['avoid'] as String? ?? '',
    preparation: j['preparation'] as String? ?? '',
    budget: j['budget'] as String? ?? '',
    accepted: j['accepted'] == true,
  );
}

abstract interface class WeeklyFeedbackRepository {
  Future<List<WeeklyFeedback>> list(String owner);
  Future<void> save(WeeklyFeedback feedback);
  Future<FoodPreferences?> preferences(String owner);
  Future<void> savePreferences(String owner, FoodPreferences preferences);
}

class MemoryWeeklyFeedbackRepository implements WeeklyFeedbackRepository {
  final records = <String, WeeklyFeedback>{};
  final savedPreferences = <String, FoodPreferences>{};
  @override
  Future<List<WeeklyFeedback>> list(String owner) async =>
      records.values.where((r) => r.owner == owner).toList();
  @override
  Future<void> save(WeeklyFeedback feedback) async {
    if (records.containsKey(feedback.key)) {
      throw StateError('بازخورد قبلاً ثبت شده است.');
    }
    records[feedback.key] = feedback;
  }

  @override
  Future<FoodPreferences?> preferences(String owner) async =>
      savedPreferences[owner];
  @override
  Future<void> savePreferences(
    String owner,
    FoodPreferences preferences,
  ) async {
    savedPreferences[owner] = preferences;
  }
}

/// Local demo adapter. No remote delivery, model inference or moderation is simulated as verified.
class PreferencesWeeklyFeedbackRepository implements WeeklyFeedbackRepository {
  final storage = SharedPreferencesAsync();
  String key(String owner) =>
      'sabzine.weekly-feedback.v1.${Uri.encodeComponent(owner)}';
  Future<Map<String, dynamic>> read(String owner) async {
    final raw = await storage.getString(key(owner));
    return raw == null ? {} : Map<String, dynamic>.from(jsonDecode(raw) as Map);
  }

  @override
  Future<List<WeeklyFeedback>> list(String owner) async =>
      ((await read(owner))['records'] as List? ?? [])
          .map(
            (j) => WeeklyFeedback.fromJson(Map<String, dynamic>.from(j as Map)),
          )
          .where((r) => r.owner == owner)
          .toList();
  @override
  Future<void> save(WeeklyFeedback feedback) async {
    final state = await read(feedback.owner);
    final records = (state['records'] as List? ?? []).toList();
    if (records.any(
      (r) =>
          WeeklyFeedback.fromJson(Map<String, dynamic>.from(r as Map)).key ==
          feedback.key,
    )) {
      throw StateError('بازخورد قبلاً ثبت شده است.');
    }
    records.add(feedback.toJson());
    await storage.setString(
      key(feedback.owner),
      jsonEncode({...state, 'records': records}),
    );
  }

  @override
  Future<FoodPreferences?> preferences(String owner) async {
    final value = (await read(owner))['preferences'];
    return value is Map
        ? FoodPreferences.fromJson(Map<String, dynamic>.from(value))
        : null;
  }

  @override
  Future<void> savePreferences(
    String owner,
    FoodPreferences preferences,
  ) async {
    final state = await read(owner);
    await storage.setString(
      key(owner),
      jsonEncode({...state, 'preferences': preferences.toJson()}),
    );
  }
}
