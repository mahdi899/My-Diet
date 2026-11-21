import 'package:flutter/material.dart';
import 'widgets/onboarding_icons.dart';
import '../../core/format/digits.dart';
import '../../core/motion/motion.dart';
import '../../core/theme/tokens.dart';
import '../../domain/onboarding/onboarding.dart';
import '../widgets/kit/kit.dart';
import 'widgets/bmi_gauge.dart';
import 'widgets/decor_photo.dart';
import 'widgets/plan_theater.dart';

/// Short building theater, then the numbers the server already computed.
/// The theater never gates [onContinue]; it only plays before the reveal.
class ProfileResultScreen extends StatefulWidget {
  const ProfileResultScreen({
    super.key,
    required this.profile,
    required this.onContinue,
  });
  final ProfileSummary profile;
  final VoidCallback onContinue;

  @override
  State<ProfileResultScreen> createState() => _ProfileResultScreenState();
}

class _ProfileResultScreenState extends State<ProfileResultScreen> {
  bool _ready = false;
  bool _done = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_ready) return;
    _ready = true;
    _done = Motion.reduced(context);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: DecoratedBox(
        decoration: const BoxDecoration(gradient: AppGradients.warmBackground),
        child: SafeArea(
          child: AnimatedSwitcher(
            duration: Motion.of(context, Motion.page),
            child: _done
                ? _Result(
                    key: const ValueKey('r'),
                    profile: widget.profile,
                    onContinue: widget.onContinue,
                  )
                : PlanBuildTheater(
                    key: const ValueKey('w'),
                    title: 'آماده‌سازی خلاصهٔ تو',
                    message:
                        'پاسخ‌ها ثبت شده‌اند؛ خلاصهٔ اطلاعات و هدف روزانه‌ات را ببین.',
                    onFinished: () {
                      Haptics.success();
                      if (mounted) setState(() => _done = true);
                    },
                  ),
          ),
        ),
      ),
    );
  }
}

/// Weeks to the target at about half a kilo a week. Null when there is no target.
int? planWeeks(ProfileSummary profile) {
  final target = profile.targetWeightKg;
  if (target == null) return null;
  final delta = (profile.weightKg - target).abs();
  if (delta < 0.25) return 4;
  return (delta / 0.5).ceil().clamp(4, 52);
}

class _Result extends StatelessWidget {
  const _Result({super.key, required this.profile, required this.onContinue});
  final ProfileSummary profile;
  final VoidCallback onContinue;

  static const _meals = ['صبحانه', 'ناهار', 'شام'];

  @override
  Widget build(BuildContext context) {
    final p = profile;
    final weeks = planWeeks(p);
    final ring = p.tdeeKcal <= 0
        ? 0.0
        : (p.targetKcal / p.tdeeKcal).clamp(0.0, 1.0);
    final weightDigits = (p.weightKg - p.weightKg.roundToDouble()).abs() < 0.05
        ? 0
        : 1;
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
            children: [
              SparkleBurst(
                autoPlay: true,
                child: Text(
                  'برنامه‌ات آماده است',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'این اعداد نقطهٔ شروع‌اند.',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.muted, height: 1.7),
              ),
              const SizedBox(height: 18),
              Center(
                child: Ring(
                  value: ring,
                  size: 148,
                  strokeWidth: 12,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Ticker(
                        value: p.targetKcal,
                        style: const TextStyle(
                          fontSize: 28,
                          fontWeight: FontWeight.w800,
                          color: AppColors.emeraldDeep,
                        ),
                      ),
                      const Text(
                        'کالری',
                        style: TextStyle(fontSize: 11, color: AppColors.muted),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  _Stat(
                    'وزن',
                    p.weightKg,
                    fraction: weightDigits,
                    suffix: ' کیلو',
                  ),
                  const SizedBox(width: 10),
                  if (weeks != null)
                    _Stat('هفته', weeks)
                  else
                    _Stat('شاخص', p.bmi, fraction: 1),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                '${bmiLabel(p.bmi)} · سوخت‌وساز ${fa(p.bmrKcal)} · مصرف ${fa(p.tdeeKcal)}',
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.muted, fontSize: 12),
              ),
              const SizedBox(height: 6),
              Text(
                'پروتئین ${fa(p.proteinG)} گرم · کربو ${fa(p.carbsG)} · چربی ${fa(p.fatG)}',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: AppColors.inkSoft,
                  fontSize: 12.5,
                ),
              ),
              const SizedBox(height: 18),
              SizedBox(
                height: 132,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  primary: false,
                  itemCount: _meals.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 10),
                  itemBuilder: (_, i) => _MealTile(_meals[i]),
                ),
              ),
              if (p.doctorOnly) ...[
                const SizedBox(height: 14),
                const AppCard.tinted(
                  child: Row(
                    children: [
                      OnboardingIcon(
                        Icons.medical_services_outlined,
                        color: AppColors.amber,
                      ),
                      SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'برنامه ساخته می‌شود. به‌خاطر شرایطی که گفتی، قبل از نمایش باید دکتر آن را تأیید کند.',
                          style: TextStyle(fontSize: 12.5, height: 1.7),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 16),
          child: PillButton(label: 'شروع کن', onPressed: onContinue),
        ),
      ],
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat(this.label, this.value, {this.fraction = 0, this.suffix = ''});
  final String label;
  final num value;
  final int fraction;
  final String suffix;

  @override
  Widget build(BuildContext context) => Expanded(
    child: AppCard(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 14),
      child: Column(
        children: [
          Ticker(
            value: value,
            fractionDigits: fraction,
            suffix: suffix,
            style: const TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: AppColors.emeraldDeep,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(color: AppColors.muted, fontSize: 12),
          ),
        ],
      ),
    ),
  );
}

class _MealTile extends StatelessWidget {
  const _MealTile(this.title);
  final String title;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: 168,
    child: ClipRRect(
      borderRadius: BorderRadius.circular(22),
      child: Stack(
        fit: StackFit.expand,
        children: [
          DecorPhoto(label: title, radius: 0),
          const DecoratedBox(
            decoration: BoxDecoration(gradient: AppGradients.photoScrim),
          ),
          Positioned(
            right: 12,
            left: 12,
            bottom: 10,
            child: Text(
              title,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w800,
                fontSize: 15,
              ),
            ),
          ),
        ],
      ),
    ),
  );
}
