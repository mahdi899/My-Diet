import '../../core/network/api_client.dart';
import '../../domain/commerce/commerce.dart';

class HttpCommerceRepository implements CommerceRepository {
  HttpCommerceRepository(this._api);
  final ApiClient _api;

  @override
  Future<Catalog> catalog() async {
    final data = await _api.get('catalog') as Map<String, dynamic>;
    return Catalog(
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
