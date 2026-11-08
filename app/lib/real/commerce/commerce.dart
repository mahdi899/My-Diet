import 'dart:math';
import '../core/api.dart';

class ServiceOffer {
  const ServiceOffer({
    required this.code,
    required this.title,
    required this.priceToman,
  });
  final String code, title;
  final int priceToman;
}

class TopupPackage {
  const TopupPackage({required this.code, required this.amountToman});
  final String code;
  final int amountToman;
}

class Catalog {
  const Catalog({required this.services, required this.topups});
  final List<ServiceOffer> services;
  final List<TopupPackage> topups;

  ServiceOffer? service(String code) {
    for (final s in services) {
      if (s.code == code) return s;
    }
    return null;
  }
}

class Wallet {
  const Wallet({required this.cashToman, required this.promoToman});
  final int cashToman, promoToman;
  int get total => cashToman + promoToman;
}

class TopupStart {
  const TopupStart({
    required this.paymentId,
    required this.gateway,
    this.redirectUrl,
  });
  final String paymentId, gateway;

  /// Set by hosted gateways (Zarinpal); null for the in-app sandbox.
  final String? redirectUrl;
}

class OrderResult {
  const OrderResult({required this.orderId, required this.requestId});
  final String orderId, requestId;
}

abstract interface class CommerceRepository {
  Future<Catalog> catalog();
  Future<Wallet> wallet();
  Future<List<String>> gateways();
  Future<TopupStart> startTopup(String packageCode, {String? gateway});

  /// Sandbox only: marks the payment as paid. Hosted gateways credit through the server callback.
  Future<Wallet> completeSandbox(String paymentId);
  Future<String> topupStatus(String paymentId);

  /// `idempotencyKey` must be reused when retrying the same purchase, so a flaky network
  /// can never charge twice.
  Future<OrderResult> placeOrder({
    required String serviceCode,
    required int expectedPriceToman,
    required String idempotencyKey,
    String? parentRequestId,
  });
}

String newIdempotencyKey() {
  final r = Random.secure();
  final bytes = List.generate(16, (_) => r.nextInt(256));
  return 'app-${bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join()}';
}

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
