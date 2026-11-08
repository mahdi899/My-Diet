import '../../core/network/api_client.dart';
import '../../domain/plan/plan.dart';

class HttpPlanRepository implements PlanRepository {
  HttpPlanRepository(this._api);
  final ApiClient _api;

  @override
  Future<PlanRequestInfo?> latestRequest() async {
    final data = await _api.get('me/request');
    if (data == null) return null;
    return PlanRequestInfo.fromJson(data as Map<String, dynamic>);
  }

  @override
  Future<PublishedPlan?> publishedPlan() async {
    final data = await _api.get('me/plan');
    if (data == null) return null;
    return PublishedPlan.fromJson(data as Map<String, dynamic>);
  }

  @override
  Future<ShoppingList> shopping(String weekStart) async {
    final data = await _api.get('me/shopping-list?weekStart=$weekStart');
    return ShoppingList.fromJson(data as Map<String, dynamic>);
  }

  @override
  Future<ShoppingList> flagShopping(
    String weekStart,
    ShoppingItem item,
    int revision, {
    required bool alreadyHave,
    required bool purchased,
  }) async {
    final data = await _api.patch(
      'me/shopping-list/items/${item.key}',
      body: {
        'weekStart': weekStart,
        'expectedRevision': revision,
        'alreadyHave': alreadyHave,
        'purchased': purchased,
      },
    );
    return ShoppingList.fromJson(data as Map<String, dynamic>);
  }

  @override
  Future<void> setEaten(String mealUid, bool eaten) async {
    await _api.post('meal-logs', body: {'mealUid': mealUid, 'eaten': eaten});
  }

  @override
  Future<void> answerQuestion(String questionId, String body) async {
    await _api.post(
      'me/info-questions/$questionId/answers',
      body: {'body': body},
    );
  }
}
