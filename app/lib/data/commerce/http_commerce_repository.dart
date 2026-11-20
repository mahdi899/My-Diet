import '../../core/network/api_client.dart';
import '../../domain/commerce/commerce.dart';

class HttpCommerceRepository
    implements CommerceRepository, PlanCheckoutRepository {
  HttpCommerceRepository(this._api);
  final ApiClient _api;

  PlanCheckout _checkout(dynamic data) => PlanCheckout(
    status: data['status'] as String,
    paymentId: data['paymentId'] as String?,
    gateway: data['gateway'] as String?,
    redirectUrl: data['redirectUrl'] as String?,
  );

  @override
  Future<PlanSubscription?> subscription() async {
    final data = (await _api.get('me/subscription'))['subscription'];
    if (data == null) return null;
    return PlanSubscription(
      title: data['title'] as String,
      status: data['status'] as String,
      planId: data['planId'] as String?,
      endsAt: DateTime.tryParse(data['endsAt'] as String? ?? ''),
      includedChanges: data['includedChanges'] == true,
    );
  }

  @override
  Future<List<PlanPurchase>> purchases() async {
    final data = await _api.get('me/orders') as List;
    return [
      for (final row in data)
        PlanPurchase(
          id: row['id'] as String,
          title: row['title'] as String,
          priceToman: row['priceToman'] as int,
          status: row['status'] as String,
        ),
    ];
  }

  @override
  Future<PlanCheckout> startCheckout({
    required String serviceCode,
    required int expectedPriceToman,
    required String idempotencyKey,
    String? parentRequestId,
    String? planId,
  }) async => _checkout(
    await _api.post(
      'me/checkouts',
      body: {
        'serviceCode': serviceCode,
        'expectedPriceToman': expectedPriceToman,
        'parentRequestId': ?parentRequestId,
        'planId': ?planId,
      },
      headers: {'Idempotency-Key': idempotencyKey},
    ),
  );

  @override
  Future<PlanCheckout> checkoutStatus(String paymentId) async =>
      _checkout(await _api.get('me/checkouts/$paymentId'));

  @override
  Future<PlanCheckout> completeCheckoutSandbox(
    String paymentId, {
    required bool success,
  }) async => _checkout(
    await _api.post(
      'me/checkouts/$paymentId/sandbox',
      body: {'success': success},
    ),
  );

  @override
  Future<Catalog> catalog() async {
    final data = await _api.get('catalog') as Map<String, dynamic>;
    return Catalog(
      plans: [
        for (final plan in (data['plans'] as List? ?? []))
          SubscriptionPlanOffer(
            id: plan['id'] as String,
            title: plan['title'] as String,
            description: plan['description'] as String,
            days: plan['days'] as int,
            priceToman: plan['priceToman'] as int,
            features: (plan['features'] as List).cast<String>(),
          ),
      ],
      services: [
        for (final s in data['services'] as List)
          ServiceOffer(
            code: (s as Map)['code'] as String,
            title: s['titleFa'] as String,
            priceToman: s['priceToman'] as int,
          ),
      ],
      topups: [
        for (final t in data['topups'] as List)
          TopupPackage(
            code: (t as Map)['code'] as String,
            amountToman: t['amountToman'] as int,
          ),
      ],
    );
  }

  @override
  Future<Wallet> wallet() async {
    final data = await _api.get('me/wallet') as Map<String, dynamic>;
    return Wallet(
      cashToman: data['cashToman'] as int,
      promoToman: data['promoToman'] as int,
    );
  }

  @override
  Future<List<String>> gateways() async {
    final data = await _api.get('payments/gateways');
    final list = data is List ? data : (data as Map)['gateways'] as List;
    return [for (final g in list) (g as Map)['name'] as String];
  }

  @override
  Future<TopupStart> startTopup(String packageCode, {String? gateway}) async {
    final data =
        await _api.post(
              'me/topups',
              body: {'packageCode': packageCode, 'gateway': ?gateway},
            )
            as Map<String, dynamic>;
    return TopupStart(
      paymentId: data['paymentId'] as String,
      gateway: data['gateway'] as String,
      redirectUrl: data['redirectUrl'] as String?,
    );
  }

  @override
  Future<Wallet> completeSandbox(String paymentId) async {
    final data =
        await _api.post(
              'payments/sandbox/complete',
              body: {'paymentId': paymentId},
            )
            as Map<String, dynamic>;
    return Wallet(
      cashToman: data['cashToman'] as int,
      promoToman: data['promoToman'] as int,
    );
  }

  @override
  Future<String> topupStatus(String paymentId) async {
    final data = await _api.get('me/topups/$paymentId') as Map<String, dynamic>;
    return data['status'] as String;
  }

  @override
  Future<OrderResult> placeOrder({
    required String serviceCode,
    required int expectedPriceToman,
    required String idempotencyKey,
    String? parentRequestId,
  }) async {
    final data =
        await _api.post(
              'me/orders',
              body: {
                'serviceCode': serviceCode,
                'expectedPriceToman': expectedPriceToman,
                'parentRequestId': ?parentRequestId,
              },
              headers: {'Idempotency-Key': idempotencyKey},
            )
            as Map<String, dynamic>;
    return OrderResult(
      orderId: data['orderId'] as String,
      requestId: data['requestId'] as String,
    );
  }
}
