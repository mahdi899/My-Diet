import 'dart:convert';
import 'package:http/http.dart' as http;
import '../../../data/customer_auth.dart';

class SwapAlternative {
  const SwapAlternative({
    required this.slug,
    required this.name,
    required this.kcal,
    required this.protein,
    required this.carbs,
    required this.fat,
    required this.costTier,
    required this.prepMinutes,
  });

  final String slug;
  final String name;
  final int kcal;
  final double protein;
  final double carbs;
  final double fat;
  final int costTier;
  final int prepMinutes;

  factory SwapAlternative.fromJson(Map<String, dynamic> json) {
    return SwapAlternative(
      slug: json['slug'] as String,
      name: json['name'] as String,
      kcal: (json['kcal'] as num).toInt(),
      protein: (json['protein'] as num).toDouble(),
      carbs: (json['carbs'] as num).toDouble(),
      fat: (json['fat'] as num).toDouble(),
      costTier: (json['costTier'] as num).toInt(),
      prepMinutes: (json['prepMinutes'] as num).toInt(),
    );
  }
}

class SwapResult {
  const SwapResult({
    required this.mealId,
    required this.mealTitle,
    required this.mealKcal,
    required this.alternatives,
    required this.tooFewResults,
  });

  final String mealId;
  final String mealTitle;
  final int mealKcal;
  final List<SwapAlternative> alternatives;
  final bool tooFewResults;

  factory SwapResult.fromJson(Map<String, dynamic> json) {
    final meal = json['meal'] as Map<String, dynamic>;
    return SwapResult(
      mealId: meal['id'] as String,
      mealTitle: meal['title'] as String,
      mealKcal: (meal['kcal'] as num).toInt(),
      alternatives: (json['alternatives'] as List<dynamic>)
          .map((a) => SwapAlternative.fromJson(a as Map<String, dynamic>))
          .toList(),
      tooFewResults: json['tooFewResults'] as bool? ?? false,
    );
  }
}

class MealSwapRepository {
  MealSwapRepository({required this.auth, http.Client? client})
      : _client = client ?? http.Client();

  final CustomerAuth auth;
  final http.Client _client;

  Uri _uri() {
    final root = auth.baseUrl.replaceAll(RegExp(r'/+$'), '');
    return Uri.parse('$root/v1/me/coach/swap-meal');
  }

  Map<String, String> _headers() {
    final session = auth.session;
    return {
      'Content-Type': 'application/json; charset=utf-8',
      'Accept': 'application/json',
      if (session != null) 'Authorization': 'Bearer ${session.accessToken}',
    };
  }

  Future<SwapResult> getAlternatives({
    required String mealId,
    String reason = 'variety',
    bool budgetOk = false,
  }) async {
    final body = json.encode({
      'mealId': mealId,
      'reason': reason,
      'budgetOk': budgetOk,
    });

    final response = await _client.post(_uri(), headers: _headers(), body: body);

    if (response.statusCode != 200) {
      throw MealSwapException(_errorMessage(response), statusCode: response.statusCode);
    }

    final data = json.decode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
    return SwapResult.fromJson(data);
  }

  Future<Map<String, dynamic>> applySwap({
    required String mealId,
    required String foodSlug,
    String reason = 'variety',
  }) async {
    final body = json.encode({
      'mealId': mealId,
      'foodSlug': foodSlug,
      'reason': reason,
    });

    final response = await _client.post(_uri(), headers: _headers(), body: body);

    if (response.statusCode != 200) {
      throw MealSwapException(_errorMessage(response), statusCode: response.statusCode);
    }

    return json.decode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
  }

  String _errorMessage(http.Response response) {
    try {
      final data = json.decode(utf8.decode(response.bodyBytes));
      if (data is Map && data.containsKey('message')) {
        return data['message'] as String;
      }
    } catch (_) {}
    return 'تعویض وعده انجام نشد. دوباره تلاش کن.';
  }
}

class MealSwapException implements Exception {
  const MealSwapException(this.message, {required this.statusCode});
  final String message;
  final int statusCode;

  @override
  String toString() => 'MealSwapException($statusCode): $message';
}
