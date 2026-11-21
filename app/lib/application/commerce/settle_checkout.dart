import '../../domain/commerce/commerce.dart';
import '../../domain/common/failure.dart';

Future<void> settleCheckout(
  PlanCheckoutRepository commerce, {
  required String serviceCode,
  required int expectedPriceToman,
  required String idempotencyKey,
  String? parentRequestId,
  String? planId,
  String? gateway,
  Future<StoreReceipt> Function(String sku, String payload)? purchaseInStore,
  Future<void> Function(String token)? consumeStorePurchase,
  Future<void> Function(Uri url)? openUrl,
  required Future<bool> Function() confirmSandbox,
  Duration pollEvery = const Duration(seconds: 2),
  int attempts = 90,
}) async {
  var payment = await commerce.startCheckout(
    serviceCode: serviceCode,
    expectedPriceToman: expectedPriceToman,
    idempotencyKey: idempotencyKey,
    parentRequestId: parentRequestId,
    planId: planId,
    gateway: gateway,
  );
  if (payment.status == 'paid') return;
  if (payment.status == 'failed') {
    throw const AppFailure(
      'پرداخت انجام نشد. دوباره تلاش کن.',
      code: 'payment_failed',
    );
  }
  final id = payment.paymentId;
  if (id == null) throw const CommerceException('اطلاعات پرداخت دریافت نشد.');
  if (payment.gateway == 'bazaar' || payment.gateway == 'myket') {
    final sku = payment.storeSku;
    if (sku == null || purchaseInStore == null) {
      throw const CommerceException(
        'پرداخت درون‌برنامه‌ای این فروشگاه آماده نیست.',
      );
    }
    final receipt = await purchaseInStore(sku, id);
    payment = await commerce.confirmStorePurchase(
      id,
      productId: receipt.productId,
      purchaseToken: receipt.purchaseToken,
      orderId: receipt.orderId,
      signature: receipt.signature,
    );
    if (payment.status == 'paid') {
      if (consumeStorePurchase != null) {
        try {
          await consumeStorePurchase(receipt.purchaseToken);
        } on Object {
          // The plan is already paid. Consumption only lets the same product be bought again.
        }
      }
      return;
    }
    throw const AppFailure(
      'پرداخت فروشگاه هنوز تأیید نشده است.',
      code: 'payment_pending',
    );
  }
  if (payment.gateway == 'sandbox') {
    payment = await commerce.completeCheckoutSandbox(
      id,
      success: await confirmSandbox(),
    );
    if (payment.status == 'paid') return;
    throw const AppFailure(
      'پرداخت لغو شد؛ پلنی فعال نشد.',
      code: 'payment_failed',
    );
  }
  final url = payment.redirectUrl;
  if (url == null || openUrl == null) {
    throw const CommerceException('درگاه پرداخت در این دستگاه در دسترس نیست.');
  }
  await openUrl(Uri.parse(url));
  for (var i = 0; i < attempts; i++) {
    await Future<void>.delayed(pollEvery);
    payment = await commerce.checkoutStatus(id);
    if (payment.status == 'paid') return;
    if (payment.status == 'failed') {
      throw const AppFailure(
        'پرداخت انجام نشد. دوباره تلاش کن.',
        code: 'payment_failed',
      );
    }
  }
  throw const AppFailure(
    'پرداخت هنوز تأیید نشده است. برای بررسی نتیجه دوباره ادامه بده.',
    code: 'payment_pending',
  );
}
