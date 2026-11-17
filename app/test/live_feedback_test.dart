import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/data/customer_auth.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/domain/plan/plan.dart';
import 'package:sabzine_flutter/presentation/screens/weekly_feedback.dart';
import 'package:sabzine_flutter/presentation/session/live_plan.dart';

import 'messaging_test.dart' show Tokens;

const requestId = '11111111-1111-4111-8111-111111111111';
const optionId = '22222222-2222-4222-8222-222222222222';

DemoStore liveStore(Future<http.Response> Function(http.Request) handler) {
  final auth =
      CustomerAuth(
          baseUrl: 'https://fixture.invalid',
          storage: Tokens(),
          client: MockClient(handler),
        )
        ..session = CustomerSession.fromJson({
          'accessToken':
              'fixture.${base64Url.encode(utf8.encode('{"sub":"patient"}'))}.signature',
          'role': 'user',
          'sessionExpiresAt': '2026-12-01T00:00:00Z',
        });
  final store = DemoStore(
    customerAuth: auth,
    clock: () => DateTime(2026, 11, 20),
  )..login(AppRole.user);
  showServerPlan(
    store,
    name: 'کاربر',
    plan: PublishedPlan.fromJson({
      'requestId': requestId,
      'weekStart': '2026-11-14',
      'days': [
        {
          'date': '2026-11-14',
          'dayIndex': 0,
          'meals': [
            {
              'mealUid': optionId,
              'mealType': 'lunch',
              'title': 'عدسی',
              'calories': 300,
              'options': [
                {
                  'optionId': optionId,
                  'kind': 'primary',
                  'title': 'عدسی',
                  'calories': 300,
                },
              ],
            },
          ],
        },
      ],
    }),
  );
  addTearDown(() {
    store.dispose();
    auth.dispose();
  });
  return store;
}

http.Response response(Object? value, [int code = 200]) => http.Response(
  jsonEncode(value),
  code,
  headers: {'content-type': 'application/json; charset=utf-8'},
);

void main() {
  testWidgets(
    'real feedback retries a failed save, keeps answers and restores from the server',
    (t) async {
      t.view.physicalSize = const Size(390, 844);
      t.view.devicePixelRatio = 1;
      addTearDown(t.view.reset);
      Map<String, dynamic>? saved;
      var fail = true;
      var puts = 0;
      Future<http.Response> handler(http.Request request) async {
        if (request.url.path.endsWith('/preferences')) {
          return response({'confirmed': null, 'revision': 0});
        }
        if (request.method == 'PUT') {
          puts++;
          if (fail) return response({'detail': 'offline'}, 503);
          saved = jsonDecode(request.body) as Map<String, dynamic>;
          return response({...saved!, 'revision': 1});
        }
        return saved == null
            ? response({'code': 'not_found'}, 404)
            : response(saved);
      }

      final store = liveStore(handler);
      await t.pumpWidget(
        DemoScope(
          store: store,
          child: MaterialApp(
            theme: appTheme(),
            home: const WeeklyFeedbackScreen(),
          ),
        ),
      );
      await t.pumpAndSettle();
      expect(find.textContaining('نمایشی و محلی'), findsNothing);
      for (final label in ['راحت', 'گران', 'زیاد', 'خوب']) {
        final chip = find.widgetWithText(ChoiceChip, label);
        await t.ensureVisible(chip);
        await t.tap(chip);
        await t.pumpAndSettle();
      }
      await t.ensureVisible(find.byType(TextField).first);
      await t.enterText(find.byType(TextField).first, 'توضیح خصوصی من');
      final button = find.text('ذخیرهٔ بازخورد هفته');
      await t.ensureVisible(button);
      await t.tap(button);
      await t.pumpAndSettle();
      expect(store.weeklyFeedback, isEmpty);
      expect(find.textContaining('پاسخ‌ها حفظ شدند'), findsOneWidget);
      fail = false;
      await t.ensureVisible(button);
      await t.tap(button);
      await t.pumpAndSettle();
      expect(puts, 2);
      expect(saved!['comment'], 'توضیح خصوصی من');
      expect(saved!['publishPermission'], false);
      expect(saved!['details']['meals'][0]['id'], optionId);
      expect(find.text('بازخورد این هفته ذخیره شد'), findsOneWidget);
      final restored = liveStore(handler);
      await restored.restoreWeeklyFeedback();
      expect(restored.weeklyFeedback.single.comment, 'توضیح خصوصی من');
      expect(restored.weeklyFeedback.single.budget, 'expensive');
      expect(restored.weeklyFeedback.single.owner, 'server:patient');
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
    },
  );

  test(
    'public review sends separate public text and real option ids',
    () async {
      Map<String, dynamic>? sent;
      final store = liveStore((request) async {
        sent = jsonDecode(request.body) as Map<String, dynamic>;
        return response(sent);
      });
      final program = store.feedbackProgram!;
      await store.saveWeeklyFeedback(
        WeeklyFeedback(
          owner: store.feedbackOwner,
          requestId: program.id,
          planVersion: program.version,
          week: '2026-11-14',
          at: store.today,
          meals: store.feedbackMeals(program),
          favorite: [optionId],
          disliked: [],
          difficult: [optionId],
          availability: 'easy',
          budget: 'comfortable',
          portion: 'suitable',
          service: 'good',
          rating: 4,
          comment: 'خصوصی',
          publicConsent: true,
          publicText: 'نظر عمومی',
        ),
      );
      expect(sent!['favorites'], [optionId]);
      expect(sent!['publicText'], 'نظر عمومی');
      expect(sent!['comment'], 'خصوصی');
      expect(
        store.programReviews.where((r) => r.id.startsWith('weekly:')),
        isEmpty,
      );
    },
  );
}
