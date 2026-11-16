import 'package:flutter/material.dart';

import '../../core/theme/tokens.dart';
import '../../domain/common/digits.dart';
import '../widgets/brand_scene.dart';
import '../widgets/ui.dart' show PrimaryButton;

class PaymentRecoveryView extends StatelessWidget {
  const PaymentRecoveryView({
    super.key,
    required this.planTitle,
    required this.amount,
    required this.message,
    required this.onRetry,
    required this.onBack,
    required this.onSupport,
    this.days,
    this.pending = false,
  });
  final String planTitle, amount, message;
  final int? days;
  final bool pending;
  final VoidCallback onRetry, onBack, onSupport;
  @override
  Widget build(BuildContext context) => SafeArea(
    top: false,
    child: ListView(
      key: const ValueKey('payment-recovery-scroll'),
      padding: const EdgeInsets.fromLTRB(22, 8, 22, 20),
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 13),
          decoration: BoxDecoration(
            color: AppColors.surfaceWarm,
            border: Border.all(color: AppColors.line),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.mint,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.eco_outlined,
                  color: AppColors.emeraldDeep,
                  size: 24,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  planTitle,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: AppColors.ink,
                  ),
                ),
              ),
              if (days != null) ...[
                const SizedBox(width: 10),
                Text(
                  '${fa(days!)} روزه',
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.inkSoft,
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 18),
        BrandScene(
          kind: pending
              ? BrandSceneKind.paymentPending
              : BrandSceneKind.paymentIssue,
          height: (MediaQuery.sizeOf(context).height * .2).clamp(135.0, 180.0),
        ),
        const SizedBox(height: 10),
        Semantics(
          header: true,
          liveRegion: true,
          child: Text(
            pending ? 'نتیجهٔ پرداخت هنوز مشخص نیست' : 'پرداخت کامل نشد',
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 25,
              height: 1.5,
              fontWeight: FontWeight.w800,
              color: AppColors.emeraldDark,
            ),
          ),
        ),
        const SizedBox(height: 9),
        Text(
          pending
              ? 'قبل از تلاش جدید، نتیجهٔ همین پرداخت را بررسی کن.'
              : 'پلن انتخابی‌ات حفظ شده؛ می‌توانی دوباره تلاش کنی.',
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 14,
            height: 1.8,
            color: AppColors.inkSoft,
          ),
        ),
        const SizedBox(height: 7),
        Text(
          message,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 12,
            color: AppColors.inkSoft,
            height: 1.7,
          ),
        ),
        const SizedBox(height: 18),
        Container(
          padding: const EdgeInsets.all(17),
          decoration: BoxDecoration(
            color: AppColors.surfaceWarm,
            border: Border.all(color: AppColors.line),
            borderRadius: BorderRadius.circular(18),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              LayoutBuilder(
                builder: (context, constraints) {
                  final label = const Text(
                    'مبلغ پرداخت',
                    style: TextStyle(fontSize: 13, color: AppColors.inkSoft),
                  );
                  final price = Text(
                    amount,
                    style: const TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                      color: AppColors.emeraldDark,
                    ),
                  );
                  return constraints.maxWidth < 290 ||
                          MediaQuery.textScalerOf(context).scale(14) > 18
                      ? Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [label, const SizedBox(height: 8), price],
                        )
                      : Row(
                          children: [
                            label,
                            const SizedBox(width: 12),
                            Expanded(
                              child: Align(
                                alignment: AlignmentDirectional.centerEnd,
                                child: price,
                              ),
                            ),
                          ],
                        );
                },
              ),
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 12),
                child: Divider(color: AppColors.line, height: 1),
              ),
              const Row(
                children: [
                  Icon(
                    Icons.lock_outline_rounded,
                    color: AppColors.emeraldDeep,
                    size: 17,
                  ),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'فعال‌سازی پس از تأیید پرداخت',
                      style: TextStyle(
                        fontSize: 12,
                        color: AppColors.inkSoft,
                        height: 1.7,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 22),
        Theme(
          data: Theme.of(context).copyWith(
            filledButtonTheme: FilledButtonThemeData(
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.emeraldDeep,
                foregroundColor: Colors.white,
                minimumSize: const Size.fromHeight(52),
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 14,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
            ),
          ),
          child: PrimaryButton(
            pending ? 'بررسی نتیجهٔ پرداخت' : 'تلاش دوباره برای پرداخت',
            onPressed: onRetry,
            icon: pending ? Icons.refresh_rounded : Icons.payment_rounded,
          ),
        ),
        const SizedBox(height: 6),
        TextButton(
          onPressed: onBack,
          child: const Text(
            'بازگشت به پلن‌ها',
            style: TextStyle(
              fontSize: 13,
              decoration: TextDecoration.underline,
              decorationColor: AppColors.emeraldDeep,
            ),
          ),
        ),
        const SizedBox(height: 10),
        TextButton.icon(
          onPressed: onSupport,
          icon: const Icon(Icons.headset_mic_outlined, size: 18),
          label: const Text(
            'نیاز به راهنمایی داری؟ با پشتیبانی صحبت کن',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 11, height: 1.6),
          ),
        ),
      ],
    ),
  );
}
