import 'package:flutter/material.dart';

import '../../core/icons/diet_icon.dart';
import '../../core/theme/theme.dart';
import '../../domain/common/number_format.dart';
import '../../presentation/session/customer_scope.dart';
import '../../presentation/widgets/brand_scene.dart';
import '../../presentation/widgets/kit/kit.dart';
import 'sparkline.dart';
import 'weight_sheet.dart';

/// A single measurement is a starting point; a trend uses actual later records.
class HomeWeightCard extends StatelessWidget {
  const HomeWeightCard({super.key});

  @override
  Widget build(BuildContext context) {
    final store = CustomerScope.of(context);
    final values = store.weightEntries;
    final hasTrend = values.length >= 2;
    final change = hasTrend ? values.last - values.first : 0.0;
    final changeLabel = change.abs() < .05
        ? 'بدون تغییر نسبت به اولین ثبت'
        : '${persianNumber(change.abs())} کیلو ${change < 0 ? 'کمتر' : 'بیشتر'} از اولین ثبت';
    return AppCard(
      key: const ValueKey('home-weight-card'),
      padding: const EdgeInsets.all(18),
      radius: 28,
      shadows: const [
        BoxShadow(
          color: Color(0x0D493C1E),
          blurRadius: 24,
          offset: Offset(0, 8),
        ),
      ],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Row(
            children: [
              DietIcon(DietIconKind.scale, size: 26),
              SizedBox(width: 8),
              Expanded(child: Text('روند وزن', style: AppTypography.cardTitle)),
            ],
          ),
          const SizedBox(height: 10),
          LayoutBuilder(
            builder: (context, constraints) {
              final largeText = MediaQuery.textScalerOf(context).scale(14) > 18;
              final reading = Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'آخرین وزن ثبت‌شده',
                    style: AppTypography.supporting,
                  ),
                  const SizedBox(height: 4),
                  if (values.isNotEmpty)
                    Ticker(
                      value: store.latestWeight,
                      fractionDigits:
                          store.latestWeight ==
                              store.latestWeight.roundToDouble()
                          ? 0
                          : 1,
                      suffix: ' کیلو',
                      style: AppTypography.number.copyWith(
                        fontSize: 36,
                        color: const Color(0xFF07543A),
                      ),
                    )
                  else
                    const Text('هنوز ثبت نشده', style: AppTypography.cardTitle),
                  if (!hasTrend) ...[
                    const SizedBox(height: 10),
                    Container(
                      key: const ValueKey('home-weight-start'),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE3F2D9),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        values.isEmpty
                            ? 'اولین وزنت را ثبت کن'
                            : 'شروع مسیر ثبت شد',
                        style: const TextStyle(
                          color: Color(0xFF07543A),
                          fontSize: 11,
                          height: 1.6,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ],
              );
              const art = BrandScene(
                kind: BrandSceneKind.weightJourney,
                height: 146,
              );
              if (largeText || constraints.maxWidth < 270) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    reading,
                    const SizedBox(height: 4),
                    const Align(
                      alignment: AlignmentDirectional.centerEnd,
                      child: SizedBox(width: 130, child: art),
                    ),
                  ],
                );
              }
              return Row(
                children: [
                  Expanded(flex: 6, child: reading),
                  Expanded(flex: 5, child: art),
                ],
              );
            },
          ),
          const SizedBox(height: 10),
          if (!hasTrend)
            Text(
              values.isEmpty
                  ? 'وزن‌های ثبت‌شده‌ات اینجا به یک نمودار تبدیل می‌شوند.'
                  : 'با ثبت وزن در روزی دیگر، نمودارت شکل می‌گیرد.',
              style: const TextStyle(
                fontSize: 12,
                height: 1.8,
                color: AppColors.inkSoft,
              ),
            )
          else ...[
            Wrap(
              alignment: WrapAlignment.spaceBetween,
              spacing: 12,
              runSpacing: 4,
              children: [
                Text(
                  changeLabel,
                  style: AppTypography.supporting.copyWith(
                    color: AppColors.inkSoft,
                  ),
                ),
                Text(
                  '${fa(values.length)} ثبت',
                  style: AppTypography.supporting,
                ),
              ],
            ),
            const SizedBox(height: 14),
            Semantics(
              label:
                  'نمودار وزن، از ${persianNumber(values.first)} تا ${persianNumber(values.last)} کیلوگرم؛ $changeLabel',
              image: true,
              child: SizedBox(
                key: const ValueKey('home-weight-trend'),
                height: 70,
                child: CustomPaint(
                  painter: SparklinePainter(values),
                  child: const SizedBox.expand(),
                ),
              ),
            ),
            const SizedBox(height: 8),
            Directionality(
              textDirection: TextDirection.ltr,
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      'اولین ثبت: ${persianNumber(values.first)}',
                      textDirection: TextDirection.rtl,
                      textAlign: TextAlign.left,
                      style: AppTypography.supporting,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'آخرین ثبت: ${persianNumber(values.last)}',
                      textDirection: TextDirection.rtl,
                      textAlign: TextAlign.right,
                      style: AppTypography.supporting,
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 16),
          PillButton(
            label: 'ثبت وزن',
            icon: Icons.add_rounded,
            height: 48,
            onPressed: () => showWeightSheet(context),
          ),
        ],
      ),
    );
  }
}
