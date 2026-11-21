import '../../data/customer_auth.dart';
import '../../data/demo_store.dart';
import '../../data/network/customer_api_client.dart';
import '../../domain/commerce/commerce.dart';
import '../../core/network/api_client.dart';
import '../../domain/onboarding/onboarding.dart';
import '../../domain/plan/plan.dart';
import '../../data/session/services.dart';
import 'live_plan.dart';
import '../../application/commerce/settle_checkout.dart';
import '../../data/commerce/store_billing.dart';
import '../../domain/common/failure.dart';

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

/// Recovers paid delivery or retries a failed draft without another purchase.
Future<void> recoverLivePlan(DemoStore store) async {
  await CustomerApiClient(store.customerAuth!).post('me/plan/recover');
  await refreshLive(store);
  if (store.liveNotice != null) {
    throw AppFailure(store.liveNotice!);
  }
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

/// Prices from the server catalog.
Future<void> syncLiveCatalog(DemoStore store) async {
  final services = ensureLiveServices(store);
  final catalog = await services.commerce.catalog();
  store.liveServiceOffers = catalog.services;
  store.subscriptionOffers = catalog.plans;
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
  await syncLiveSubscription(store);
  store.update();
}

Future<void> syncLiveSubscription(DemoStore store) async {
  final commerce = ensureLiveServices(store).commerce;
  if (commerce is! PlanCheckoutRepository) return;
  final subscription = await (commerce as PlanCheckoutRepository)
      .subscription();
  final purchases = await (commerce as PlanCheckoutRepository).purchases();
  store.planSubscription = subscription;
  store.planPurchases = purchases;
  store.update();
}

Future<bool> checkoutLiveService(
  DemoStore store,
  String serviceId, {
  required Future<bool> Function() confirmSandbox,
  String? planId,
  void Function(AppFailure failure)? onFailure,
}) async {
  final offer = planId == null
      ? store.serviceById(serviceId)
      : store.subscriptionServiceById(planId);
  if (offer == null) return false;
  final commerce = ensureLiveServices(store).commerce;
  if (commerce is! PlanCheckoutRepository) {
    store.liveNotice = 'پرداخت مستقیم در دسترس نیست.';
    return false;
  }
  store.liveNotice = null;
  store.liveOrderKey ??= newIdempotencyKey();
  try {
    final storeName = await StoreBilling.current();
    final billingStore = storeName == 'bazaar' || storeName == 'myket';
    await settleCheckout(
      commerce as PlanCheckoutRepository,
      serviceCode: _serviceCode(serviceId),
      expectedPriceToman: offer.priceToman,
      idempotencyKey: store.liveOrderKey!,
      parentRequestId: serviceId == 'new-plan' ? null : store.userRequestId,
      planId: planId,
      gateway: billingStore || storeName == 'preview' ? storeName : null,
      purchaseInStore: billingStore ? StoreBilling.purchase : null,
      consumeStorePurchase: billingStore ? StoreBilling.consume : null,
      openUrl: store.openPaymentUrl,
      confirmSandbox: storeName == 'preview' ? () async => true : confirmSandbox,
    );
    store.liveOrderKey = null;
  } on AppFailure catch (error) {
    if (error.code == 'payment_failed' || error.code == 'price_changed') {
      store.liveOrderKey = null;
    }
    store.liveNotice = error.message;
    onFailure?.call(error);
    if (error.expired) await store.signOutCustomer();
    return false;
  }
  // Payment has succeeded even when refreshing the dashboard is temporarily unavailable.
  try {
    await refreshLive(store);
    await syncLiveSubscription(store);
  } on AppFailure {
    store.liveNotice =
        'پرداخت تأیید شد؛ اطلاعات پلن با اتصال دوباره به‌روز می‌شود.';
  }
  return true;
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
  if (store.customerAuth?.session == null) return;
  if (store.customerAuth == null && store.liveServices == null) return;
  final services = ensureLiveServices(store);
  PlanRequestInfo? request;
  PublishedPlan? plan;
  var wallet = store.walletBalance;
  var name = store.questionnaire.name;
  try {
    await syncLiveSubscription(store);
  } on AppFailure {
    // Keep the previously confirmed subscription until the next refresh.
  }
  try {
    request = await services.plans.latestRequest();
  } on AppFailure catch (e) {
    if (e.expired) {
      await store.signOutCustomer();
      return;
    }
    store.liveNotice = e.message;
    store.update();
    return;
  }
  try {
    plan = await services.plans.publishedPlan();
  } on AppFailure catch (e) {
    if (e.expired) {
      await store.signOutCustomer();
      return;
    }
    store.liveNotice = e.message;
    store.update();
    return;
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
  store.liveNotice = null;
  store.liveOpenQuestions = request?.openQuestions ?? const [];
  showServerPlan(
    store,
    name: name,
    track: profile?.track,
    request: request,
    plan: plan,
    walletToman: wallet,
    targetKcal: profile?.targetKcal,
    profile: profile,
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
