import 'package:flutter/material.dart';
import '../../data/demo_store.dart';
import '../../data/streak_campaign.dart';
import '../../data/wallet_catalog.dart';
import '../widgets/ui.dart';

class PricingAdminScreen extends StatefulWidget {
  const PricingAdminScreen({super.key});
  @override
  State<PricingAdminScreen> createState() => _PricingAdminScreenState();
}

class _PricingAdminScreenState extends State<PricingAdminScreen> {
  final form = GlobalKey<FormState>();
  final campaignForm = GlobalKey<FormState>();
  final fields = List.generate(4, (_) => TextEditingController());
  final campaignDays = TextEditingController(text: '7');
  final milestoneDay = TextEditingController(text: '3');
  final milestoneAmount = TextEditingController(text: '0');
  final campaignStart = TextEditingController(text: '2026-10-24');
  final campaignEnd = TextEditingController();
  String repeat = 'cycle';
  bool initialized = false, saving = false, savingCampaign = false;
  @override
  void dispose() {
    for (final f in [
      ...fields,
      campaignDays,
      milestoneDay,
      milestoneAmount,
      campaignStart,
      campaignEnd,
    ]) {
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
      'مبلغ پاداش روز پایانی / تومان',
    ];
    return Scaffold(
      appBar: AppBar(title: const Text('قیمت‌ها و جایزه')),
      body: PageBody(
        children: [
          const Notice(
            'تغییر مبلغ‌ها در رابط نمایشی روی همین دستگاه ذخیره می‌شود. جایزه‌ای که قبلاً تأیید شده تغییر نمی‌کند. کاربری که دوره‌اش را شروع کرده، تا پایان همان دوره روی نسخهٔ قبلی می‌ماند.',
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
          const SizedBox(height: 12),
          const Heading('کمپین روزهای پیاپی'),
          const Text(
            'روز فقط با ثبت همهٔ وعده‌ها واجد شرایط می‌شود. ورود به برنامه روز را کامل نمی‌کند. این فرم نمونه است و مسیر زندهٔ سرور برای کمپین هنوز وجود ندارد.',
          ),
          Form(
            key: campaignForm,
            child: Column(
              children: [
                TextFormField(
                  key: const ValueKey('streak-days'),
                  controller: campaignDays,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'تعداد روزهای پیاپی',
                  ),
                  validator: (value) {
                    final n = int.tryParse(value ?? '');
                    return n == null || n < 1 || n > 30 ? 'از ۱ تا ۳۰.' : null;
                  },
                ),
                TextFormField(
                  key: const ValueKey('streak-milestone-day'),
                  controller: milestoneDay,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'روز مایل‌ستون میانی',
                  ),
                ),
                TextFormField(
                  key: const ValueKey('streak-milestone-amount'),
                  controller: milestoneAmount,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'مبلغ مایل‌ستون میانی / تومان',
                  ),
                ),
                TextFormField(
                  key: const ValueKey('streak-start'),
                  controller: campaignStart,
                  decoration: const InputDecoration(
                    labelText: 'تاریخ شروع دوره',
                  ),
                  validator: (value) => DateTime.tryParse(value ?? '') == null
                      ? 'تاریخ را مثل 2026-10-24 وارد کن.'
                      : null,
                ),
                TextFormField(
                  controller: campaignEnd,
                  decoration: const InputDecoration(
                    labelText: 'تاریخ پایان (اختیاری)',
                  ),
                  validator: (value) =>
                      (value ?? '').trim().isEmpty ||
                          DateTime.tryParse(value!.trim()) != null
                      ? null
                      : 'تاریخ پایان نامعتبر است.',
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  initialValue: repeat,
                  decoration: const InputDecoration(labelText: 'تکرار'),
                  items: const [
                    DropdownMenuItem(value: 'cycle', child: Text('هر دوره از نو')),
                    DropdownMenuItem(value: 'none', child: Text('فقط یک دوره')),
                  ],
                  onChanged: (value) => setState(() => repeat = value ?? 'cycle'),
                ),
                const SizedBox(height: 8),
                const Text(
                  'اگر تنظیم عوض شود، کسی که دوره را شروع کرده همان نسخه را تا پایان دوره تمام می‌کند.',
                ),
                const SizedBox(height: 8),
                PrimaryButton(
                  savingCampaign ? 'در حال ذخیره…' : 'انتشار نسخهٔ کمپین',
                  onPressed: savingCampaign
                      ? null
                      : () {
                          if (!campaignForm.currentState!.validate()) return;
                          final days = int.parse(campaignDays.text);
                          final midDay = int.tryParse(milestoneDay.text);
                          final midAmount = int.tryParse(
                            latinDigits(
                              milestoneAmount.text,
                            ).replaceAll(',', '').replaceAll('٬', ''),
                          );
                          final milestones = <StreakMilestone>[
                            if (midDay != null &&
                                midAmount != null &&
                                midAmount > 0 &&
                                midDay < days)
                              StreakMilestone(
                                day: midDay,
                                amountToman: midAmount,
                              ),
                            StreakMilestone(
                              day: days,
                              amountToman: s.weeklyRewardToman,
                            ),
                          ];
                          setState(() => savingCampaign = true);
                          try {
                            s.publishStreakCampaign(
                              consecutiveDays: days,
                              milestones: milestones,
                              effectiveOn: DateTime.parse(campaignStart.text),
                              endsOn: campaignEnd.text.trim().isEmpty
                                  ? null
                                  : DateTime.parse(campaignEnd.text.trim()),
                              repeat: repeat,
                            );
                            showToast(context, 'نسخهٔ جدید کمپین منتشر شد.');
                          } catch (_) {
                            showToast(context, 'کمپین ذخیره نشد؛ مقدارها را بررسی کن.');
                          } finally {
                            if (mounted) setState(() => savingCampaign = false);
                          }
                        },
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
