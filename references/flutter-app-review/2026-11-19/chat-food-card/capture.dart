// From app: flutter test --no-pub ../references/flutter-app-review/2026-11-19/chat-food-card/capture.dart
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sabzine_flutter/core/photos/photos.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/features/coach/data/mock_coach_repository.dart';
import 'package:sabzine_flutter/features/coach/domain/coach_message.dart';
import 'package:sabzine_flutter/features/coach/presentation/coach_page.dart';
import 'package:sabzine_flutter/features/coach/presentation/cards/coach_cards.dart';

import '../../../../app/test/coach/coach_food_card_test.dart'
    show foodSuggestion;

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    SharedPreferences.setMockInitialValues({});
    await FoodPhotoResolver.load();
    await (FontLoader('Vazirmatn')
          ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Regular.ttf'))
          ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Bold.ttf')))
        .load();
    await (FontLoader(
      'MaterialIcons',
    )..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'))).load();
  });
  testWidgets('capture the compact food suggestion in the real chat', (
    t,
  ) async {
    t.view.physicalSize = const Size(780, 1688);
    t.view.devicePixelRatio = 2;
    addTearDown(t.view.reset);
    final store = DemoStore(clock: () => DateTime(2026, 11, 19, 12, 30))
      ..loginDemoUser();
    store.approveActiveUserRequest();
    addTearDown(store.dispose);
    final repo = MockCoachRepository(store: store, charDelay: Duration.zero);
    await repo.persist([
      CoachMessage(
        id: 'dinner-request',
        role: 'user',
        type: 'text',
        payload: {'text': 'برای شام یه غذای سبک پیشنهاد بده'},
        fallbackText: 'برای شام یه غذای سبک پیشنهاد بده',
        createdAt: store.today,
      ),
      foodSuggestion(),
    ]);
    const capture = ValueKey('food-card-capture');
    Widget host(Widget page, {double scale = 1}) => DemoScope(
      store: store,
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: appTheme(),
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(
            disableAnimations: true,
            textScaler: TextScaler.linear(scale),
          ),
          child: Directionality(
            textDirection: TextDirection.rtl,
            child: RepaintBoundary(key: capture, child: child!),
          ),
        ),
        home: page,
      ),
    );
    Future<void> shot(String name) async {
      await t.pumpAndSettle();
      final context = t.element(find.byType(MaterialApp));
      await t.runAsync(() async {
        for (final widget in t.widgetList<Image>(find.byType(Image))) {
          await precacheImage(widget.image, context);
        }
      });
      await t.pumpAndSettle();
      expect(t.takeException(), isNull);
      await t.runAsync(() async {
        final boundary = t.renderObject<RenderRepaintBoundary>(
          find.byKey(capture),
        );
        final picture = await boundary.toImage(pixelRatio: 2);
        final data = await picture.toByteData(format: ui.ImageByteFormat.png);
        await File(
          '../references/flutter-app-review/2026-11-19/chat-food-card/$name.png',
        ).writeAsBytes(data!.buffer.asUint8List());
        picture.dispose();
      });
    }

    await t.pumpWidget(host(CoachPage(repository: repo)));
    await shot('implemented-chat');
    await t.pumpWidget(const SizedBox());
    t.view.physicalSize = const Size(640, 1480);
    await t.pumpWidget(
      host(
        Scaffold(
          body: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: MealCardView(
              message: foodSuggestion(),
              onReview: () {},
              onSwap: () {},
            ),
          ),
        ),
        scale: 1.5,
      ),
    );
    await shot('narrow-large-text');
    await t.pumpWidget(const SizedBox());
  });
}
