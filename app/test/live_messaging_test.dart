import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/data/customer_auth.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/presentation/screens/messaging.dart';

import 'messaging_test.dart' show Tokens;

Future<DemoStore> openChat(
  WidgetTester t,
  Future<http.Response> Function(http.Request) handler,
) async {
  t.view.physicalSize = const Size(390, 844);
  t.view.devicePixelRatio = 1;
  addTearDown(t.view.reset);
  final token =
      'fixture.${base64Url.encode(utf8.encode('{"sub":"patient"}'))}.signature';
  final auth =
      CustomerAuth(
          baseUrl: 'https://fixture.invalid',
          storage: Tokens(),
          client: MockClient(handler),
        )
        ..session = CustomerSession.fromJson({
          'accessToken': token,
          'role': 'user',
          'sessionExpiresAt': DateTime.now()
              .add(const Duration(days: 1))
              .toIso8601String(),
        });
  final store = DemoStore(customerAuth: auth);
  addTearDown(() {
    store.dispose();
    auth.dispose();
  });
  await t.pumpWidget(
    DemoScope(
      store: store,
      child: MaterialApp(
        theme: appTheme(),
        home: const Directionality(
          textDirection: TextDirection.rtl,
          child: MessagingScreen(
            threadId: 'fixture-conversation',
            support: true,
          ),
        ),
      ),
    ),
  );
  await t.pumpAndSettle();
  return store;
}

Map<String, dynamic> row(String id, String body) => {
  'id': id,
  'body': body,
  'authorId': 'patient',
  'createdAt': '2026-11-16T08:00:00Z',
};

void main() {
  testWidgets(
    'live send survives refresh and failed refresh without duplication',
    (t) async {
      final rows = [row('old', 'پیام قبلی')];
      var failLoad = false;
      var posts = 0;
      await openChat(t, (request) async {
        if (request.url.path.endsWith('/messages')) {
          if (request.method == 'POST') {
            posts++;
            rows.add(row('new', jsonDecode(request.body)['body']));
            return http.Response('{"id":"new"}', 200);
          }
          return failLoad
              ? http.Response('{"detail":"offline"}', 503)
              : http.Response(
                  jsonEncode(rows),
                  200,
                  headers: {'content-type': 'application/json; charset=utf-8'},
                );
        }
        return http.Response('{}', 200);
      });
      expect(
        find.text('پیام قبلی'),
        findsOneWidget,
        reason: t
            .widgetList<Text>(find.byType(Text))
            .map((w) => w.data)
            .join(' | '),
      );
      await t.enterText(find.byKey(const ValueKey('chat-input')), 'پیام زنده');
      await t.tap(find.byTooltip('ارسال پیام'));
      await t.pumpAndSettle();
      expect(find.text('پیام زنده'), findsOneWidget);
      expect(posts, 1);
      await t.tap(find.byTooltip('تازه‌سازی پیام‌ها'));
      await t.pumpAndSettle();
      expect(find.text('پیام زنده'), findsOneWidget);
      expect(find.text('پیام قبلی'), findsOneWidget);
      failLoad = true;
      await t.tap(find.byTooltip('تازه‌سازی پیام‌ها'));
      await t.pumpAndSettle();
      expect(find.text('پیام زنده'), findsOneWidget);
      expect(find.text('پیام قبلی'), findsOneWidget);
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
    },
  );

  testWidgets('live failed send remains visible and retry uses one bubble', (
    t,
  ) async {
    var failSend = true;
    var posts = 0;
    await openChat(t, (request) async {
      if (request.url.path.endsWith('/messages')) {
        if (request.method == 'POST') {
          posts++;
          return failSend
              ? http.Response('{"detail":"offline"}', 503)
              : http.Response('{"id":"saved"}', 200);
        }
        return http.Response('[]', 200);
      }
      return http.Response('{}', 200);
    });
    await t.enterText(find.byKey(const ValueKey('chat-input')), 'ارسال دوباره');
    await t.tap(find.byTooltip('ارسال پیام'));
    await t.pumpAndSettle();
    expect(find.text('تلاش مجدد'), findsOneWidget);
    expect(find.byType(SelectableText), findsOneWidget);
    failSend = false;
    await t.tap(find.text('تلاش مجدد'));
    await t.pumpAndSettle();
    expect(find.text('تلاش مجدد'), findsNothing);
    expect(find.byType(SelectableText), findsOneWidget);
    expect(posts, 2);
    expect(t.takeException(), isNull);
    await t.pumpWidget(const SizedBox());
  });
}
