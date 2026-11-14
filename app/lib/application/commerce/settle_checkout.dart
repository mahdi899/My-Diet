import '../../domain/commerce/commerce.dart';
import '../../domain/common/failure.dart';

Future<void> settleCheckout(
  PlanCheckoutRepository commerce, {
  required String serviceCode,
  required int expectedPriceToman,
  required String idempotencyKey,
  String? parentRequestId,
  String? planId,
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
