import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/presentation/screens/doctor.dart';

Widget doctorHost(DemoStore store, {double scale = 1}) => DemoScope(
  store: store,
  child: MaterialApp(
    theme: appTheme(),
    builder: (context, child) => MediaQuery(
      data: MediaQuery.of(
        context,
      ).copyWith(textScaler: TextScaler.linear(scale)),
      child: Directionality(textDirection: TextDirection.rtl, child: child!),
    ),
    home: const DoctorDetailsScreen(),
  ),
);

void main() {
  setUpAll(() async {
    await (FontLoader('Vazirmatn')
          ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Regular.ttf'))
          ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Bold.ttf')))
        .load();
  });

  testWidgets('clinic call opens only the normalized public phone number', (
    t,
  ) async {
    final store = DemoStore();
    addTearDown(store.dispose);
    final doctor = store.experts.first;
    doctor.clinicPhone = '+۹۸ (۲۱) ۱۲۳۴-۵۶۷۸';
    const channel = MethodChannel('plugins.flutter.io/url_launcher');
    final calls = <MethodCall>[];
    var succeeds = true;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) async {
          calls.add(call);
          return succeeds;
        });
    addTearDown(() {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, null);
    });
    await t.pumpWidget(doctorHost(store));
    await t.pumpAndSettle();
    final button = find.byKey(const ValueKey('doctor-call-clinic'));
    await t.ensureVisible(button);
    await t.tap(button);
    await t.pumpAndSettle();
    expect(calls.single.method, 'launch');
    expect(calls.single.arguments['url'], 'tel:+982112345678');
    expect(find.text(doctor.mobile), findsNothing);
    succeeds = false;
    await t.tap(button);
    await t.pumpAndSettle();
    expect(find.text('تماس باز نشد؛ شماره را دستی بگیر.'), findsOneWidget);
    expect(find.text(doctor.clinicPhone), findsOneWidget);
    await t.pumpWidget(const SizedBox());
  });

  testWidgets(
    'missing clinic details never expose a personal phone as fallback',
    (t) async {
      final store = DemoStore();
      addTearDown(store.dispose);
      final doctor = store.experts.first;
      doctor.clinicPhone = '';
      doctor.address = '';
      doctor.experience = '';
      await t.pumpWidget(doctorHost(store));
      await t.pumpAndSettle();
      expect(find.byKey(const ValueKey('doctor-call-clinic')), findsNothing);
      expect(find.text(doctor.mobile), findsNothing);
      expect(find.text('ثبت نشده'), findsNWidgets(2));
      expect(find.textContaining('سال سابقه'), findsNothing);
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
    },
  );

  testWidgets(
    'long doctor details remain readable on a narrow large-text screen',
    (t) async {
      t.view.physicalSize = const Size(320, 740);
      t.view.devicePixelRatio = 1;
      addTearDown(t.view.reset);
      final store = DemoStore();
      addTearDown(store.dispose);
      final doctor = store.experts.first;
      doctor.name = 'دکتر نازنین رضایی متخصص تغذیه و رژیم‌درمانی';
      doctor.address =
          'تهران، خیابان نمونه، ساختمان سلامت، طبقه دوم، واحد دوازده';
      await t.pumpWidget(doctorHost(store, scale: 1.5));
      await t.pumpAndSettle();
      expect(find.text(doctor.name), findsOneWidget);
      await t.ensureVisible(find.text(doctor.degree));
      await t.pumpAndSettle();
      expect(find.text(doctor.degree), findsOneWidget);
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
    },
  );

  testWidgets('an unassigned doctor shows the empty state', (t) async {
    final store = DemoStore()..experts.clear();
    addTearDown(store.dispose);
    await t.pumpWidget(doctorHost(store));
    await t.pumpAndSettle();
    expect(find.text('متخصص هنوز مشخص نشده'), findsOneWidget);
    expect(find.byKey(const ValueKey('doctor-profile-header')), findsNothing);
    expect(find.byKey(const ValueKey('doctor-call-clinic')), findsNothing);
    await t.pumpWidget(const SizedBox());
  });
}
