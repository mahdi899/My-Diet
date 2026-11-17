import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:file_picker/file_picker.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/data/customer_auth.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/presentation/screens/messaging.dart';
import 'package:sabzine_flutter/presentation/screens/shared.dart';

import 'messaging_test.dart' show Tokens;

final photoBytes = base64Decode(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=',
);

class PhotoPicker extends FilePicker {
  @override
  Future<FilePickerResult?> pickFiles({
    String? dialogTitle,
    String? initialDirectory,
    FileType type = FileType.any,
    List<String>? allowedExtensions,
    Function(FilePickerStatus)? onFileLoading,
    bool allowCompression = false,
    int compressionQuality = 0,
    bool allowMultiple = false,
    bool withData = false,
    bool withReadStream = false,
    bool lockParentWindow = false,
    bool readSequential = false,
  }) async => FilePickerResult([
    PlatformFile(name: 'photo.png', size: photoBytes.length, bytes: photoBytes),
  ]);
}

Future<DemoStore> openChat(
  WidgetTester t,
  Future<http.Response> Function(http.Request) handler, {
  Widget? home,
}) async {
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
        home: Directionality(
          textDirection: TextDirection.rtl,
          child:
              home ??
              const MessagingScreen(
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
    final clientIds = <String>[];
    await openChat(t, (request) async {
      if (request.url.path.endsWith('/messages')) {
        if (request.method == 'POST') {
          posts++;
          clientIds.add(jsonDecode(request.body)['clientRequestId'] as String);
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
    expect(clientIds.toSet(), hasLength(1));
    expect(
      clientIds.singleOrNull ?? clientIds.first,
      matches(
        RegExp(
          r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
        ),
      ),
    );
    expect(t.takeException(), isNull);
    await t.pumpWidget(const SizedBox());
  });

  testWidgets(
    'support opens directly and automatically receives the admin reply',
    (t) async {
      var opened = 0;
      var replied = false;
      await openChat(t, (request) async {
        if (request.url.path.endsWith('/support-conversation')) {
          opened++;
          return http.Response('{"id":"support-id"}', 200);
        }
        if (request.url.path.endsWith('/messages')) {
          return http.Response(
            jsonEncode(
              replied
                  ? [
                      {...row('reply', 'پاسخ مدیر'), 'authorId': 'admin'},
                    ]
                  : [],
            ),
            200,
            headers: {'content-type': 'application/json; charset=utf-8'},
          );
        }
        return http.Response('{}', 200);
      }, home: const MessagesScreen(support: true));
      expect(opened, 1);
      expect(find.text('پشتیبانی رژیم من'), findsOneWidget);
      replied = true;
      await t.pump(const Duration(seconds: 10));
      await t.pumpAndSettle();
      expect(find.text('پاسخ مدیر'), findsOneWidget);
      expect(opened, 1);
      await t.pumpWidget(const SizedBox());
    },
  );

  testWidgets('a lost send response reconciles by client id on refresh', (
    t,
  ) async {
    String? clientId;
    await openChat(t, (request) async {
      if (request.url.path.endsWith('/messages')) {
        if (request.method == 'POST') {
          clientId = jsonDecode(request.body)['clientRequestId'];
          return http.Response('{"detail":"response lost"}', 503);
        }
        return http.Response(
          jsonEncode(
            clientId == null
                ? []
                : [
                    {
                      ...row('persisted', 'پیام ثبت‌شده'),
                      'clientRequestId': clientId,
                    },
                  ],
          ),
          200,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      }
      return http.Response('{}', 200);
    });
    await t.enterText(find.byKey(const ValueKey('chat-input')), 'پیام ثبت‌شده');
    await t.tap(find.byTooltip('ارسال پیام'));
    await t.pumpAndSettle();
    expect(find.text('تلاش مجدد'), findsOneWidget);
    await t.tap(find.byTooltip('تازه‌سازی پیام‌ها'));
    await t.pumpAndSettle();
    expect(find.text('پیام ثبت‌شده'), findsOneWidget);
    expect(find.text('تلاش مجدد'), findsNothing);
    await t.pumpWidget(const SizedBox());
  });

  testWidgets('photo uploads before sending and downloads after reopening', (
    t,
  ) async {
    FilePicker.platform = PhotoPicker();
    var uploaded = false;
    var posted = false;
    var downloads = 0;
    Future<http.Response> handler(http.Request request) async {
      final path = request.url.path;
      if (path.endsWith('/messages')) {
        if (request.method == 'POST') {
          expect(uploaded, true);
          expect(jsonDecode(request.body)['mediaId'], 'photo-id');
          posted = true;
          return http.Response('{"id":"saved"}', 200);
        }
        return http.Response(
          jsonEncode(
            posted
                ? [
                    {
                      ...row('saved', ''),
                      'kind': 'image',
                      'mediaId': 'photo-id',
                    },
                  ]
                : [],
          ),
          200,
        );
      }
      if (path.endsWith('/media')) {
        return http.Response('{"id":"photo-id"}', 200);
      }
      if (path.endsWith('/media/photo-id')) {
        expect(
          base64Decode(jsonDecode(request.body)['contentBase64']),
          photoBytes,
        );
        uploaded = true;
        return http.Response('{"status":"ready"}', 200);
      }
      if (path.endsWith('/access')) {
        return http.Response('{"grant":"grant"}', 200);
      }
      if (path.endsWith('/content')) {
        downloads++;
        return http.Response(
          jsonEncode({
            'contentBase64': base64Encode(photoBytes),
            'detectedType': 'image/png',
          }),
          200,
        );
      }
      return http.Response('{}', 200);
    }

    await openChat(t, handler);
    await t.tap(find.byTooltip('انتخاب عکس'));
    await t.pumpAndSettle();
    await t.tap(find.byTooltip('ارسال پیام'));
    await t.pumpAndSettle();
    expect(posted, true);
    await t.pumpWidget(const SizedBox());
    await openChat(t, handler);
    expect(downloads, 1);
    expect(find.byType(Image), findsOneWidget);
    expect(t.takeException(), isNull);
    await t.pumpWidget(const SizedBox());
  });
}
