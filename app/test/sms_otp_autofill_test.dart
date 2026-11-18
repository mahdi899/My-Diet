import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/presentation/widgets/sms_otp_autofill.dart';

const _channel = MethodChannel('ir.sabzine/sms_otp');

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final messenger =
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
  tearDown(() => messenger.setMockMethodCallHandler(_channel, null));

  testWidgets('consented SMS fills six digits, including localized digits', (
    tester,
  ) async {
    final controller = TextEditingController();
    addTearDown(controller.dispose);
    var filled = 0;
    final autofill = SmsOtpAutofill(
      controller: controller,
      onFilled: () => filled++,
    );
    addTearDown(autofill.stop);
    for (final code in ['123456', '۱۲۳۴۵۶', '١٢٣٤٥٦']) {
      controller.clear();
      messenger.setMockMethodCallHandler(
        _channel,
        (call) async => call.method == 'read'
            ? 'کد تأیید رژیم من: $code\nاعتبار: ۲ دقیقه'
            : null,
      );
      await autofill.start();
      await tester.pump();
      expect(controller.text, '123456');
      expect(controller.selection.baseOffset, 6);
    }
    expect(filled, 3);
  });

  testWidgets(
    'invalid, canceled or unavailable SMS leaves manual input usable',
    (tester) async {
      final controller = TextEditingController(text: '12');
      addTearDown(controller.dispose);
      final autofill = SmsOtpAutofill(
        controller: controller,
        onFilled: () => fail('No valid code'),
      );
      addTearDown(autofill.stop);
      for (final sms in ['بدون کد', 'کد 12345', 'کد 1234567', null]) {
        messenger.setMockMethodCallHandler(
          _channel,
          (call) async => call.method == 'read' ? sms : null,
        );
        await autofill.start();
        await tester.pump();
        expect(controller.text, '12');
      }
      messenger.setMockMethodCallHandler(
        _channel,
        (_) async => throw PlatformException(code: 'unavailable'),
      );
      await autofill.start();
      expect(controller.text, '12');
    },
  );

  testWidgets(
    'leaving verification ignores a late SMS after controller disposal',
    (tester) async {
      final reply = Completer<String?>();
      messenger.setMockMethodCallHandler(
        _channel,
        (call) async => call.method == 'read' ? reply.future : null,
      );
      final controller = TextEditingController();
      final autofill = SmsOtpAutofill(
        controller: controller,
        onFilled: () => fail('Screen was closed'),
      );
      await autofill.start();
      await tester.pump();
      autofill.stop();
      controller.dispose();
      reply.complete('کد 123456');
      await tester.pump();
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('resending ignores the old request result', (tester) async {
    final replies = [Completer<String?>(), Completer<String?>()];
    var requested = 0;
    messenger.setMockMethodCallHandler(
      _channel,
      (call) async =>
          call.method == 'read' ? replies[requested++].future : null,
    );
    final controller = TextEditingController();
    addTearDown(controller.dispose);
    var filled = 0;
    final autofill = SmsOtpAutofill(
      controller: controller,
      onFilled: () => filled++,
    );
    addTearDown(autofill.stop);
    await autofill.start();
    await tester.pump();
    await autofill.start();
    await tester.pump();
    replies[0].complete('کد 111111');
    await tester.pump();
    expect(controller.text, isEmpty);
    replies[1].complete('کد 222222');
    await tester.pump();
    expect(controller.text, '222222');
    expect(filled, 1);
  });

  testWidgets('SMS listening is ready before the send step can proceed', (
    tester,
  ) async {
    final ready = Completer<void>();
    final reply = Completer<String?>();
    var reads = 0;
    messenger.setMockMethodCallHandler(_channel, (call) async {
      if (call.method == 'start') {
        await ready.future;
        return null;
      }
      if (call.method == 'read') {
        reads++;
        return reply.future;
      }
      return null;
    });
    final controller = TextEditingController();
    addTearDown(controller.dispose);
    final autofill = SmsOtpAutofill(controller: controller, onFilled: () {});
    addTearDown(autofill.stop);
    var prepared = false;
    final start = autofill.start().then((_) => prepared = true);
    await tester.pump();
    expect(prepared, isFalse);
    expect(reads, 0);
    ready.complete();
    await start;
    await tester.pump();
    expect(reads, 1);
    reply.complete(null);
    await tester.pump();
  });

  testWidgets('other platforms rely on their one-time-code suggestions', (
    tester,
  ) async {
    var calls = 0;
    messenger.setMockMethodCallHandler(_channel, (_) async {
      calls++;
      return null;
    });
    final controller = TextEditingController();
    addTearDown(controller.dispose);
    final autofill = SmsOtpAutofill(
      controller: controller,
      onFilled: () => fail('Unsupported platform'),
    );
    await autofill.start();
    expect(calls, 0);
  }, variant: TargetPlatformVariant.only(TargetPlatform.iOS));
}
