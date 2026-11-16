import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/core/icons/diet_icon.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/features/shell/shell_bar.dart';

void main() {
  testWidgets('all vector symbols render at small and large sizes in RTL', (
    t,
  ) async {
    await t.pumpWidget(
      MaterialApp(
        theme: appTheme(),
        home: Directionality(
          textDirection: TextDirection.rtl,
          child: Scaffold(
            body: Wrap(
              children: [
                for (final size in [16.0, 24.0, 48.0])
                  for (final kind in DietIconKind.values)
                    DietIcon(
                      kind,
                      size: size,
                      semanticLabel: '${kind.name} $size',
                    ),
                const DietIcon(
                  DietIconKind.coach,
                  color: Colors.white,
                  monochrome: true,
                ),
              ],
            ),
          ),
        ),
      ),
    );
    await t.pumpAndSettle();
    expect(
      find.byType(DietIcon),
      findsNWidgets(DietIconKind.values.length * 3 + 1),
    );
    expect(
      t.getSemantics(find.bySemanticsLabel('water 24.0')).label,
      'water 24.0',
    );
    expect(t.takeException(), isNull);
  });

  testWidgets(
    'custom navigation keeps labeled destinations and selected semantics',
    (t) async {
      t.view.physicalSize = const Size(320, 720);
      t.view.devicePixelRatio = 1;
      addTearDown(t.view.reset);
      final semantics = t.ensureSemantics();
      var selected = 1;
      var coach = 0;
      await t.pumpWidget(
        MaterialApp(
          theme: appTheme(),
          home: Directionality(
            textDirection: TextDirection.rtl,
            child: Scaffold(
              body: StatefulBuilder(
                builder: (context, setState) => MediaQuery(
                  data: MediaQuery.of(context).copyWith(
                    disableAnimations: true,
                    textScaler: const TextScaler.linear(1.5),
                  ),
                  child: Align(
                    alignment: Alignment.bottomCenter,
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: ShellTabBar(
                        selected: selected,
                        onHome: () => setState(() => selected = 1),
                        onPlan: () => setState(() => selected = 2),
                        onCoach: () => coach++,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
      await t.pumpAndSettle();
      expect(
        t
            .getSemantics(find.byKey(const ValueKey('tab-home')))
            .flagsCollection
            .isSelected
            .toBoolOrNull(),
        isTrue,
      );
      await t.tap(find.byKey(const ValueKey('tab-plan')));
      await t.pumpAndSettle();
      expect(selected, 2);
      expect(
        t
            .getSemantics(find.byKey(const ValueKey('tab-plan')))
            .flagsCollection
            .isSelected
            .toBoolOrNull(),
        isTrue,
      );
      await t.tap(find.text('مربی'));
      expect(coach, 1);
      await t.tap(find.byKey(const ValueKey('tab-home')));
      await t.pumpAndSettle();
      expect(selected, 1);
      expect(t.takeException(), isNull);
      semantics.dispose();
      await t.pumpWidget(const SizedBox());
    },
  );
}
