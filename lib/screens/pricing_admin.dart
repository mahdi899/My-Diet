import 'package:flutter/material.dart';
import '../data/demo_store.dart';
import '../data/wallet_catalog.dart';
import '../widgets/ui.dart';

class PricingAdminScreen extends StatefulWidget {
  const PricingAdminScreen({super.key});
  @override
  State<PricingAdminScreen> createState() => _PricingAdminScreenState();
}

class _PricingAdminScreenState extends State<PricingAdminScreen> {
  final form = GlobalKey<FormState>();
  final fields = List.generate(4, (_) => TextEditingController());
  bool initialized = false, saving = false;
  @override
  void dispose() {
    for (final f in fields) {
      f.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = DemoScope.of(context);
    if (!initialized) {
      final values = [
        s.newPlanPrice,
        s.aiRevisionPrice,
        s.expertRevisionPrice,
        s.weeklyRewardToman,
      ];
      for (var i = 0; i < 4; i++) {
        fields[i].text = formatMoneyNumber(values[i]);
      }
      initialized = true;
    }
    const labels = [
      'قیمت برنامه غذایی / تومان',
      'اصلاح با هوش مصنوعی / تومان',
      'اصلاح توسط پزشک / تومان',
      'جایزهٔ تکمیل هفته / تومان',
    ];
    return Scaffold(
      appBar: AppBar(title: const Text('قیمت‌ها و جایزه')),
      body: PageBody(
        children: [
          const Notice(
            'تغییر مبلغ‌ها در رابط نمایشی روی همین دستگاه ذخیره می‌شود. جایزه‌های قبلی تغییر نمی‌کنند.',
          ),
          Form(
            key: form,
            child: Column(
              children: [
                for (var i = 0; i < 4; i++)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 18),
                    child: TextFormField(
                      key: ValueKey('pricing-$i'),
                      controller: fields[i],
                      keyboardType: TextInputType.number,
                      decoration: InputDecoration(labelText: labels[i]),
                      validator: (v) {
                        final n = int.tryParse(
                          latinDigits(
                            v ?? '',
                          ).replaceAll(',', '').replaceAll('٬', ''),
                        );
                        return n == null ||
                                n < (i == 3 ? 0 : 1) ||
                                n > 100000000
                            ? 'مبلغ معتبر وارد کن.'
                            : null;
                      },
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: PrimaryButton(
            saving ? 'در حال ذخیره…' : 'ذخیره و اعمال',
            onPressed: saving
                ? null
                : () async {
                    if (!form.currentState!.validate()) return;
                    setState(() => saving = true);
                    final v = fields
                        .map(
                          (f) => int.parse(
                            latinDigits(
                              f.text,
                            ).replaceAll(',', '').replaceAll('٬', ''),
                          ),
                        )
                        .toList();
                    try {
                      await s.savePricing(
                        plan: v[0],
                        ai: v[1],
                        expert: v[2],
                        reward: v[3],
                      );
                      if (context.mounted) {
                        showToast(context, 'قیمت‌ها و جایزه به‌روز شدند.');
                        Navigator.pop(context);
                      }
                    } catch (_) {
                      if (context.mounted) {
                        showToast(context, 'ذخیره نشد؛ دوباره تلاش کن.');
                      }
                    } finally {
                      if (mounted) setState(() => saving = false);
                    }
                  },
            icon: Icons.check,
          ),
        ),
      ),
    );
  }
}
