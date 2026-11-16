import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/domain/common/number_format.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/features/home/weight_sheet.dart';
import 'package:sabzine_flutter/presentation/widgets/kit/pill_button.dart';

Widget host(Widget child) => MaterialApp(
  theme: appTheme(),
  builder: (context, page) => MediaQuery(
    data: MediaQuery.of(
      context,
    ).copyWith(textScaler: const TextScaler.linear(1.5)),
    child: Directionality(textDirection: TextDirection.rtl, child: page!),
  ),
  home: Scaffold(body: child),
);

void main() {
  setUpAll(() async {
    await (FontLoader('Vazirmatn')
          ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Regular.ttf'))
          ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Bold.ttf')))
        .load();
  });
  test(
    'Persian display preserves fractions, signs and meaningful precision',
    () {
      expect(fa('12:٣٤'), '۱۲:۳۴');
      expect(persianNumber(68), '۶۸');
      expect(persianNumber(68.5), '۶۸٫۵');
      expect(persianNumber(-.01), '۰');
      expect(persianNumber(-1250000, grouped: true), '-۱٬۲۵۰٬۰۰۰');
      expect(persianNumber(12, fractionDigits: 2), '۱۲٫۰۰');
      expect(persianQuantity(.25, 'قاشق چای‌خوری'), '۰٫۲۵ قاشق چای‌خوری');
      expect(persianQuantity(150.125, 'گرم'), '۱۵۰٫۱۲۵ گرم');
      expect(persianQuantity(1, 'پیمانه 150 گرمی'), '۱ پیمانه ۱۵۰ گرمی');
      expect(latinDigits('٦٨٫٥'), '68.5');
    },
  );
  testWidgets('large Persian CTA wraps and loading/disabled cannot fire', (
    t,
  ) async {
    t.view.physicalSize = const Size(280, 700);
    t.view.devicePixelRatio = 1;
    addTearDown(t.view.reset);
    var taps = 0;
    Widget buttons({bool loading = false}) => host(
      Center(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              PillButton(
                label: 'تأیید اطلاعات و ادامهٔ مسیر برنامهٔ غذایی',
                loading: loading,
                onPressed: () => taps++,
              ),
              const PillButton(label: 'فعلاً در دسترس نیست'),
            ],
          ),
        ),
      ),
    );
    await t.pumpWidget(buttons());
    expect(t.takeException(), isNull);
    await t.tap(find.text('تأیید اطلاعات و ادامهٔ مسیر برنامهٔ غذایی'));
    expect(taps, 1);
    final active = t.widget<FilledButton>(find.byType(FilledButton).first);
    final disabled = t.widget<FilledButton>(find.byType(FilledButton).last);
    expect(active.onPressed, isNotNull);
    expect(disabled.onPressed, isNull);
    expect(t.getSize(find.byType(FilledButton).first).height, greaterThan(54));
    await t.pumpWidget(buttons(loading: true));
    expect(
      t.widget<FilledButton>(find.byType(FilledButton).first).onPressed,
      isNull,
    );
    await t.pumpWidget(const SizedBox());
  });
  testWidgets(
    'weight accepts both Persian and Arabic decimals after an error',
    (t) async {
      SharedPreferences.setMockInitialValues({});
      final store = DemoStore()..loginDemoUser();
      addTearDown(store.dispose);
      await t.pumpWidget(
        DemoScope(
          store: store,
          child: host(
            Builder(
              builder: (context) => TextButton(
                onPressed: () => showWeightSheet(context),
                child: const Text('باز کردن'),
              ),
            ),
          ),
        ),
      );
      for (final value in ['۶۸٫۵', '٦٩٫٢']) {
        await t.tap(find.text('باز کردن'));
        await t.pumpAndSettle();
        await t.enterText(find.byType(TextField), 'نامعتبر');
        await t.tap(find.text('ثبت'));
        await t.pumpAndSettle();
        expect(find.text('یک وزن واقعی بنویس'), findsOneWidget);
        await t.enterText(find.byType(TextField), value);
        await t.pumpAndSettle();
        expect(find.text('یک وزن واقعی بنویس'), findsNothing);
        await t.tap(find.text('ثبت'));
        await t.pumpAndSettle();
        expect(store.latestWeight, double.parse(latinDigits(value)));
      }
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
    },
  );
}
