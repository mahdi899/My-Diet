// Reproducible screenshots of real application widgets with demo data.
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:sabzine_flutter/core/photos/photos.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/app.dart';
import 'package:sabzine_flutter/presentation/widgets/brand_scene.dart';
import 'package:sabzine_flutter/presentation/widgets/connection_gate.dart';
import 'package:sabzine_flutter/presentation/screens/payment_recovery_view.dart';
import 'package:sabzine_flutter/features/plan/plan_states.dart';
import 'package:sabzine_flutter/features/plan/plan_shopping_page.dart';
import 'package:sabzine_flutter/features/home/habit_garden.dart';
import 'package:sabzine_flutter/presentation/onboarding/widgets/steps.dart';
import 'package:sabzine_flutter/presentation/onboarding/widgets/plan_theater.dart';
import 'package:sabzine_flutter/domain/onboarding/spec.dart';
import 'package:sabzine_flutter/data/connection.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    SharedPreferences.setMockInitialValues({});
    SharedPreferencesAsyncPlatform.instance =
        InMemorySharedPreferencesAsync.empty();
    await (FontLoader('Vazirmatn')
          ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Regular.ttf'))
          ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Bold.ttf')))
        .load();
    await (FontLoader(
      'MaterialIcons',
    )..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'))).load();
    await FoodPhotoResolver.load();
  });
  testWidgets(
    'capture the brand illustration family in real application widgets',
    (t) async {
      t.view.physicalSize = const Size(780, 1688);
      t.view.devicePixelRatio = 2;
      addTearDown(t.view.reset);
      final date = DateTime(2026, 11, 9, 12, 30);
      final store = DemoStore(clock: () => date)..loginDemoUser();
      addTearDown(store.dispose);
      const key = ValueKey('capture-design-system');
      Future<void> mount(Widget page, {double scale = 1}) async {
        await t.pumpWidget(const SizedBox());
        await t.pumpWidget(
          RepaintBoundary(
            key: key,
            child: DemoScope(
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
                    child: child!,
                  ),
                ),
                home: page,
              ),
            ),
          ),
        );
        await t.pumpAndSettle();
      }

      Future<void> shot(String name) async {
        for (var pass = 0; pass < 3; pass++) {
          final widgets = t.widgetList<Image>(find.byType(Image)).toList();
          final context = t.element(find.byType(MaterialApp));
          await t.runAsync(() async {
            for (final w in widgets) {
              await precacheImage(w.image, context);
            }
          });
          await t.pumpAndSettle();
        }
        expect(t.takeException(), isNull);
        await t.runAsync(() async {
          final boundary = t.renderObject<RenderRepaintBoundary>(
            find.byKey(key),
          );
          final picture = await boundary.toImage(pixelRatio: 2);
          final data = await picture.toByteData(format: ui.ImageByteFormat.png);
          final file = File(
            '../references/flutter-app-review/2026-11-17/brand-illustrations/implemented/$name.png',
          );
          await file.parent.create(recursive: true);
          await file.writeAsBytes(data!.buffer.asUint8List());
          picture.dispose();
        });
      }

      t.view.physicalSize = const Size(1920, 2560);
      await mount(const SceneGallery());
      await shot('family');
      t.view.physicalSize = const Size(780, 1688);
      final tracks = [
        for (final track in [
          ['weight_loss', 'کاهش وزن', 'رسیدن به وزن دلخواه'],
          ['healthy', 'تغذیهٔ سالم', 'ساختن عادت‌های ماندگار'],
          ['weight_gain', 'افزایش وزن', 'تقویت بدن با تغذیهٔ مناسب'],
        ])
          SpecTrack(
            id: track[0],
            title: track[1],
            description: track[2],
            badge: 'هدف من',
            image: '',
            kcalHint: '',
          ),
      ];
      Widget intro() => HeroGoalScreen(
        tracks: tracks,
        value: null,
        progress: .04,
        onChanged: (_) {},
      );
      await mount(intro());
      await shot('welcome');
      await mount(const Scaffold(body: PlanBuildTheater()));
      await shot('building');
      store.userRequest.status = PlanStatus.reviewing;
      expect(store.userRequest.isPublished, isFalse);
      await mount(const Scaffold(body: PlanWaiting()));
      await shot('review');
      store.userRequest.status = PlanStatus.needsInfo;
      store.userRequest.question = 'آیا به مادهٔ غذایی خاصی حساسیت داری؟';
      store.userRequest.infoAnswer = '';
      await mount(const Scaffold(body: PlanWaiting()));
      await shot('information');
      await mount(const Scaffold(body: PlanEmpty()));
      await shot('empty-plan');
      Widget payment(bool pending) => Scaffold(
        appBar: AppBar(title: const Text('پرداخت برنامه')),
        body: PaymentRecoveryView(
          planTitle: 'برنامهٔ غذایی شخصی',
          days: 30,
          amount: '۲۹۹٬۰۰۰ تومان',
          message: pending
              ? 'در انتظار پاسخ درگاه پرداخت'
              : 'پرداخت از سوی درگاه تکمیل نشد.',
          pending: pending,
          onRetry: () {},
          onBack: () {},
          onSupport: () {},
        ),
      );
      await mount(payment(true));
      await shot('payment-pending');
      await mount(payment(false));
      await shot('payment-issue');
      final link = LinkMonitor()..report(LinkFault.offline);
      await mount(ConnectionScreen(link: link));
      await shot('connection');
      await mount(
        Scaffold(
          appBar: AppBar(title: const Text('قدم‌های روزانه')),
          body: const SingleChildScrollView(
            padding: EdgeInsets.all(20),
            child: HabitGarden(),
          ),
        ),
      );
      await shot('habits');
      store.userRequest.status = PlanStatus.reviewing;
      store.userRequest.question = '';
      store.approveActiveUserRequest();
      await mount(const PlanShoppingPage());
      await shot('shopping');
      await mount(const PanelShell(role: AppRole.user));
      await t.tap(find.byKey(const ValueKey('tab-plan')));
      await t.pumpAndSettle();
      await shot('published');
      t.view.physicalSize = const Size(640, 1440);
      await mount(intro(), scale: 1.5);
      await shot('welcome-large-text');
      await mount(payment(true), scale: 1.5);
      await shot('payment-large-text');
      await mount(ConnectionScreen(link: link), scale: 1.5);
      await shot('connection-large-text');
      await t.ensureVisible(find.byKey(const ValueKey('connection-retry')));
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
      link.dispose();
    },
  );
}

class SceneGallery extends StatelessWidget {
  const SceneGallery({super.key});
  static const labels = [
    'جوانهٔ خانه',
    'شروع مسیر',
    'آماده‌سازی برنامه',
    'بررسی متخصص',
    'برنامهٔ منتشرشده',
    'اطلاعات تکمیلی',
    'هنوز برنامه‌ای نداری',
    'ارتباط برقرار نیست',
    'انتظار نتیجهٔ پرداخت',
    'پرداخت تکمیل نشد',
    'قدم‌های روزانه',
    'آماده‌کردن خرید',
  ];
  @override
  Widget build(BuildContext context) => Scaffold(
    body: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'خانوادهٔ تصویرهای رژیم من',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 32,
              fontWeight: FontWeight.bold,
              color: AppColors.emeraldDark,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'یک همراه آشنا، در موقعیت‌های متفاوت',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 18, color: AppColors.inkSoft),
          ),
          const SizedBox(height: 28),
          Expanded(
            child: GridView.count(
              physics: const NeverScrollableScrollPhysics(),
              crossAxisCount: 3,
              mainAxisSpacing: 16,
              crossAxisSpacing: 16,
              childAspectRatio: 1.18,
              children: [
                for (final kind in BrandSceneKind.values)
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      border: Border.all(color: AppColors.line),
                      borderRadius: BorderRadius.circular(24),
                      color: Colors.white,
                    ),
                    child: Column(
                      children: [
                        Expanded(child: BrandScene(kind: kind, height: 200)),
                        const SizedBox(height: 8),
                        Text(
                          labels[kind.index],
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.bold,
                            color: AppColors.emeraldDark,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}
