import 'package:flutter/services.dart';

Future<bool> shareShoppingText(String text) async {
  try {
    return await const MethodChannel(
          'ir.sabzine/share',
        ).invokeMethod<bool>('text', {'text': text}) ??
        false;
  } on MissingPluginException {
    return false;
  }
}
