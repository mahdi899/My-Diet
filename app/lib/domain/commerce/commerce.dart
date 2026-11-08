import 'dart:math';
import '../../core/network/api_client.dart';

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

/// Opens a hosted gateway page. Set once at startup; null in tests until a test assigns it.
Future<void> Function(Uri url)? openExternalUrl;

/// Starts a top-up and waits until the wallet is credited.
/// Sandbox payments complete in-app. Hosted gateways open [openExternalUrl] and poll.
Future<Wallet> settleTopup(
  CommerceRepository commerce,
  String packageCode, {
  Duration pollEvery = const Duration(seconds: 2),
  int attempts = 90,
}) async {
  final gateways = await commerce.gateways();
  final hosted = gateways.where((g) => g != 'sandbox').toList();
  final gateway = hosted.isNotEmpty ? hosted.first : 'sandbox';
  final start = await commerce.startTopup(packageCode, gateway: gateway);
  if (start.gateway == 'sandbox') {
    return commerce.completeSandbox(start.paymentId);
  }
  final url = start.redirectUrl;
  if (url == null || openExternalUrl == null) {
    throw const ApiException('درگاه پرداخت در این دستگاه در دسترس نیست.');
  }
  await openExternalUrl!(Uri.parse(url));
  for (var i = 0; i < attempts; i++) {
    await Future<void>.delayed(pollEvery);
    if (await commerce.topupStatus(start.paymentId) == 'credited') {
      return commerce.wallet();
    }
  }
  throw const ApiException(
    'پرداخت هنوز تأیید نشده؛ اگر پرداخت کردی چند لحظه بعد موجودی را ببین.',
  );
}

String newIdempotencyKey() {
  final r = Random.secure();
  final bytes = List.generate(16, (_) => r.nextInt(256));
  return 'app-${bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join()}';
}
