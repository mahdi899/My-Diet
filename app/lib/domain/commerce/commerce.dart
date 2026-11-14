import 'dart:math';

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
