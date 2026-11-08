import '../../data/customer_auth.dart';
import '../../data/demo_store.dart';
import '../../data/network/customer_api_client.dart';
import '../../domain/commerce/commerce.dart';
import '../../core/network/api_client.dart';
import '../../domain/onboarding/onboarding.dart';
import '../../domain/plan/plan.dart';
import '../../data/session/services.dart';
import 'live_plan.dart';

Services ensureLiveServices(DemoStore store) {
  final auth = store.customerAuth;
  if (auth == null) throw StateError('نشست سرور نیست.');
  return store.liveServices ??= Services.http(CustomerApiClient(auth));
}

void bindLiveReports(DemoStore store) {
  final services = ensureLiveServices(store);
  store.reportEaten = (uid, eaten) => services.plans.setEaten(uid, eaten);
  store.reportShopping = (name, status) => _flagShopping(store, name, status);
}

String _plain(String value) => value
    .replaceAll('ي', 'ی')
    .replaceAll('ك', 'ک')
    .replaceAll(RegExp(r'\s+'), ' ')
    .trim();

Future<void> _flagShopping(
  DemoStore store,
  String ingredientName,
  String? status,
) async {
  final list = store.liveShopping;
  final services = store.liveServices;
  if (list == null || services == null) return;
  final wanted = _plain(ingredientName);
  ShoppingItem? item;
  for (final candidate in list.items) {
    if (_plain(candidate.name) == wanted) {
      item = candidate;
      break;
    }
  }
  if (item == null) return;
  store.liveShopping = await services.plans.flagShopping(
    list.weekStart,
    item,
    list.revision,
    alreadyHave: status == 'have',
    purchased: status == 'purchased',
  );
}

String _serviceCode(String id) => switch (id) {
  'new-plan' => 'new_plan',
  'ai-change' => 'ai_revision',
  'expert-change' => 'specialist_revision',
  _ => id,
};

/// Prices and wallet balance from the server catalog.
Future<void> syncLiveCatalog(DemoStore store) async {
  final services = ensureLiveServices(store);
  final catalog = await services.commerce.catalog();
  final wallet = await services.commerce.wallet();
  for (final service in catalog.services) {
    switch (service.code) {
      case 'new_plan':
        store.newPlanPrice = service.priceToman;
      case 'ai_revision':
        store.aiRevisionPrice = service.priceToman;
      case 'specialist_revision':
        store.expertRevisionPrice = service.priceToman;
    }
  }
  store.liveTopups = catalog.topups;
  store.walletBalance = wallet.total;
  store.update();
}

/// Pays for a plan from the server wallet. One idempotency key per attempt.
Future<bool> buyLiveService(DemoStore store, String serviceId) async {
  final offer = store.serviceById(serviceId);
  if (offer == null) return false;
  final services = ensureLiveServices(store);
  store.liveNotice = null;
  store.liveOrderKey ??= newIdempotencyKey();
  try {
    await services.commerce.placeOrder(
      serviceCode: _serviceCode(serviceId),
      expectedPriceToman: offer.priceToman,
      idempotencyKey: store.liveOrderKey!,
      parentRequestId: serviceId == 'new-plan' ? null : store.userRequestId,
    );
    store.liveOrderKey = null;
    await refreshLive(store);
    return true;
  } on ApiException catch (e) {
    if (!e.offline) store.liveOrderKey = null;
    store.liveNotice = e.message;
    if (e.code == 'price_changed') {
      try {
        await syncLiveCatalog(store);
      } on ApiException {
        // The notice already explains the failure.
      }
    }
    if (e.expired) await store.signOutCustomer();
    return false;
  }
}

/// Reloads the request, the published plan and the wallet into the original shell.
Future<void> refreshLive(DemoStore store, {ProfileSummary? profile}) async {
  if (store.customerAuth == null && store.liveServices == null) return;
  final services = ensureLiveServices(store);
  PlanRequestInfo? request;
  PublishedPlan? plan;
  var wallet = store.walletBalance;
  var name = store.questionnaire.name;
  try {
    request = await services.plans.latestRequest();
  } on ApiException catch (e) {
    if (e.expired) {
      await store.signOutCustomer();
      return;
    }
  }
  try {
    plan = await services.plans.publishedPlan();
  } on ApiException catch (e) {
    if (e.expired) {
      await store.signOutCustomer();
      return;
    }
  }
  try {
    wallet = (await services.commerce.wallet()).total;
  } on ApiException {
    // Keep the last balance.
  }
  try {
    final me = await store.customerAuth?.api('me');
    if (me is Map &&
        me['displayName'] is String &&
        (me['displayName'] as String).trim().isNotEmpty) {
      name = me['displayName'] as String;
    }
  } on AuthFailure {
    // The greeting keeps the name already on the profile.
  }
  store.liveOpenQuestions = request?.openQuestions ?? const [];
  showServerPlan(
    store,
    name: name,
    track: profile?.track,
    request: request,
    plan: plan,
    walletToman: wallet,
    targetKcal: profile?.targetKcal,
  );
  await pullLiveShopping(store, plan?.weekStart);
}

Future<void> pullLiveShopping(DemoStore store, [String? weekStart]) async {
  final services = store.liveServices;
  final week = weekStart ?? _weekStart(store);
  if (services == null || week == null) return;
  try {
    final list = await services.plans.shopping(week);
    store.liveShopping = list;
    for (final item in list.items) {
      store.applyRemoteShopping(
        item.name,
        alreadyHave: item.alreadyHave,
        purchased: item.purchased,
      );
    }
    store.update();
  } on ApiException {
    // The list on screen stays as it was.
  }
}

String? _weekStart(DemoStore store) {
  if (!store.hasUserRequest) return null;
  final week = store.userRequest.programWeek;
  if (week == null) return null;
  final m = week.month.toString().padLeft(2, '0');
  final d = week.day.toString().padLeft(2, '0');
  return '${week.year}-$m-$d';
}

Future<bool> answerLiveQuestion(
  DemoStore store,
  String questionId,
  String body,
) async {
  try {
    await ensureLiveServices(store).plans.answerQuestion(questionId, body);
    await refreshLive(store);
    return true;
  } on ApiException catch (e) {
    store.liveNotice = e.message;
    if (e.expired) await store.signOutCustomer();
    return false;
  }
}
