import 'dart:convert';
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:sabzine_flutter/app.dart';
import 'package:sabzine_flutter/data/customer_auth.dart';
import 'package:sabzine_flutter/data/demo_store.dart';

import 'customer_auth_test.dart' show TokenMemory;
import 'widget_test.dart' show mobile;

void main() {
  testWidgets('consented SMS fills the login code without manual typing', (
    tester,
  ) async {
    mobile(tester);
    const channel = MethodChannel('ir.sabzine/sms_otp');
    final sms = Completer<String?>();
    final messenger =
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
    var ready = false;
    messenger.setMockMethodCallHandler(channel, (call) async {
      if (call.method == 'start') {
        ready = true;
        return null;
      }
      if (call.method == 'read') return sms.future;
      return null;
    });
    addTearDown(() => messenger.setMockMethodCallHandler(channel, null));
    final client = MockClient((request) async {
      expect(ready, isTrue);
      return http.Response('{}', 200);
    });
    addTearDown(client.close);
    final store = DemoStore(
      customerAuth: CustomerAuth(
        baseUrl: 'https://example.test',
        storage: TokenMemory(),
        client: client,
      ),
    );
    addTearDown(store.dispose);
    await tester.pumpWidget(SabzineApp(store: store));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField), '09123456789');
    await tester.tap(find.text('ورود'));
    await tester.pumpAndSettle();
    expect(find.text('کد تأیید پیامکی'), findsOneWidget);
    tester.view.viewInsets = const FakeViewPadding(bottom: 300);
    addTearDown(tester.view.resetViewInsets);
    await tester.pumpAndSettle();
    sms.complete('کد تأیید رژیم من: ۴۵۶۷۸۹\nاعتبار: ۲ دقیقه');
    await tester.pumpAndSettle();
    final field = tester.widget<TextFormField>(find.byType(TextFormField));
    expect(field.controller!.text, '456789');
    expect(find.byType(AutofillGroup), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('phone feedback accepts localized digits and rejects bad input', (
    tester,
  ) async {
    mobile(tester);
    final requests = <Map<String, dynamic>>[];
    final client = MockClient((request) async {
      requests.add(jsonDecode(request.body) as Map<String, dynamic>);
      return http.Response('{}', 200);
    });
    final store = DemoStore(
      customerAuth: CustomerAuth(
        baseUrl: 'https://example.test',
        storage: TokenMemory(),
        client: client,
      ),
    );
    addTearDown(store.dispose);
    addTearDown(client.close);
    await tester.pumpWidget(
      SabzineApp(store: store, splashDuration: Duration.zero),
    );
    await tester.pumpAndSettle();
    final field = find.byType(TextFormField);

    await tester.tap(find.text('ورود'));
    await tester.pumpAndSettle();
    expect(find.text('شماره موبایلت را وارد کن.'), findsOneWidget);
    expect(requests, isEmpty);

    await tester.enterText(field, '08123456789');
    await tester.pumpAndSettle();
    expect(find.text('شماره موبایل باید با ۰۹ شروع شود.'), findsOneWidget);
    await tester.tap(find.text('ورود'));
    await tester.pumpAndSettle();
    expect(requests, isEmpty);

    await tester.enterText(field, '۰۹۱۲۳');
    await tester.tap(find.text('ورود'));
    await tester.pumpAndSettle();
    expect(find.text('شماره موبایل باید ۱۱ رقم باشد.'), findsOneWidget);
    expect(requests, isEmpty);

    for (final phone in ['۰۹۱۲۳۴۵۶۷۸۹', '٠٩١٢٣٤٥٦٧٨٩', '09123456789']) {
      await tester.enterText(field, phone);
      await tester.pumpAndSettle();
      expect(find.text('فرمت شماره درست است.'), findsOneWidget);
      expect(
        tester.widget<TextFormField>(field).controller!.text,
        '09123456789',
      );
    }
    await tester.tap(find.text('ورود'));
    await tester.pumpAndSettle();
    expect(requests, [
      {'phone': '09123456789', 'existingAccountOnly': true},
    ]);
    expect(find.text('کد تأیید پیامکی'), findsOneWidget);
    expect(tester.widget<TextField>(find.byType(TextField)).autofillHints, [
      AutofillHints.oneTimeCode,
    ]);

    await tester.enterText(field, '۱۲۳');
    await tester.tap(find.text('تأیید و ورود'));
    await tester.pumpAndSettle();
    expect(find.text('کد تأیید باید ۶ رقم باشد.'), findsOneWidget);
    expect(requests, hasLength(1));

    await tester.tap(find.text('تغییر شماره یا درخواست کد جدید'));
    await tester.pumpAndSettle();
    expect(tester.widget<TextFormField>(field).controller!.text, '09123456789');
    expect(find.text('فرمت شماره درست است.'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
  });
}
