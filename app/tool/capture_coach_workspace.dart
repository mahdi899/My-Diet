// flutter test tool/capture_coach_workspace.dart --update-goldens
import 'dart:convert';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/features/coach/data/mock_coach_repository.dart';
import 'package:sabzine_flutter/features/coach/domain/coach_message.dart';
import 'package:sabzine_flutter/features/coach/domain/coach_events.dart';
import 'package:sabzine_flutter/features/coach/presentation/coach_page.dart';
import 'package:sabzine_flutter/features/coach/presentation/composer.dart';
import 'package:sabzine_flutter/features/coach/presentation/photo_preview.dart';
import 'package:sabzine_flutter/features/coach/presentation/workspace_pages.dart';

class PreviewCoach extends MockCoachRepository {
  PreviewCoach({required super.store}) : super(charDelay: Duration.zero);
  bool hold = false;
  final stream = StreamController<CoachEvent>.broadcast();
  @override
  Stream<CoachEvent> send(CoachSendRequest request, {List<int>? photoBytes}) =>
      hold ? stream.stream : super.send(request, photoBytes: photoBytes);
  @override
  Future<Map<String, dynamic>> quota() async => {
    'hasQuota': true,
    'dailyRemaining': 18,
    'dailyLimit': 20,
    'periodRemaining': 75,
  };
}

CoachMessage message(String id, String text, String role, int minute) =>
    CoachMessage(
      id: id,
      role: role,
      type: 'text',
      payload: {'text': text},
      fallbackText: text,
      createdAt: DateTime(2026, 11, 19, 18, minute),
    );

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
  testWidgets('capture the working coach tools with demo data', (t) async {
    // ignore: invalid_use_of_visible_for_testing_member
    SharedPreferences.setMockInitialValues({});
    t.view.physicalSize = const Size(390, 900);
    t.view.devicePixelRatio = 1;
    addTearDown(t.view.reset);
    final store = DemoStore(clock: () => DateTime(2026, 11, 19, 18, 30))
      ..loginDemoUser();
    addTearDown(store.dispose);
    final repo = PreviewCoach(store: store);
    final question = message(
      'q1',
      'برای شام یه غذای ساده و سریع می‌خوام.',
      'user',
      10,
    );
    final advice = message(
      'a1',
      'عدسیِ برنامه‌ات رو می‌تونی برای شام آماده کنی. مقدار وعده رو از کارت برنامه ببین؛ اگر موادش رو نداری، با هم جایگزین انتخاب می‌کنیم.',
      'assistant',
      11,
    );
    await repo.persist([
      question,
      message(
        'a0',
        'یادم می‌مونه که زمان کمی برای آشپزی داری.',
        'assistant',
        10,
      ),
      for (var i = 0; i < 5; i++)
        message(
          'old$i',
          [
            'غذای ساده رو ترجیح می‌دم.',
            'مواد اولیه‌ام عدس و سبزیجاته.',
            'شام رو معمولاً ساعت هشت می‌خورم.',
            'امروز آبم رو ثبت کردم.',
            'برای خرید فردا برنامه دارم.',
          ][i],
          i.isEven ? 'user' : 'assistant',
          12 + i,
        ),
      message('q2', 'امشب عدسی توی برنامه‌ام هست؟', 'user', 20),
      advice,
    ]);
    await repo.renameConversation(repo.conversationId!, 'شام سبک و سریع');
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      'coach.memory.${repo.workspaceOwner}',
      jsonEncode([
        {
          'id': 'like',
          'key': 'food_like',
          'value': 'عدسی و غذاهای خونگی',
          'source': 'user',
        },
        {
          'id': 'pattern',
          'key': 'pattern',
          'value': 'غذای سریع با مواد اولیه کم',
          'source': 'user',
        },
        {
          'id': 'dislike',
          'key': 'food_dislike',
          'value': 'غذاهای خیلی چرب',
          'source': 'user',
        },
      ]),
    );
    Widget host(Widget page) => DemoScope(
      store: store,
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: appTheme(),
        builder: (_, child) =>
            Directionality(textDirection: TextDirection.rtl, child: child!),
        home: page,
      ),
    );
    Future<void> shot(String name, {bool settle = true}) async {
      if (settle) {
        await t.pumpAndSettle();
      } else {
        await t.pump(const Duration(milliseconds: 150));
      }
      expect(t.takeException(), isNull);
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile(
          '../../references/screenshots/coach-workspace/$name.png',
        ),
      );
    }

    await t.pumpWidget(host(CoachPage(repository: repo)));
    await t.pumpAndSettle();
    final controller = t
        .widget<CoachComposer>(find.byType(CoachComposer))
        .controller;
    controller.setReply(advice);
    await t.pumpAndSettle();
    await t.enterText(
      find.byKey(const ValueKey('coach-input')),
      'اگه عدسی نداشتم چی جایگزین کنم؟',
    );
    t.testTextInput.hide();
    await shot('01-chat-reply-draft');
    await t.tap(find.byTooltip('گزینه‌های پیام').first);
    await shot('02-message-menu');
    await t.tap(find.text('ذخیره در نشان‌شده‌ها'));
    await t.pumpAndSettle();
    await controller.notebook.bookmark(
      advice,
      repo.conversationId,
      'شام سبک و سریع',
    );
    await t.pump(const Duration(seconds: 5));
    openCoachLibrary(
      t.element(find.byType(CoachPage)),
      controller,
      saved: true,
    );
    await shot('03-bookmarks');
    await t.tap(find.text('جست‌وجو'));
    await t.pumpAndSettle();
    await t.enterText(find.byKey(const ValueKey('coach-search-input')), 'عدسی');
    t.testTextInput.hide();
    await t.pump(const Duration(milliseconds: 400));
    await shot('04-search');
    await t.pageBack();
    await t.pumpAndSettle();
    await t.tap(find.byTooltip('ابزارهای گفتگو'));
    await t.pumpAndSettle();
    await t.tap(find.text('حافظه مربی'));
    await shot('05-memory');
    await t.pageBack();
    await t.pumpAndSettle();
    final bytes = (await rootBundle.load(
      'assets/photo/food/bushehri_dal_adas_served_in.jpg',
    )).buffer.asUint8List();
    final context = t.element(find.byType(CoachPage));
    await t.runAsync(() => precacheImage(MemoryImage(bytes), context));
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => CoachPhotoPreview(
          selection: CoachPhotoSelection('meal.jpg', bytes),
          replace: () async => null,
        ),
      ),
    );
    await t.pumpAndSettle();
    await t.tap(find.text('نصف'));
    await t.pumpAndSettle();
    await t.enterText(
      find.byType(TextField).last,
      'عدسی خونگی؛ نصف بشقاب خوردم.',
    );
    t.testTextInput.hide();
    await shot('06-photo-preview');
    await t.pageBack();
    await t.pumpAndSettle();
    controller.setReply(null);
    await t.pumpAndSettle();
    await t.enterText(find.byKey(const ValueKey('coach-input')), '');
    t.testTextInput.hide();
    repo.hold = true;
    final sending = controller.sendText(
      'برای شام چی رو می‌تونم سریع آماده کنم؟',
    );
    await t.pump();
    repo.stream.add(
      const CoachDelta(
        streamId: 'preview',
        text: 'می‌تونیم از غذاهای برنامه‌ات یک گزینه ساده انتخاب کنیم.',
      ),
    );
    await shot('07-delivery-and-stop', settle: false);
    await t.tap(find.byTooltip('توقف نمایش پاسخ'));
    await sending;
    await shot('08-stopped-response');
    await repo.stream.close();
    await t.pumpWidget(const SizedBox());
  });
}
