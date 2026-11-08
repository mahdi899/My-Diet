import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/presentation/screens/expert.dart';
import 'package:sabzine_flutter/presentation/screens/shared.dart';
import 'package:sabzine_flutter/presentation/screens/user.dart';
import 'package:sabzine_flutter/presentation/screens/clinic_workspace.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'widget_test.dart' show mobile;

void main() {
  for (final id in ['1037']) {
    testWidgets(
      'Review $id opens correct patient conversation and sends message',
      (t) async {
        mobile(t);
        final s = DemoStore()..login(AppRole.expert);
        final request = s.request(id);
        await t.pumpWidget(
          DemoScope(
            store: s,
            child: MaterialApp(
              theme: appTheme(),
              home: ReviewScreen(requestId: id),
            ),
          ),
        );
        await t.pumpAndSettle();
        expect(
          t.widget<Text>(find.text('بررسی برنامه')).style?.color,
          Colors.white,
        );
        expect(find.byTooltip('گفتگو با کاربر'), findsNothing);
        expect(find.text('اطلاعات بیشتر'), findsNothing);
        await t.tap(find.text('گفتگو با کاربر'));
        await t.pumpAndSettle();
        expect(find.byType(ChatScreen), findsOneWidget);
        expect(find.text(request.name), findsWidgets);
        final screen = t.widget<ChatScreen>(find.byType(ChatScreen));
        expect(s.patientName(s.thread(screen.threadId)), request.name);
        await t.enterText(
          find.byKey(const ValueKey('chat-input')),
          'پیام برای ${request.name}',
        );
        await t.tap(find.byTooltip('ارسال پیام'));
        await t.pumpAndSettle();
        expect(
          s.threadMessages(screen.threadId).last.text,
          'پیام برای ${request.name}',
        );
        expect(s.threadMessages(screen.threadId).last.sender, AppRole.expert);
        final count = s.chatThreads.length;
        expect(s.conversationForRequest(id).id, screen.threadId);
        expect(s.chatThreads.length, count);
        expect(t.takeException(), isNull);
        await t.pumpWidget(const SizedBox());
        s.dispose();
      },
    );
  }
  test('Account request remains linked after patient name changes', () {
    final s = DemoStore()..loginDemoUser();
    s.questionnaire.name = 'نام تازه';
    expect(s.conversationForRequest(s.userRequestId!).id, 'user-main');
    s.dispose();
  });
  testWidgets(
    'Revision doctor message shows reply status and user reply returns to review',
    (t) async {
      mobile(t);
      final s = DemoStore()..loginDemoUser();
      s.approveActiveUserRequest();
      final r = s.userRequest;
      final published = r.published.first.title;
      s.requestRevision('زمان تهیه غذا', 'شام ساده‌تر باشد');
      expect(r.revisionAwaitingUser, false);
      s.login(AppRole.expert);
      s.send('برای شام چقدر وقت داری؟', threadId: 'user-main');
      expect(r.revisionAwaitingUser, true);
      expect(r.status, PlanStatus.needsInfo);
      s.markThreadRead('user-main', AppRole.user);
      expect(r.revisionAwaitingUser, true);
      s.login(AppRole.admin);
      s.send('پاسخ پشتیبانی', support: true);
      expect(r.revisionAwaitingUser, true);
      s.login(AppRole.user);
      await t.pumpWidget(
        DemoScope(
          store: s,
          child: MaterialApp(
            theme: appTheme(),
            home: Scaffold(body: UserHome(onPlan: () {})),
          ),
        ),
      );
      await t.pumpAndSettle();
      final reply = find.byKey(const ValueKey('reply-to-revision'));
      await t.ensureVisible(reply);
      await t.pumpAndSettle();
      expect(find.text('در انتظار پاسخ کاربر'), findsOneWidget);
      expect(find.text('برای شام چقدر وقت داری؟'), findsOneWidget);
      await t.tap(reply);
      await t.pumpAndSettle();
      expect(
        t.widget<ChatScreen>(find.byType(ChatScreen)).threadId,
        'user-main',
      );
      await t.enterText(
        find.byKey(const ValueKey('chat-input')),
        'حدود بیست دقیقه',
      );
      await t.tap(find.byTooltip('ارسال پیام'));
      await t.pumpAndSettle();
      expect(r.revisionAwaitingUser, false);
      expect(r.status, PlanStatus.reviewing);
      expect(r.revisionRequested, true);
      expect(r.revisionReply, 'حدود بیست دقیقه');
      expect(r.published.first.title, published);
      Navigator.of(t.element(find.byType(ChatScreen))).pop();
      await t.pumpAndSettle();
      expect(find.text('در انتظار پاسخ کاربر'), findsNothing);
      expect(find.text('پاسخت برای متخصص ارسال شد'), findsOneWidget);
      s.login(AppRole.expert);
      s.send('آیا اجاق در دسترس داری؟', threadId: 'user-main');
      expect(r.revisionAwaitingUser, true);
      expect(r.revisionReply, isEmpty);
      s.login(AppRole.user);
      s.send('بله', threadId: 'user-main');
      s.login(AppRole.expert);
      s.approve(r.id);
      expect(r.revisionRequested, false);
      expect(r.revisionAwaitingUser, false);
      expect(r.revisionMessage, isEmpty);
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
      s.dispose();
    },
  );
  test(
    'Initial plan retains information request and support does not answer revision',
    () {
      final s = DemoStore()..loginDemoUser();
      s.requestRevision('دلیل', 'یادداشت');
      s.login(AppRole.expert);
      s.send('سؤال اصلاح', threadId: 'user-main');
      s.login(AppRole.user);
      s.send('پیام پشتیبانی', support: true);
      expect(s.userRequest.revisionAwaitingUser, true);
      s.send('پاسخ اصلاح');
      expect(s.userRequest.revisionAwaitingUser, false);
      s.approve(s.userRequestId!);
      s.needInfo(s.userRequestId!, 'سؤال پرونده');
      s.send('پاسخ پرونده');
      expect(s.userRequest.infoAnswer, 'پاسخ پرونده');
      expect(s.userRequest.infoAnswerReviewed, false);
      s.dispose();
    },
  );
  testWidgets(
    'Revision filter shows only change requests and combines with search',
    (t) async {
      mobile(t);
      final s = DemoStore()..login(AppRole.expert);
      await t.pumpWidget(
        DemoScope(
          store: s,
          child: MaterialApp(
            theme: appTheme(),
            home: const RequestListScreen(),
          ),
        ),
      );
      await t.pumpAndSettle();
      await t.tap(find.widgetWithText(ChoiceChip, 'درخواست اصلاح'));
      await t.pumpAndSettle();
      expect(find.text('علی شریفی'), findsOneWidget);
      expect(find.text('امیر حسینی'), findsNothing);
      await t.enterText(find.byType(TextField), 'امیر');
      await t.pumpAndSettle();
      expect(find.text('موردی پیدا نشد'), findsOneWidget);
      await t.enterText(find.byType(TextField), '۱۰۳۷');
      await t.pumpAndSettle();
      expect(find.text('علی شریفی'), findsOneWidget);
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
      s.dispose();
    },
  );
  testWidgets(
    'Revision cards swipe in RTL, open the selected request and handle removal',
    (t) async {
      mobile(t);
      final s = DemoStore()..login(AppRole.expert);
      final first = s.request('1041'), second = s.request('1037');
      first.revisionRequested = true;
      first.revisionReason = 'وعدهٔ سریع‌تر';
      Future<void> show(List<DietRequest> rows) async {
        await t.pumpWidget(
          DemoScope(
            store: s,
            child: MaterialApp(
              theme: appTheme(),
              builder: (context, child) => Directionality(
                textDirection: TextDirection.rtl,
                child: child!,
              ),
              home: Scaffold(
                body: SingleChildScrollView(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: RevisionRequestCarousel(requests: rows),
                  ),
                ),
              ),
            ),
          ),
        );
        await t.pumpAndSettle();
      }

      await show([first, second]);
      final pages = find.byKey(const ValueKey('revision-request-carousel'));
      await t.drag(pages, const Offset(320, 0));
      await t.pumpAndSettle();
      expect(t.widget<PageView>(pages).controller!.page, closeTo(1, .01));
      await t.tap(find.text(second.name).hitTestable());
      await t.pumpAndSettle();
      expect(
        t.widget<ReviewScreen>(find.byType(ReviewScreen)).requestId,
        second.id,
      );
      Navigator.of(t.element(find.byType(ReviewScreen))).pop();
      await t.pumpAndSettle();
      await show([first]);
      expect(t.widget<PageView>(pages).controller!.page, closeTo(0, .01));
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
      s.dispose();
    },
  );
}
