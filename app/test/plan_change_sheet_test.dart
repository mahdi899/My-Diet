import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/data/customer_auth.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/features/plan/plan_change_sheet.dart';
import 'package:sabzine_flutter/features/plan/data/plan_change_repository.dart';

import 'messaging_test.dart' show Tokens;

const publishedVersion = '11111111-1111-4111-8111-111111111111';
Map<String, Object?> changePlan() => {
  'versionId': publishedVersion,
  'expired': false,
  'days': [
    for (var i = 0; i < 2; i++)
      {
        'date': '2026-11-${14 + i}',
        'dayIndex': i,
        'meals': [
          {
            'mealType': 'lunch',
            'title': 'غذای اصلی',
            'selectedOptionId': 'selected',
            'options': [
              {
                'optionId': 'primary',
                'title': 'گزینهٔ اصلی',
                'ingredients': [],
                'instructions': '',
              },
              {
                'optionId': 'selected',
                'title': 'عدسی روز ${i + 1}',
                'ingredients': [
                  {'name': 'عدس', 'quantity': 80, 'unit': 'گرم'},
                ],
                'instructions': 'با حرارت ملایم بپز.',
              },
            ],
          },
        ],
      },
  ],
};
const changeReasons = [
  {'id': 'schedule', 'label': 'زمان وعده‌ها', 'active': true},
  {'id': 'preference', 'label': 'تنوع بیشتر', 'active': true},
  {'id': 'inactive', 'label': 'دلیل غیرفعال', 'active': false},
];

http.Response jsonResponse(Object? body, [int status = 200]) => http.Response(
  jsonEncode(body),
  status,
  headers: {'content-type': 'application/json; charset=utf-8'},
);

CustomerAuth changeAuth(
  FutureOr<http.Response> Function(http.Request) handler,
) =>
    CustomerAuth(
        baseUrl: 'https://fixture.invalid',
        storage: Tokens(),
        client: MockClient((r) async => handler(r)),
      )
      ..session = CustomerSession.fromJson({
        'accessToken': 'token',
        'role': 'user',
        'sessionExpiresAt': '2030-01-01T00:00:00Z',
      });

Widget changeHost(DemoStore store, {double scale = 1}) => DemoScope(
  store: store,
  child: MaterialApp(
    debugShowCheckedModeBanner: false,
    theme: appTheme(),
    builder: (context, child) => MediaQuery(
      data: MediaQuery.of(
        context,
      ).copyWith(disableAnimations: true, textScaler: TextScaler.linear(scale)),
      child: Directionality(textDirection: TextDirection.rtl, child: child!),
    ),
    home: Builder(
      builder: (context) => Scaffold(
        body: Center(
          child: FilledButton(
            onPressed: () => showPlanChange(context),
            child: const Text('باز کردن'),
          ),
        ),
      ),
    ),
  ),
);

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));
  setUpAll(() async {
    await (FontLoader('Vazirmatn')
          ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Regular.ttf'))
          ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Bold.ttf')))
        .load();
  });

  Future<void> open(WidgetTester t, DemoStore store, {double scale = 1}) async {
    t.view.physicalSize = const Size(390, 844);
    t.view.devicePixelRatio = 1;
    addTearDown(t.view.reset);
    await t.pumpWidget(changeHost(store, scale: scale));
    await t.tap(find.text('باز کردن'));
    await t.pumpAndSettle();
  }

  test(
    'repository uses selected meal quantities, active reasons and the published version',
    () async {
      final auth = changeAuth(
        (r) => jsonResponse(
          r.url.path.endsWith('/plan') ? changePlan() : changeReasons,
        ),
      );
      addTearDown(auth.dispose);
      final data = await PlanChangeRepository(auth).load();
      expect(data.versionId, publishedVersion);
      expect(data.reasons.map((r) => r.id), ['schedule', 'preference']);
      expect(data.days.first.meals.single.title, 'ناهار · عدسی روز 1');
      expect(data.days.first.meals.single.amount, 'عدس ۸۰ گرم');
      expect(data.days.first.meals.single.instructions, 'با حرارت ملایم بپز.');
    },
  );

  testWidgets(
    'validation, deselection and retry preserve the exact request; pending submission cannot duplicate',
    (t) async {
      final posts = <Map<String, dynamic>>[];
      final pending = Completer<http.Response>();
      final auth = changeAuth((r) {
        if (r.method == 'POST') {
          posts.add(jsonDecode(r.body) as Map<String, dynamic>);
          return posts.length == 1
              ? jsonResponse({
                  'messageFa': 'فعلاً دریافت نشد؛ دوباره تلاش کن.',
                }, 503)
              : pending.future;
        }
        return jsonResponse(
          r.url.path.endsWith('/plan') ? changePlan() : changeReasons,
        );
      });
      final store = DemoStore(customerAuth: auth)..loginDemoUser();
      addTearDown(() {
        store.dispose();
        auth.dispose();
      });
      await open(t, store);
      await t.tap(find.byKey(const ValueKey('plan-change-submit')));
      await t.pumpAndSettle();
      expect(posts, isEmpty);
      expect(
        find.text('حداقل یک دلیل برای تغییر برنامه انتخاب کن.'),
        findsOneWidget,
      );
      for (final id in ['schedule', 'preference', 'preference']) {
        final reason = find.byKey(ValueKey('plan-change-reason-$id'));
        await t.ensureVisible(reason);
        await t.tap(reason);
        await t.pumpAndSettle();
      }
      final notes = find.byKey(const ValueKey('plan-change-details'));
      await t.ensureVisible(notes);
      await t.enterText(notes, '  وقت ناهار کم است  ');
      await t.tap(find.byKey(const ValueKey('plan-change-submit')));
      await t.pumpAndSettle();
      expect(posts.single['reasonIds'], ['schedule']);
      expect(posts.single['versionId'], publishedVersion);
      expect(posts.single['explanation'], 'وقت ناهار کم است');
      expect(posts.single['targets'], isEmpty);
      expect(
        posts.single['commandId'],
        matches(
          RegExp(
            r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
          ),
        ),
      );
      expect(store.userRequest.revisionRequested, isFalse);
      expect(find.byType(PlanChangeSheet), findsOneWidget);
      await t.tap(find.byKey(const ValueKey('plan-change-submit')));
      await t.pump();
      await t.tap(find.byKey(const ValueKey('plan-change-submit')));
      await t.pump();
      expect(posts, hasLength(2));
      expect(posts[1], posts[0]);
      pending.complete(
        jsonResponse({'id': 'saved-change', 'status': 'awaiting_review'}),
      );
      await t.pumpAndSettle();
      expect(find.byType(PlanChangeSheet), findsNothing);
      expect(store.userRequest.revisionRequested, isTrue);
      expect(find.text('درخواست تغییر برای متخصص ارسال شد.'), findsOneWidget);
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
    },
  );

  testWidgets(
    'loading failure and empty reasons can be retried and never enable submission',
    (t) async {
      var attempt = 0;
      final auth = changeAuth((r) {
        if (r.url.path.endsWith('/plan')) return jsonResponse(changePlan());
        attempt++;
        if (attempt == 1) {
          return jsonResponse({'messageFa': 'دریافت دلایل انجام نشد.'}, 503);
        }
        return jsonResponse(attempt == 2 ? [] : changeReasons);
      });
      final store = DemoStore(customerAuth: auth)..loginDemoUser();
      addTearDown(() {
        store.dispose();
        auth.dispose();
      });
      await open(t, store);
      FilledButton submit() => t.widget<FilledButton>(
        find.descendant(
          of: find.byKey(const ValueKey('plan-change-submit')),
          matching: find.byType(FilledButton),
        ),
      );
      expect(submit().onPressed, isNull);
      for (var i = 0; i < 2; i++) {
        final retry = find.byKey(const ValueKey('plan-change-retry'));
        await t.ensureVisible(retry);
        await t.tap(retry);
        await t.pumpAndSettle();
        if (i == 0) expect(submit().onPressed, isNull);
      }
      expect(submit().onPressed, isNotNull);
      expect(find.text('دلیل غیرفعال'), findsNothing);
      await t.tap(find.text('انصراف'));
      await t.pumpAndSettle();
      expect(store.userRequest.revisionRequested, isFalse);
      await t.pumpWidget(const SizedBox());
    },
  );

  testWidgets(
    'preview switches actual days and the form fits large text above the keyboard',
    (t) async {
      final auth = changeAuth(
        (r) => jsonResponse(
          r.url.path.endsWith('/plan') ? changePlan() : changeReasons,
        ),
      );
      final store = DemoStore(customerAuth: auth)..loginDemoUser();
      addTearDown(() {
        store.dispose();
        auth.dispose();
      });
      await open(t, store, scale: 1.5);
      await t.tap(find.byKey(const ValueKey('plan-change-preview')));
      await t.pumpAndSettle();
      expect(find.text('ناهار · عدسی روز 1'), findsOneWidget);
      await t.tap(find.byKey(const ValueKey('plan-change-day-1')));
      await t.pumpAndSettle();
      expect(find.text('ناهار · عدسی روز 2'), findsOneWidget);
      expect(find.text('عدس ۸۰ گرم'), findsOneWidget);
      t.view.physicalSize = const Size(320, 740);
      t.view.viewInsets = const FakeViewPadding(bottom: 260);
      await t.pumpAndSettle();
      final notes = find.byKey(const ValueKey('plan-change-details'));
      await t.ensureVisible(notes);
      await t.enterText(notes, 'غذاهای ساده‌تر می‌خواهم');
      await t.pumpAndSettle();
      expect(
        t.getBottomRight(find.byKey(const ValueKey('plan-change-submit'))).dy,
        lessThanOrEqualTo(480),
      );
      expect(t.takeException(), isNull);
      await t.tap(find.text('انصراف'));
      await t.pumpAndSettle();
      await t.pumpWidget(const SizedBox());
    },
  );

  testWidgets(
    'a changed published version can be refreshed without losing the explanation',
    (t) async {
      var version = publishedVersion;
      final posts = <Map<String, dynamic>>[];
      final auth = changeAuth((r) {
        if (r.method == 'POST') {
          posts.add(jsonDecode(r.body) as Map<String, dynamic>);
          if (posts.length == 1) {
            version = '22222222-2222-4222-8222-222222222222';
            return jsonResponse({
              'code': 'plan_changed',
              'messageFa': 'نسخهٔ برنامه تغییر کرده است.',
            }, 409);
          }
          return jsonResponse({
            'id': 'saved-change',
            'status': 'awaiting_review',
          });
        }
        return jsonResponse(
          r.url.path.endsWith('/plan')
              ? {...changePlan(), 'versionId': version}
              : changeReasons,
        );
      });
      final store = DemoStore(customerAuth: auth)..loginDemoUser();
      addTearDown(() {
        store.dispose();
        auth.dispose();
      });
      await open(t, store);
      await t.tap(find.byKey(const ValueKey('plan-change-reason-schedule')));
      final notes = find.byKey(const ValueKey('plan-change-details'));
      await t.ensureVisible(notes);
      await t.enterText(notes, 'توضیحات من حفظ شود');
      await t.tap(find.byKey(const ValueKey('plan-change-submit')));
      await t.pumpAndSettle();
      final refresh = find.byKey(const ValueKey('plan-change-refresh'));
      await t.ensureVisible(refresh);
      await t.tap(refresh);
      await t.pumpAndSettle();
      expect(t.widget<TextField>(notes).controller!.text, 'توضیحات من حفظ شود');
      await t.tap(find.byKey(const ValueKey('plan-change-submit')));
      await t.pumpAndSettle();
      expect(posts[1]['versionId'], version);
      expect(posts[1]['reasonIds'], ['schedule']);
      expect(posts[1]['commandId'], isNot(posts[0]['commandId']));
      expect(find.byType(PlanChangeSheet), findsNothing);
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
    },
  );

  testWidgets(
    'an empty success response never announces success or changes the local plan',
    (t) async {
      final auth = changeAuth(
        (r) => r.method == 'POST'
            ? jsonResponse({})
            : jsonResponse(
                r.url.path.endsWith('/plan') ? changePlan() : changeReasons,
              ),
      );
      final store = DemoStore(customerAuth: auth)..loginDemoUser();
      addTearDown(() {
        store.dispose();
        auth.dispose();
      });
      await open(t, store);
      await t.tap(find.byKey(const ValueKey('plan-change-reason-schedule')));
      await t.tap(find.byKey(const ValueKey('plan-change-submit')));
      await t.pumpAndSettle();
      expect(find.byType(PlanChangeSheet), findsOneWidget);
      expect(store.userRequest.revisionRequested, isFalse);
      expect(
        find.text('ارسال تأیید نشد. با همین اطلاعات دوباره تلاش کن.'),
        findsOneWidget,
      );
      await t.pumpWidget(const SizedBox());
    },
  );
}
