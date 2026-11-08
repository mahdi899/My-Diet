import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/app.dart';
import 'package:sabzine_flutter/presentation/screens/splash.dart';
import 'package:sabzine_flutter/presentation/screens/entry.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/data/questionnaire_storage.dart';

class MemoryStorage implements QuestionnaireStorage {
  String? value;
  bool failWrites = false;
  @override
  Future<String?> read() async => value;
  @override
  Future<void> write(String text) async {
    if (failWrites) throw StateError('storage unavailable');
    value = text;
  }
}

QuestionnaireData validAnswers() => QuestionnaireData()..consent = true;

void mobile(WidgetTester tester) {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
}

Future<void> next(WidgetTester tester) async {
  await tester.pumpAndSettle();
  await tester.tap(find.text('ادامه'));
  await tester.pumpAndSettle();
  expect(tester.takeException(), isNull);
}

Future<void> choose(WidgetTester tester, String key, String value) async {
  final field = find.byKey(ValueKey(key));
  await tester.ensureVisible(field);
  await tester.pumpAndSettle();
  await tester.tap(field);
  await tester.pumpAndSettle();
  if (find.text(value).evaluate().isEmpty) {
    await tester.scrollUntilVisible(
      find.text(value),
      200,
      scrollable: find.byType(Scrollable).last,
      maxScrolls: 40,
    );
  }
  final item = find.text(value).last;
  await tester.ensureVisible(item);
  await tester.pumpAndSettle();
  await tester.tap(item);
  await tester.pumpAndSettle();
}

void main() {
  test('Specialist profile edits do not edit the user profile', () {
    final store = DemoStore()..login(AppRole.expert);
    final name = store.questionnaire.name;
    store.updateProfileName('دکتر متخصص نمونه');
    expect(store.questionnaire.name, name);
    expect(store.request('1042').specialist, 'دکتر متخصص نمونه');
    store.dispose();
  });

  test('Unapproved meal edits never change a published plan', () {
    final store = DemoStore();
    store.approve('1042');
    final title = store.request('1042').published.first.title;
    store.editMeal(
      '1042',
      0,
      store.request('1042').draft.first.copyWith(title: 'صبحانهٔ جدید'),
    );
    expect(store.request('1042').published.first.title, title);
    expect(store.request('1041').draft.first.title, title);
    store.approve('1042');
    expect(store.request('1042').published.first.title, 'صبحانهٔ جدید');
    store.dispose();
  });

  test('Revision keeps the approved program available', () {
    final store = DemoStore()..loginDemoUser();
    store.approveActiveUserRequest();
    store.requestRevision('تهیهٔ غذا سخته', 'جایگزین ساده‌تر');
    expect(store.userRequest.isPublished, isTrue);
    expect(store.userRequest.revisionRequested, isTrue);
    store.dispose();
  });

  test(
    'Completed onboarding and all answers restore after a new app session',
    () async {
      final storage = MemoryStorage();
      final first = DemoStore(storage: storage);
      final answers = validAnswers()
        ..name = 'کاربر آزمایشی'
        ..dislikes = 'قارچ';
      final count = first.requests.length;
      await first.saveQuestionnaire(answers, onboarding: true);
      expect(first.requests.length, count);
      final restarted = DemoStore(storage: storage);
      await restarted.restoreQuestionnaire();
      expect(restarted.questionnaireComplete, isTrue);
      expect(restarted.questionnaire.toJson(), answers.toJson());
      first.dispose();
      restarted.dispose();
    },
  );

  test(
    'Editing saves answers without creating a request or changing a published plan',
    () async {
      final store = DemoStore(storage: MemoryStorage());
      await store.saveQuestionnaire(validAnswers(), onboarding: true);
      store.loginDemoUser();
      store.approveActiveUserRequest();
      final id = store.userRequestId, count = store.requests.length;
      final published = store.userRequest.published;
      final edited = store.questionnaire.copy()
        ..age = '۳۳'
        ..goal = 'تثبیت وزن';
      await store.saveQuestionnaire(edited, onboarding: false);
      expect(store.questionnaire.age, '۳۳');
      expect(store.questionnaire.healthDetails, isEmpty);
      expect(store.requests.length, count);
      expect(store.userRequestId, id);
      expect(identical(store.userRequest.published, published), isTrue);
      store.dispose();
    },
  );

  test(
    'Failed storage leaves completion and committed answers unchanged',
    () async {
      final storage = MemoryStorage()..failWrites = true;
      final store = DemoStore(storage: storage);
      final original = store.questionnaire.toJson();
      await expectLater(
        store.saveQuestionnaire(
          validAnswers()..name = 'نام تازه',
          onboarding: true,
        ),
        throwsStateError,
      );
      expect(store.questionnaireComplete, isFalse);
      expect(store.questionnaire.toJson(), original);
      expect(store.requests.length, 6);
      store.dispose();
    },
  );

  test('Invalid local data does not mark onboarding complete', () async {
    final storage = MemoryStorage()..value = '{broken';
    final store = DemoStore(storage: storage);
    await store.restoreQuestionnaire();
    expect(store.questionnaireComplete, isFalse);
    storage.value = '{"version":1,"completed":true,"answers":{}}';
    await store.restoreQuestionnaire();
    expect(store.questionnaireComplete, isFalse);
    store.dispose();
  });

  testWidgets('Startup displays only the logo then opens the guest dashboard', (
    tester,
  ) async {
    mobile(tester);
    final store = DemoStore();
    await tester.pumpWidget(SabzineApp(store: store));
    expect(find.byType(SplashScreen), findsOneWidget);
    expect(find.byType(Text), findsNothing);
    expect(find.byType(CircularProgressIndicator), findsNothing);
    expect(find.byType(EntryScreen), findsNothing);
    await tester.pump(const Duration(milliseconds: 1400));
    await tester.pumpAndSettle();
    expect(find.byType(NavigationBar), findsOneWidget);
    expect(store.userSignedIn, false);
    expect(find.byType(LoginScreen), findsNothing);
    expect(find.byType(SplashScreen), findsNothing);
    await tester.pumpWidget(const SizedBox());
    store.dispose();
  });

  testWidgets('Guest can browse but staff panel selection is absent', (
    tester,
  ) async {
    mobile(tester);
    final store = DemoStore();
    await tester.pumpWidget(
      SabzineApp(store: store, splashDuration: Duration.zero),
    );
    await tester.pumpAndSettle();
    expect(find.byType(NavigationBar), findsOneWidget);
    expect(find.byType(LoginScreen), findsNothing);
    expect(store.userSignedIn, false);
    await tester.tap(find.byType(NavigationDestination).at(3));
    await tester.pumpAndSettle();
    expect(find.text('تعویض پنل نمایشی'), findsNothing);
    expect(find.text('ورود به عنوان متخصص'), findsNothing);
    expect(find.text('ورود به عنوان مدیر'), findsNothing);
    expect(find.text('ورود به حساب'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
    store.dispose();
  });

  testWidgets(
    'Saved answers skip questionnaire after acquisition login and go to pricing',
    (tester) async {
      mobile(tester);
      final store = DemoStore(storage: MemoryStorage());
      await store.saveQuestionnaire(validAnswers(), onboarding: true);
      final count = store.requests.length;
      await tester.pumpWidget(
        SabzineApp(store: store, splashDuration: Duration.zero),
      );
      await tester.pumpAndSettle();
      final request = find.byKey(const ValueKey('get-food-plan'));
      await tester.ensureVisible(request);
      await tester.tap(request);
      await tester.pumpAndSettle();
      expect(find.byType(LoginScreen), findsOneWidget);
      await tester.tap(find.text('ورود مستقیم با حساب نمایشی'));
      await tester.pumpAndSettle();
      expect(find.text('تعرفه برنامه‌ها'), findsOneWidget);
      expect(store.userSignedIn, true);
      expect(store.requests.length, count);
      await tester.pumpWidget(const SizedBox());
      store.dispose();
    },
  );

  testWidgets(
    'After acquisition login questionnaire requires consent then opens pricing',
    (tester) async {
      mobile(tester);
      final storage = MemoryStorage();
      final store = DemoStore(storage: storage)
        ..startPlanAcquisition()
        ..login(AppRole.user);
      await tester.pumpWidget(
        SabzineApp(store: store, splashDuration: Duration.zero),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('شروع پرسش‌نامه'));
      await tester.pumpAndSettle();
      for (final entry in {
        'نام و نام خانوادگی': 'سارا احمدی',
        'سن / سال': '۲۸',
        'قد / سانتی‌متر': '۱۶۵',
        'وزن / کیلوگرم': '۷۲',
      }.entries) {
        final field = find.byKey(ValueKey(entry.key));
        await tester.ensureVisible(field);
        await tester.enterText(field, entry.value);
        await tester.pumpAndSettle();
      }
      await choose(tester, 'sex', 'زن');
      await next(tester);
      await next(tester);
      expect(find.text('هدف و شرایط بدنی تو'), findsOneWidget);
      final goal = find.text('تغذیهٔ سالم');
      await tester.ensureVisible(goal);
      await tester.tap(goal);
      await choose(tester, 'lifeStage', 'هیچ‌کدام');
      await choose(tester, 'previousDiet', 'نداشته‌ام');
      await next(tester);
      await tester.tap(find.text('موردی ندارم'));
      await next(tester);
      await tester.tap(find.text('فعالیت سبک'));
      await choose(tester, 'exercise', '۱ تا ۲ جلسه');
      await choose(tester, 'sleep', '۷ تا ۹ ساعت');
      await choose(tester, 'mealPattern', 'سه وعدهٔ منظم');
      await choose(tester, 'water', '۴ تا ۶ لیوان');
      await next(tester);
      await tester.tap(find.text('غذای ایرانی'));
      await next(tester);
      await tester.tap(find.text('ثبت اطلاعات و ادامه'));
      await tester.pumpAndSettle();
      expect(store.questionnaireComplete, isFalse);
      await tester.ensureVisible(find.byType(CheckboxListTile));
      await tester.tap(find.byType(CheckboxListTile));
      await tester.pumpAndSettle();
      await tester.tap(find.text('ثبت اطلاعات و ادامه'));
      await tester.pumpAndSettle();
      expect(store.questionnaireComplete, isTrue);
      expect(store.hasUserRequest, isFalse);
      expect(store.entryStage, EntryStage.home);
      expect(store.role, AppRole.user);
      expect(store.userSignedIn, isTrue);
      expect(find.byType(LoginScreen), findsNothing);
      expect(find.text('تعرفه برنامه‌ها'), findsOneWidget);
      expect(store.hasUserRequest, isFalse);
      expect(storage.value, isNotNull);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
      store.dispose();
    },
  );

  testWidgets(
    'Profile edit starts with previous answers, saves and can be reopened',
    (tester) async {
      mobile(tester);
      final store = DemoStore(storage: MemoryStorage());
      store.questionnaireComplete = true;
      store.questionnaire.consent = true;
      store.questionnaire.health
        ..clear()
        ..add('حساسیت غذایی دارم');
      store.questionnaire.healthDetails = 'توضیح قبلی حساسیت';
      store.loginDemoUser();
      final count = store.requests.length;
      await tester.pumpWidget(
        SabzineApp(store: store, splashDuration: Duration.zero),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byType(NavigationDestination).at(3));
      await tester.pumpAndSettle();
      await tester.tap(find.text('اطلاعات فردی'));
      await tester.pumpAndSettle();
      final age = find.byKey(const ValueKey('سن / سال'));
      expect(tester.widget<TextFormField>(age).initialValue, '۲۸');
      await tester.enterText(age, '۳۳');
      expect(store.questionnaire.age, '۲۸');
      for (var i = 0; i < 5; i++) {
        if (i == 2) {
          await tester.tap(find.text('موردی ندارم'));
          await tester.pumpAndSettle();
        }
        await next(tester);
      }
      await tester.tap(find.text('ذخیرهٔ تغییرات'));
      await tester.pumpAndSettle();
      expect(store.questionnaire.age, '۳۳');
      expect(store.requests.length, count);
      await tester.tap(find.text('اطلاعات فردی'));
      await tester.pumpAndSettle();
      expect(tester.widget<TextFormField>(age).initialValue, '۳۳');
      await tester.enterText(age, '۴۰');
      await tester.tap(find.byTooltip('بازگشت'));
      await tester.pumpAndSettle();
      expect(store.questionnaire.age, '۳۳');
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
      store.dispose();
    },
  );

  testWidgets('Authenticated customer renders all small-screen tabs', (
    tester,
  ) async {
    mobile(tester);
    final store = DemoStore()..questionnaireComplete = true;
    await tester.pumpWidget(
      SabzineApp(store: store, splashDuration: Duration.zero),
    );
    await tester.pumpAndSettle();
    for (final role in [AppRole.user]) {
      store.login(role);
      await tester.pumpAndSettle();
      for (var i = 0; i < 4; i++) {
        await tester.tap(find.byType(NavigationDestination).at(i));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull, reason: '$role / $i');
      }
    }
    await tester.pumpWidget(const SizedBox());
    store.dispose();
  });
  testWidgets(
    'Home switches from status to published meals and reflects current weight',
    (tester) async {
      mobile(tester);
      final store = DemoStore(storage: MemoryStorage());
      await store.saveQuestionnaire(
        validAnswers()..weight = '۸۱',
        onboarding: true,
      );
      store.loginDemoUser();
      await tester.pumpWidget(
        SabzineApp(store: store, splashDuration: Duration.zero),
      );
      await tester.pumpAndSettle();
      expect(find.text('وزن فعلی'), findsOneWidget);
      expect(find.text('۸۱'), findsOneWidget);
      expect(find.text('اطلاعات فردی'), findsNothing);
      expect(find.text('وضعیت برنامه'), findsOneWidget);
      expect(find.text('برنامهٔ امروز'), findsNothing);
      expect(find.text(store.userRequest.draft.first.title), findsNothing);
      store.addWeight(79.5);
      await tester.pumpAndSettle();
      expect(find.text('۷۹٫۵'), findsOneWidget);
      store.approveActiveUserRequest();
      await tester.pumpAndSettle();
      expect(find.text('وضعیت برنامه'), findsNothing);
      expect(find.text('برنامهٔ امروز'), findsOneWidget);
      for (final meal in store.mealsOn(store.today)) {
        expect(find.text(meal.title), findsOneWidget);
      }
      final original = store.mealsOn(store.today).first.title;
      store.editMeal(
        store.userRequestId!,
        0,
        store.userRequest
            .draftForDay((store.today.weekday + 1) % 7)
            .first
            .copyWith(title: 'ویرایش منتشرنشده'),
        day: (store.today.weekday + 1) % 7,
      );
      store.requestRevision('غذای ساده‌تر', '');
      await tester.pumpAndSettle();
      expect(find.text(original), findsOneWidget);
      expect(find.text('ویرایش منتشرنشده'), findsNothing);
      final full = find.text('برنامهٔ کامل');
      await tester.scrollUntilVisible(
        full,
        200,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.pumpAndSettle();
      await tester.tap(full);
      await tester.pumpAndSettle();
      expect(find.text('برنامهٔ غذایی من'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
      store.dispose();
    },
  );
}
