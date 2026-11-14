import '../../domain/commerce/commerce.dart';
import '../../domain/common/failure.dart';

/// Starts a top-up and waits until the wallet is credited.
/// Sandbox payments complete in-app. Hosted gateways use the supplied browser port.
Future<Wallet> settleTopup(
  CommerceRepository commerce,
  String packageCode, {
  Future<void> Function(Uri url)? openUrl,
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
  if (url == null || openUrl == null) {
    throw const CommerceException('درگاه پرداخت در این دستگاه در دسترس نیست.');
  }
  await openUrl(Uri.parse(url));
  for (var i = 0; i < attempts; i++) {
    await Future<void>.delayed(pollEvery);
    if (await commerce.topupStatus(start.paymentId) == 'credited') {
      return commerce.wallet();
    }
  }
  throw const CommerceException(
    'پرداخت هنوز تأیید نشده؛ اگر پرداخت کردی چند لحظه بعد موجودی را ببین.',
  );
}
