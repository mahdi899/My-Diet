import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/app.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/data/form_config.dart';
import 'package:sabzine_flutter/data/workspace_settings_storage.dart';
import 'widget_test.dart' show MemoryStorage, validAnswers, mobile, next;

class SettingsMemory implements WorkspaceSettingsStorage {
  String? value;
  bool fail = false;
  @override
  Future<String?> read() async => value;
  @override
  Future<void> write(String text) async {
    if (fail) throw StateError('unavailable');
    value = text;
  }
}

Future<void> tapVisible(WidgetTester t, Finder finder) async {
  await t.ensureVisible(finder);
  await t.pumpAndSettle();
  await t.tap(finder);
  await t.pumpAndSettle();
}

void main() {
  test(
    'Conversations isolate patients and support replies and unread state',
    () {
      final s = DemoStore()..loginDemoUser();
      final other = s.threadMessages('patient-amir').length;
      s.send('پیام فقط برای متخصص من');
      expect(s.threadMessages('patient-amir').length, other);
      s.send('کمک پشتیبانی', support: true);
      expect(s.threadMessages('support-main').last.text, 'کمک پشتیبانی');
      expect(
        s.threadMessages('user-main').any((m) => m.text == 'کمک پشتیبانی'),
        false,
      );
      s.login(AppRole.expert);
      s.send('پاسخ امیر', threadId: 'patient-amir');
      expect(
        s.threadMessages('user-main').any((m) => m.text == 'پاسخ امیر'),
        false,
      );
      final amir = s.thread('patient-amir'), main = s.thread('user-main');
      expect(s.unreadCount(amir, AppRole.expert), greaterThan(0));
      s.markThreadRead(amir.id, AppRole.expert);
      expect(s.unreadCount(amir, AppRole.expert), 0);
      expect(s.unreadCount(main, AppRole.expert), greaterThan(0));
      expect(s.visibleThreads(AppRole.expert).every((t) => !t.support), true);
      expect(s.visibleThreads(AppRole.admin).every((t) => t.support), true);
      expect(s.visibleThreads(AppRole.user).map((t) => t.id).toSet(), {
        'user-main',
        'support-main',
      });
      s.dispose();
    },
  );
  test(
    'Doctor profile and editable form persist and failed saves do not mutate them',
    () async {
      final storage = SettingsMemory(), s = DemoStore(settingsStorage: storage);
      final name = s.questionnaire.name;
      final expert = s.experts.first.copy()
        ..name = 'دکتر ویرایش‌شده'
        ..medicalCode = '۸۸۹۹'
        ..address = 'آدرس تازهٔ مطب'
        ..clinicPhone = '۰۲۱۱۲۳۴۵۶۷۸';
      await s.saveExpertProfile(expert);
      expect(s.questionnaire.name, name);
      expect(s.request('1042').specialist, expert.name);
      expect(s.assignedDoctor!.medicalCode, '۸۸۹۹');
      final form = s.formConfiguration.copy();
      form.question('name').title = 'نام کامل شما';
      form.question('goal').choiceLabels['کاهش وزن'] =
          'کاهش وزن با همراهی متخصص';
      form.questions.add(
        FormQuestion(
          id: 'custom-dinner',
          section: 0,
          title: 'ساعت شام',
          kind: QuestionKind.single,
          options: ['زود', 'دیر'],
          requiredAnswer: true,
        ),
      );
      await s.saveFormConfiguration(form);
      final restored = DemoStore(settingsStorage: storage);
      await restored.restoreWorkspaceSettings();
      expect(restored.experts.first.medicalCode, '۸۸۹۹');
      expect(restored.assignedDoctor!.address, expert.address);
      expect(restored.formConfiguration.label('name'), 'نام کامل شما');
      expect(
        restored.formConfiguration.choice('goal', 'کاهش وزن'),
        'کاهش وزن با همراهی متخصص',
      );
      expect(restored.formConfiguration.validateExtras({}), isNotNull);
      expect(
        restored.formConfiguration.validateExtras({'custom-dinner': 'دیر'}),
        isNull,
      );
      storage.fail = true;
      final changed = form.copy()..question('name').title = 'ذخیرهٔ ناموفق';
      await expectLater(s.saveFormConfiguration(changed), throwsStateError);
      expect(s.formConfiguration.label('name'), 'نام کامل شما');
      s.dispose();
      restored.dispose();
    },
  );
  test(
    'Custom answers persist, are validated, and copy without leaking draft changes',
    () async {
      final qStorage = MemoryStorage(),
          settings = SettingsMemory(),
          s = DemoStore(storage: qStorage, settingsStorage: settings);
      final form = s.formConfiguration.copy();
      form.questions.add(
        FormQuestion(
          id: 'food-work',
          section: 4,
          title: 'محل تهیهٔ غذا',
          kind: QuestionKind.multiple,
          options: ['خانه', 'محل کار'],
          requiredAnswer: true,
        ),
      );
      await s.saveFormConfiguration(form);
      await expectLater(
        s.saveQuestionnaire(validAnswers(), onboarding: true),
        throwsStateError,
      );
      final q = validAnswers();
      q.extraAnswers['food-work'] = ['خانه'];
      await s.saveQuestionnaire(q, onboarding: true);
      final draft = s.questionnaire.copy();
      (draft.extraAnswers['food-work'] as List).add('محل کار');
      expect(s.questionnaire.extraAnswers['food-work'], ['خانه']);
      final restarted = DemoStore(storage: qStorage, settingsStorage: settings);
      await restarted.restoreWorkspaceSettings();
      await restarted.restoreQuestionnaire();
      expect(restarted.questionnaireComplete, true);
      expect(restarted.questionnaire.extraAnswers['food-work'], ['خانه']);
      final decoded = jsonDecode(qStorage.value!) as Map;
      expect((decoded['answers'] as Map)['extraAnswers'], {
        'food-work': ['خانه'],
      });
      s.dispose();
      restarted.dispose();
    },
  );
  testWidgets(
    'Expert dashboard contains dark stats, received messages and revision requests',
    (t) async {
      mobile(t);
      final s = DemoStore()..login(AppRole.expert);
      await t.pumpWidget(SabzineApp(store: s, splashDuration: Duration.zero));
      await t.pumpAndSettle();
      expect(find.text('امروز هم همراهیم'), findsNothing);
      expect(find.text('دسترسی سریع'), findsNothing);
      expect(find.text('درخواست‌های اخیر'), findsNothing);
      expect(find.text('ادامهٔ بررسی'), findsNothing);
      expect(find.text('پیام‌های دریافت‌شده'), findsOneWidget);
      expect(find.text('درخواست‌های تغییر برنامه'), findsOneWidget);
      expect(find.text('نیازمند بررسی'), findsOneWidget);
      expect(find.text('پاسخ‌های جدید'), findsOneWidget);
      await t.tap(find.byType(NavigationDestination).at(2));
      await t.pumpAndSettle();
      expect(find.byKey(const ValueKey('chat-input')), findsNothing);
      await tapVisible(
        t,
        find.byKey(const ValueKey('conversation-patient-amir')),
      );
      await t.enterText(
        find.byKey(const ValueKey('chat-input')),
        'پیام آزمایشی برای امیر',
      );
      await t.tap(find.byTooltip('ارسال پیام'));
      await t.pumpAndSettle();
      expect(
        s.threadMessages('patient-amir').last.text,
        'پیام آزمایشی برای امیر',
      );
      t.state<NavigatorState>(find.byType(Navigator).first).pop();
      await t.pumpAndSettle();
      await tapVisible(t, find.byKey(const ValueKey('conversation-user-main')));
      expect(find.text('پیام آزمایشی برای امیر'), findsNothing);
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
      s.dispose();
    },
  );
  testWidgets(
    'Expert edits clinic details and user sees the same assigned doctor profile',
    (t) async {
      mobile(t);
      final s = DemoStore()..login(AppRole.expert);
      final userName = s.questionnaire.name;
      await t.pumpWidget(SabzineApp(store: s, splashDuration: Duration.zero));
      await t.pumpAndSettle();
      await t.tap(find.byType(NavigationDestination).at(3));
      await t.pumpAndSettle();
      expect(find.text('متخصص نمونه'), findsNothing);
      await tapVisible(t, find.text('ویرایش اطلاعات فردی و مطب'));
      for (final field in {
        'medicalCode': '۸۸۹۹',
        'address': 'خیابان تازه، ساختمان مطب',
        'clinicPhone': '۰۲۱۱۲۳۴۵۶۷۸',
      }.entries) {
        final f = find.byKey(ValueKey('expert-${field.key}'));
        await t.ensureVisible(f);
        await t.enterText(f, field.value);
      }
      await tapVisible(t, find.text('ثبت اطلاعات متخصص'));
      expect(find.text('کد نظام پزشکی: ۸۸۹۹'), findsOneWidget);
      expect(s.questionnaire.name, userName);
      s.loginDemoUser();
      await t.pumpAndSettle();
      await t.tap(find.byType(NavigationDestination).at(3));
      await t.pumpAndSettle();
      await tapVisible(t, find.text('مشخصات دکتر'));
      expect(find.text('خیابان تازه، ساختمان مطب'), findsOneWidget);
      expect(find.text('۰۲۱۱۲۳۴۵۶۷۸'), findsOneWidget);
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
      s.dispose();
    },
  );
  testWidgets(
    'Admin edits a base question and adds a required question that user must answer',
    (t) async {
      mobile(t);
      final s = DemoStore()
        ..login(AppRole.admin)
        ..questionnaireComplete = true;
      s.questionnaire.consent = true;
      await t.pumpWidget(SabzineApp(store: s, splashDuration: Duration.zero));
      await t.pumpAndSettle();
      expect(find.text('دسترسی سریع'), findsNothing);
      expect(find.text('آخرین درخواست‌ها'), findsNothing);
      expect(find.textContaining('نیازمند توجه'), findsNothing);
      expect(find.text('آخرین پیام‌های پشتیبانی'), findsOneWidget);
      await tapVisible(t, find.text('ویرایش سؤال‌ها'));
      await tapVisible(t, find.byKey(const ValueKey('admin-question-name')));
      await t.enterText(
        find.byKey(const ValueKey('question-title')),
        'نام کامل شما',
      );
      await tapVisible(t, find.text('ثبت سؤال'));
      expect(s.formConfiguration.label('name'), 'نام و نام خانوادگی');
      await tapVisible(t, find.text('افزودن سؤال جدید'));
      await t.enterText(
        find.byKey(const ValueKey('question-title')),
        'ساعت معمول شام شما؟',
      );
      await tapVisible(t, find.text('پاسخ الزامی'));
      await tapVisible(t, find.text('ثبت سؤال'));
      await tapVisible(t, find.text('ذخیره و اعمال پرسش‌نامه'));
      expect(s.formConfiguration.label('name'), 'نام کامل شما');
      final added = s.formConfiguration.questions.last;
      t.state<NavigatorState>(find.byType(Navigator).first).pop();
      await t.pumpAndSettle();
      s.loginDemoUser();
      await t.pumpAndSettle();
      await t.tap(find.byType(NavigationDestination).at(3));
      await t.pumpAndSettle();
      await tapVisible(t, find.text('اطلاعات فردی'));
      expect(find.text('نام کامل شما'), findsOneWidget);
      await next(t);
      expect(find.text('کمی با هم آشنا بشیم'), findsOneWidget);
      final answer = find.byKey(ValueKey('extra-${added.id}'));
      await t.ensureVisible(answer);
      await t.enterText(answer, 'ساعت ۸ شب');
      for (var i = 0; i < 5; i++) {
        await next(t);
      }
      await tapVisible(t, find.text('ذخیرهٔ تغییرات'));
      expect(s.questionnaire.extraAnswers[added.id], 'ساعت ۸ شب');
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
      s.dispose();
    },
  );
  test(
    'Program reviews require completion, support delivery and admin approval',
    () async {
      final s = DemoStore(clock: () => DateTime(2026, 10, 30))..loginDemoUser();
      s.approveActiveUserRequest();
      for (var i = 0; i < s.mealsOn(s.today).length; i++) {
        await s.setMealEaten(s.today, i, true);
      }
      s.questionnaire.name = 'سارا احمدی';
      expect(s.approvedReviewsForDashboard().length, 2);
      s.submitProgramReview('برنامهٔ من عالی بود.');
      expect(s.pendingProgramReviews().length, 2);
      expect(s.userPendingReview()?.text, 'برنامهٔ من عالی بود.');
      expect(s.approvedReviewsForDashboard().length, 2);
      s.login(AppRole.admin);
      final pending = s.pendingProgramReviews().firstWhere(
        (r) => r.authorName == 'سارا احمدی',
      );
      s.approveProgramReview(pending.id);
      s.loginDemoUser();
      s.questionnaire.name = 'رضا موسوی';
      expect(
        s.approvedReviewsForDashboard().any(
          (r) => r.authorName == 'سارا احمدی',
        ),
        true,
      );
      s.dispose();
    },
  );
  test('Expert can add and remove draft meals', () {
    final s = DemoStore()..login(AppRole.expert);
    final id = '1042';
    final before = s.request(id).draft.length;
    s.addMeal(
      id,
      const Meal(
        name: 'میان‌وعده',
        title: 'ماست',
        time: '۱۶:۰۰',
        amount: '۱ لیوان',
        details: 'نمونه',
        calories: 180,
      ),
    );
    expect(s.request(id).draft.length, before + 1);
    s.removeMeal(id, before);
    expect(s.request(id).draft.length, before);
    s.dispose();
  });
  testWidgets(
    'Support message reaches admin dashboard and reply stays in support conversation',
    (t) async {
      mobile(t);
      final s = DemoStore()..loginDemoUser();
      s.send('پیگیری ویژهٔ کاربر', support: true);
      s.login(AppRole.admin);
      await t.pumpWidget(SabzineApp(store: s, splashDuration: Duration.zero));
      await t.pumpAndSettle();
      expect(find.text('پیگیری ویژهٔ کاربر'), findsOneWidget);
      await tapVisible(
        t,
        find.byKey(const ValueKey('conversation-support-main')),
      );
      await t.enterText(
        find.byKey(const ValueKey('chat-input')),
        'پاسخ پشتیبانی',
      );
      await t.tap(find.byTooltip('ارسال پیام'));
      await t.pumpAndSettle();
      expect(s.threadMessages('support-main').last.sender, AppRole.admin);
      expect(
        s.threadMessages('user-main').any((m) => m.text == 'پاسخ پشتیبانی'),
        false,
      );
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
      s.dispose();
    },
  );
}
