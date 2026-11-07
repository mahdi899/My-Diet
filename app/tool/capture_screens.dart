// Run: flutter test tool/capture_screens.dart --update-goldens
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/app.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/widgets/nutrition.dart';
import '../test/widget_test.dart' show choose;

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    final font = FontLoader('Vazirmatn')
      ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Regular.ttf'))
      ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Bold.ttf'));
    await font.load();
    final icons = FontLoader('MaterialIcons')
      ..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'));
    await icons.load();
  });
  testWidgets('Capture actual Flutter mobile UI and onboarding', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final store = DemoStore();
    await tester.pumpWidget(SabzineApp(store: store));
    Future<void> shot(String name) async {
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('../../references/screenshots/$name.png'),
      );
    }

    await shot('00-startup-logo');
    await tester.pump(const Duration(milliseconds: 1400));
    await tester.pumpAndSettle();
    await shot('00-role-selection');
    await tester.tap(find.text('ورود به عنوان کاربر'));
    await tester.pumpAndSettle();
    await shot('00-onboarding');
    await tester.tap(find.text('شروع پرسش‌نامه'));
    await tester.pumpAndSettle();
    for (final field in {
      'نام و نام خانوادگی': 'سارا احمدی',
      'سن / سال': '۲۸',
      'قد / سانتی‌متر': '۱۶۵',
      'وزن / کیلوگرم': '۷۲',
    }.entries) {
      await tester.ensureVisible(find.byKey(ValueKey(field.key)));
      await tester.enterText(find.byKey(ValueKey(field.key)), field.value);
    }
    await choose(tester, 'sex', 'زن');
    await tester.tap(find.text('ادامه'));
    await tester.pumpAndSettle();
    await shot('02-questionnaire');
    await store.saveQuestionnaire(
      QuestionnaireData()
        ..consent = true
        ..goal = 'کاهش وزن'
        ..targetWeight = '۶۵',
      onboarding: true,
    );
    await tester.pumpAndSettle();
    store.continueToLogin();
    await tester.pumpAndSettle();
    await shot('00-login');
    await tester.tap(find.text('ورود مستقیم با حساب نمایشی'));
    await tester.pumpAndSettle();
    store.attachDemoUserRequest();
    await tester.pumpAndSettle();
    await shot('01-user-home');
    store.approveActiveUserRequest();
    await tester.pumpAndSettle();
    final firstCheck = find.descendant(
      of: find.byType(ScheduledMealTile).first,
      matching: find.byType(Checkbox),
    );
    await tester.ensureVisible(firstCheck);
    await tester.pumpAndSettle();
    await tester.tap(firstCheck);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 900));
    await shot('13-meal-celebration');
    await tester.pumpAndSettle();
    await tester.drag(find.byType(CustomScrollView), const Offset(0, 1200));
    await tester.pumpAndSettle();
    await shot('08-user-home-ready');
    final meal = find.text(store.mealsOn(store.today)[1].title);
    await tester.ensureVisible(meal);
    await tester.pumpAndSettle();
    await tester.tap(meal);
    await tester.pumpAndSettle();
    await shot('09-meal-details');
    await tester.tap(find.byTooltip('بستن جزئیات غذا'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('مسیر هدف تو'));
    await tester.pumpAndSettle();
    await shot('10-weight-journey');
    await tester.ensureVisible(find.byKey(const ValueKey('daily-advice')));
    await tester.pumpAndSettle();
    await shot('11-daily-advice');
    await tester.tap(find.byType(NavigationDestination).at(1));
    await tester.pumpAndSettle();
    await shot('03-meal-plan');
    await tester.tap(find.byType(NavigationDestination).at(3));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('مشخصات دکتر'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('مشخصات دکتر'));
    await tester.pumpAndSettle();
    await shot('14-doctor-details');
    tester.state<NavigatorState>(find.byType(Navigator).first).pop();
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('ویرایش پرسش‌نامه'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('ویرایش پرسش‌نامه'));
    await tester.pumpAndSettle();
    await shot('07-profile-questionnaire-edit');
    await tester.tap(find.text('ادامه'));
    await tester.pumpAndSettle();
    await choose(tester, 'lifeStage', 'باردار هستم');
    await choose(tester, 'pregnancyWeek', 'هفتهٔ ۲۴');
    await choose(tester, 'babies', 'دوقلو یا بیشتر');
    await tester.ensureVisible(find.byKey(const ValueKey('pregnancyWeek')));
    await tester.pumpAndSettle();
    await shot('12-pregnancy-questionnaire');
    tester.state<NavigatorState>(find.byType(Navigator).first).pop();
    await tester.pumpAndSettle();
    store.login(AppRole.expert);
    await tester.pumpAndSettle();
    await shot('15-expert-home');
    await tester.ensureVisible(find.text('درخواست‌های تغییر برنامه'));
    await tester.pumpAndSettle();
    await shot('16-expert-revisions');
    await tester.tap(find.byType(NavigationDestination).at(2));
    await tester.pumpAndSettle();
    await shot('17-conversations');
    await tester.tap(find.byKey(const ValueKey('conversation-patient-amir')));
    await tester.pumpAndSettle();
    await shot('18-patient-chat');
    tester.state<NavigatorState>(find.byType(Navigator).first).pop();
    await tester.pumpAndSettle();
    await tester.tap(find.byType(NavigationDestination).at(3));
    await tester.pumpAndSettle();
    await shot('19-expert-profile');
    await tester.tap(find.text('اطلاعات فردی'));
    await tester.pumpAndSettle();
    await shot('20-expert-edit-profile');
    await tester.ensureVisible(find.byKey(const ValueKey('expert-address')));
    await tester.pumpAndSettle();
    await shot('21-expert-clinic-fields');
    tester.state<NavigatorState>(find.byType(Navigator).first).pop();
    await tester.pumpAndSettle();
    await tester.tap(find.byType(NavigationDestination).at(1));
    await tester.pumpAndSettle();
    await shot('04-expert-queue');
    store.login(AppRole.admin);
    await tester.pumpAndSettle();
    await shot('05-admin-home');
    await tester.ensureVisible(find.text('آخرین پیام‌های پشتیبانی'));
    await tester.pumpAndSettle();
    await shot('22-admin-support-inbox');
    await tester.ensureVisible(find.text('ویرایش سؤال‌ها'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('ویرایش سؤال‌ها'));
    await tester.pumpAndSettle();
    await shot('23-question-management');
    await tester.tap(find.text('افزودن سؤال جدید'));
    await tester.pumpAndSettle();
    await shot('24-new-question-editor');
    tester.state<NavigatorState>(find.byType(Navigator).first).pop();
    await tester.pumpAndSettle();
    tester.state<NavigatorState>(find.byType(Navigator).first).pop();
    await tester.pumpAndSettle();
    await tester.tap(find.byType(NavigationDestination).at(2));
    await tester.pumpAndSettle();
    await shot('06-admin-users');
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
    store.dispose();
  });
}
