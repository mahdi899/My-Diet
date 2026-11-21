import 'package:flutter/services.dart';

import '../../domain/commerce/commerce.dart';
import '../../domain/common/failure.dart';

class StoreBilling {
  static const _channel = MethodChannel('ir.sabzine/store_billing');

  static Future<String?> current() async {
    try {
      final value = await _channel.invokeMethod<String>('channel');
      if (value == 'bazaar' || value == 'myket' || value == 'preview') return value;
    } on MissingPluginException {
      return null;
    } on PlatformException {
      return null;
    }
    return null;
  }

  static Future<StoreReceipt> purchase(String sku, String payload) async {
    try {
      final raw = await _channel.invokeMapMethod<String, dynamic>('purchase', {
        'sku': sku,
        'payload': payload,
      });
      final productId = raw?['productId'] as String?;
      final token = raw?['purchaseToken'] as String?;
      if (productId == null ||
          productId.isEmpty ||
          token == null ||
          token.isEmpty) {
        throw const AppFailure(
          'رسید خرید فروشگاه ناقص است.',
          code: 'payment_failed',
        );
      }
      return StoreReceipt(
        productId: productId,
        purchaseToken: token,
        orderId: raw?['orderId'] as String?,
        signature: raw?['signature'] as String?,
      );
    } on PlatformException catch (error) {
      throw AppFailure(
        error.message ?? 'پرداخت فروشگاه انجام نشد.',
        code: 'payment_failed',
      );
    }
  }

  static Future<void> consume(String token) async {
    try {
      await _channel.invokeMethod<void>('consume', {'token': token});
    } on PlatformException catch (error) {
      throw AppFailure(error.message ?? 'مصرف خرید انجام نشد.');
    }
  }
}
