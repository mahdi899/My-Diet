import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';

import '../../domain/common/digits.dart';

/// Reads one verification SMS after Android's system consent, without SMS permissions.
/// Other platforms keep using the text field's native one-time-code hints.
class SmsOtpAutofill {
  SmsOtpAutofill({required this.controller, required this.onFilled});

  final TextEditingController controller;
  final VoidCallback onFilled;
  static SmsOtpAutofill? _owner;
  static const _channel = MethodChannel('ir.sabzine/sms_otp');
  int _generation = 0;

  /// Call before requesting the SMS so a fast delivery is not missed.
  Future<void> start() async {
    if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) return;
    _owner = this;
    final generation = ++_generation;
    try {
      await _channel
          .invokeMethod<void>('start')
          .timeout(const Duration(seconds: 2));
      if (generation == _generation && identical(_owner, this)) {
        unawaited(_receive(generation));
      }
    } on PlatformException {
      if (generation == _generation && identical(_owner, this)) _owner = null;
    } on MissingPluginException {
      if (generation == _generation && identical(_owner, this)) _owner = null;
    } on TimeoutException {
      if (generation == _generation && identical(_owner, this)) stop();
    }
  }

  Future<void> _receive(int generation) async {
    String? message;
    try {
      message = await _channel.invokeMethod<String>('read');
    } on PlatformException {
      // The keyboard and manual input remain available if the device cannot read SMS.
    } on MissingPluginException {
      // Unsupported embedders rely on their native autofill hints.
    }
    if (generation != _generation || !identical(_owner, this)) return;
    _owner = null;
    final code = RegExp(
      r'(?<!\d)\d{6}(?!\d)',
    ).firstMatch(latinDigits(message ?? ''))?.group(0);
    if (code == null) return;
    controller.value = TextEditingValue(
      text: code,
      selection: TextSelection.collapsed(offset: code.length),
    );
    onFilled();
  }

  void stop() {
    _generation++;
    if (!identical(_owner, this)) return;
    _owner = null;
    unawaited(_cancel());
  }

  Future<void> _cancel() async {
    try {
      await _channel.invokeMethod<void>('stop');
    } on PlatformException {
      // The listener may already be gone with the native activity.
    } on MissingPluginException {
      // There is no native listener on this embedder.
    }
  }
}
