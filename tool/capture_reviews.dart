import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/app.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/widgets/review_carousel.dart';

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
  testWidgets('Preview compact swipeable user reviews', (t) async {
    t.view.physicalSize = const Size(390, 844);
    t.view.devicePixelRatio = 1;
    addTearDown(t.view.resetPhysicalSize);
    addTearDown(t.view.resetDevicePixelRatio);
    final s = DemoStore(clock: () => DateTime(2026, 10, 28))..loginDemoUser();
    s.approveActiveUserRequest();
    await t.pumpWidget(SabzineApp(store: s, splashDuration: Duration.zero));
    await t.pumpAndSettle();
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('../screenshots/refresh/13-day-empty.png'),
    );
    await s.setMealEaten(s.today, 0, true);
    await s.setMealEaten(s.today, 1, true);
    await t.pumpAndSettle();
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('../screenshots/refresh/14-day-half.png'),
    );
    await s.setMealEaten(s.today, 2, true);
    await t.pumpAndSettle();
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('../screenshots/refresh/15-day-three-quarters.png'),
    );
    final carousel = find.byType(ReviewCarousel);
    await Scrollable.ensureVisible(t.element(carousel), alignment: .75);
    await t.pumpAndSettle();
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('../screenshots/refresh/11-compact-reviews.png'),
    );
    await t.drag(
      find.byKey(const ValueKey('user-reviews-carousel')),
      const Offset(280, 0),
    );
    await t.pumpAndSettle();
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('../screenshots/refresh/12-next-review.png'),
    );
    expect(t.takeException(), isNull);
    await t.pumpWidget(const SizedBox());
    s.dispose();
  });
}
