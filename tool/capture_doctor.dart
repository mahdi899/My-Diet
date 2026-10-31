import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/app.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/screens/expert.dart';
import 'package:sabzine_flutter/screens/meal_editor.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    await (FontLoader('Vazirmatn')
          ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Regular.ttf'))
          ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Bold.ttf')))
        .load();
    await (FontLoader(
      'MaterialIcons',
    )..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'))).load();
  });
  testWidgets('Doctor workspace at phone size', (t) async {
    t.view.physicalSize = const Size(390, 844);
    t.view.devicePixelRatio = 1;
    addTearDown(t.view.resetPhysicalSize);
    addTearDown(t.view.resetDevicePixelRatio);
    final s = DemoStore()..login(AppRole.expert);
    Future<void> shot(String name) async {
      await t.pumpAndSettle();
      expect(t.takeException(), isNull);
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('../screenshots/doctor/$name.png'),
      );
    }

    await t.pumpWidget(SabzineApp(store: s, splashDuration: Duration.zero));
    await shot('01-workspace');
    await t.ensureVisible(
      find.byKey(const ValueKey('revision-requests-section')),
    );
    await shot('01b-revision-requests');
    s.request('1041').revisionRequested = true;
    s.request('1041').revisionReason = 'غذاهای ساده‌تر برای محل کار';
    s.update();
    await shot('01c-revision-slider');
    s.request('1041').revisionRequested = false;
    s.update();
    await t.pumpAndSettle();
    await t.tap(find.byType(NavigationDestination).at(1));
    await shot('02-requests');
    await t.tap(find.widgetWithText(ChoiceChip, 'درخواست اصلاح'));
    await shot('02b-revision-filter');
    final nav = Navigator.of(t.element(find.byType(Scaffold).first));
    nav.push(
      MaterialPageRoute<void>(
        builder: (_) => const ReviewScreen(requestId: '1042'),
      ),
    );
    await shot('03-review');
    await t.tap(find.widgetWithText(Tab, 'پرونده'));
    await shot('04-patient');
    await t.tap(find.widgetWithText(Tab, 'سؤال و پاسخ'));
    await shot('05-questions');
    nav.pop();
    await t.pumpAndSettle();
    nav.push(
      MaterialPageRoute<void>(
        builder: (_) =>
            MealEditorScreen(meal: sampleMeals().first, editing: true),
      ),
    );
    await shot('06-meal-editor');
    nav.pop();
    await t.pumpAndSettle();
    await t.tap(find.byType(NavigationDestination).at(2));
    await shot('07-messages');
    await t.tap(find.byType(NavigationDestination).at(3));
    await shot('08-profile');
    expect(find.text(s.experts.first.address), findsNothing);
    await t.tap(find.byKey(const ValueKey('clinic-profile-section-1')));
    await shot('09-clinic-details');
    expect(find.text(s.experts.first.address), findsOneWidget);
    await t.ensureVisible(
      find.byKey(const ValueKey('clinic-profile-section-0')),
    );
    await t.tap(find.byKey(const ValueKey('clinic-profile-section-0')));
    await t.pumpAndSettle();
    expect(find.text(s.experts.first.address), findsNothing);
    expect(find.text(s.experts.first.degree), findsOneWidget);
    await t.pumpWidget(const SizedBox());
    s.loginDemoUser();
    s.approveActiveUserRequest();
    s.requestRevision('زمان تهیه غذا', 'برای شام غذای ساده‌تر می‌خواهم.');
    s.login(AppRole.expert);
    await t.pumpWidget(SabzineApp(store: s, splashDuration: Duration.zero));
    await t.pumpAndSettle();
    Navigator.of(t.element(find.byType(Scaffold).first)).push(
      MaterialPageRoute<void>(
        builder: (_) => ReviewScreen(requestId: s.userRequestId!),
      ),
    );
    await shot('10-revision-review-chat');
    await t.pumpWidget(const SizedBox());
    s.send('برای تهیهٔ شام چقدر زمان داری؟', threadId: 'user-main');
    s.login(AppRole.user);
    await t.pumpWidget(SabzineApp(store: s, splashDuration: Duration.zero));
    await t.pumpAndSettle();
    await t.ensureVisible(
      find.byKey(const ValueKey('revision-conversation-status')),
    );
    await shot('11-user-revision-reply');
    await t.pumpWidget(const SizedBox());
    s.dispose();
  });
}
