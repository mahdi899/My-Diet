import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/app.dart';
import 'package:sabzine_flutter/data/connection.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/features/home/home_tab.dart';

void main() {
  test(
    'classifies timeout, offline, unavailable, expired, and a real answer',
    () {
      expect(classifyLink(timedOut: true), LinkFault.timeout);
      expect(classifyLink(), LinkFault.offline);
      expect(classifyLink(status: 503), LinkFault.unavailable);
      expect(classifyLink(status: 500), LinkFault.unavailable);
      expect(classifyLink(status: 401), LinkFault.expired);
      expect(classifyLink(status: 200), isNull);
      expect(classifyLink(status: 404), isNull);
    },
  );

  testWidgets('offline startup hides the plan until a later probe succeeds', (
    tester,
  ) async {
    final first = Completer<LinkFault?>();
    final retry = Completer<LinkFault?>();
    var call = 0;
    final link = LinkMonitor(
      probe: () => call++ == 0 ? first.future : retry.future,
    );
    final store = DemoStore()..loginDemoUser();
    await tester.pumpWidget(
      SabzineApp(store: store, link: link, splashDuration: Duration.zero),
    );
    expect(find.byKey(const ValueKey('connection-screen')), findsOneWidget);
    expect(find.text('در حال بررسی اتصال'), findsWidgets);
    expect(find.byType(HomeTab), findsNothing);
    expect(
      tester
          .widget<FilledButton>(find.byKey(const ValueKey('connection-retry')))
          .onPressed,
      isNull,
    );

    first.complete(LinkFault.offline);
    await tester.pump();
    expect(find.text('ارتباط برقرار نیست'), findsOneWidget);
    expect(
      find.text('برنامهٔ ذخیره‌شده به‌صورت آفلاین نمایش داده نمی‌شود.'),
      findsOneWidget,
    );
    expect(find.byType(HomeTab), findsNothing);

    await tester.tap(find.byKey(const ValueKey('connection-retry')));
    await tester.pump();
    expect(find.text('در حال بررسی اتصال'), findsWidgets);
    retry.complete(null);
    await tester.pump();
    expect(find.byKey(const ValueKey('connection-screen')), findsNothing);
    expect(find.byType(HomeTab), findsOneWidget);
  });

  testWidgets('a lost connection covers the open plan', (tester) async {
    final link = LinkMonitor();
    final store = DemoStore()..loginDemoUser();
    await tester.pumpWidget(
      SabzineApp(store: store, link: link, splashDuration: Duration.zero),
    );
    await tester.pump();
    expect(find.byType(HomeTab), findsOneWidget);
    link.report(LinkFault.timeout);
    await tester.pump();
    expect(find.text('پاسخ سرور به‌موقع نرسید'), findsOneWidget);
    expect(find.byType(HomeTab), findsNothing);
    link.report(LinkFault.unavailable);
    await tester.pump();
    expect(find.text('سرویس موقتاً در دسترس نیست'), findsOneWidget);
    link.report(LinkFault.expired);
    await tester.pump();
    expect(find.text('نشست پایان یافته'), findsOneWidget);
    expect(find.text('برنامهٔ غذایی من'), findsNothing);
  });
}
