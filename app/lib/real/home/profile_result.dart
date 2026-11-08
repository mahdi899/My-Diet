import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../theme.dart';
import '../core/digits.dart';
import '../core/motion.dart';
import '../onboarding/repository.dart';
import '../onboarding/widgets/bmi_gauge.dart';

/// "We are working out your numbers": a short, honest sequence (these are the real computed
/// values), then the result. Runs once, right after the questionnaire is saved.
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

class _ProfileResultScreenState extends State<ProfileResultScreen>
    with SingleTickerProviderStateMixin {
  static const _labels = [
    'محاسبهٔ شاخص توده بدنی',
    'برآورد سوخت‌وساز پایه',
    'تعیین نیاز انرژی روزانه',
    'تنظیم سهم پروتئین، کربو و چربی',
    'بررسی ایمنی با شرایط تو',
  ];
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 4200),
  )..forward();
  int _ticked = 0;

  @override
  void initState() {
    super.initState();
    _c.addListener(() {
      final n = (_c.value * _labels.length * 1.0).floor().clamp(
        0,
        _labels.length,
      );
      if (n != _ticked) {
        _ticked = n;
        Haptics.tap();
      }
      // Rebuild every frame so the ring moves smoothly.
      setState(() {});
    });
    _c.addStatusListener((s) {
      if (s != AnimationStatus.completed) return;
      Haptics.success();
      // The status flips to "completed" after the last value notification, so without this
      // rebuild the screen stays on the 100% progress view forever.
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.profile;
    final done = _c.isCompleted;
    return Scaffold(
      body: SafeArea(
        child: AnimatedSwitcher(
          duration: Motion.page,
          child: done
              ? _Result(
                  key: const ValueKey('r'),
                  profile: p,
                  onContinue: widget.onContinue,
                )
              : _Working(
                  key: const ValueKey('w'),
                  ticked: _ticked,
                  value: _c.value,
                ),
        ),
      ),
    );
  }
}

class _Working extends StatelessWidget {
  const _Working({super.key, required this.ticked, required this.value});
  final int ticked;
  final double value;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(28),
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        SizedBox(
          width: 130,
          height: 130,
          child: Stack(
            alignment: Alignment.center,
            children: [
              SizedBox.expand(
                child: CircularProgressIndicator(
                  value: value,
                  strokeWidth: 8,
                  backgroundColor: const Color(0xFFDDE7CF),
                  strokeCap: StrokeCap.round,
                ),
              ),
              Text(
                '${fa((value * 100).round())}٪',
                style: const TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.bold,
                  color: pine,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 30),
        Text(
          'در حال تحلیل پاسخ‌هات…',
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 18),
        for (var i = 0; i < _ProfileResultScreenState._labels.length; i++)
          AnimatedOpacity(
            duration: Motion.base,
            opacity: i <= ticked ? 1 : 0.25,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 5),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  AnimatedSwitcher(
                    duration: Motion.quick,
                    child: Icon(
                      i < ticked ? Icons.check_circle : Icons.circle_outlined,
                      key: ValueKey(i < ticked),
                      size: 18,
                      color: i < ticked ? pine : muted,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    _ProfileResultScreenState._labels[i],
                    style: const TextStyle(fontSize: 13),
                  ),
                ],
              ),
            ),
          ),
      ],
    ),
  );
}

class _Result extends StatelessWidget {
  const _Result({super.key, required this.profile, required this.onContinue});
  final ProfileSummary profile;
  final VoidCallback onContinue;

  @override
  Widget build(BuildContext context) {
    final p = profile;
    final total = (p.proteinG * 4 + p.carbsG * 4 + p.fatG * 9).toDouble();
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(24, 20, 24, 12),
            children: [
              Reveal(
                child: Text(
                  'تحلیل بدن تو آماده شد',
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
              ),
              const SizedBox(height: 4),
              const Reveal(
                index: 1,
                child: Text(
                  'این اعداد نقطهٔ شروع دکتر هستند؛ برنامهٔ نهایی بعد از بررسی دکتر ساخته می‌شه.',
                  style: TextStyle(color: muted, height: 1.9),
                ),
              ),
              const SizedBox(height: 22),
              Reveal(
                index: 2,
                child: Center(child: BmiGauge(bmi: p.bmi)),
              ),
              const SizedBox(height: 22),
              Reveal(
                index: 3,
                child: _Card(
                  child: Row(
                    children: [
                      _MacroRing(
                        protein: p.proteinG * 4 / total,
                        carbs: p.carbsG * 4 / total,
                        fat: p.fatG * 9 / total,
                        kcal: p.targetKcal,
                      ),
                      const SizedBox(width: 18),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'هدف انرژی روزانه',
                              style: TextStyle(color: muted, fontSize: 12),
                            ),
                            const SizedBox(height: 8),
                            _Legend(
                              const Color(0xFFD9694B),
                              'پروتئین',
                              p.proteinG,
                            ),
                            _Legend(
                              const Color(0xFFE0A93B),
                              'کربوهیدرات',
                              p.carbsG,
                            ),
                            _Legend(const Color(0xFF6FA8DC), 'چربی', p.fatG),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 14),
              Reveal(
                index: 4,
                child: Row(
                  children: [
                    Expanded(
                      child: _Mini(
                        'سوخت‌وساز پایه',
                        '${fa(p.bmrKcal)} کیلوکالری',
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _Mini(
                        'مصرف روزانه',
                        '${fa(p.tdeeKcal)} کیلوکالری',
                      ),
                    ),
                  ],
                ),
              ),
              if (p.doctorOnly) ...[
                const SizedBox(height: 14),
                Reveal(
                  index: 5,
                  child: _Card(
                    tint: const Color(0xFFFFF1D6),
                    child: const Row(
                      children: [
                        Icon(Icons.medical_services_outlined, color: amber),
                        SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'شرایط تو نیازمند دقت بیشتره؛ برنامه‌ات رو دکتر خودش با دقت می‌نویسه.',
                            style: TextStyle(fontSize: 12, height: 1.8),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 16),
          child: SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: onContinue,
              child: const Text('ادامه و دریافت برنامه'),
            ),
          ),
        ),
      ],
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.child, this.tint = Colors.white});
  final Widget child;
  final Color tint;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: tint,
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: const Color(0xFFDDE5D4)),
    ),
    child: child,
  );
}

class _Mini extends StatelessWidget {
  const _Mini(this.label, this.value);
  final String label, value;
  @override
  Widget build(BuildContext context) => _Card(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: muted, fontSize: 11)),
        const SizedBox(height: 4),
        Text(value, style: const TextStyle(fontWeight: FontWeight.bold)),
      ],
    ),
  );
}

class _Legend extends StatelessWidget {
  const _Legend(this.color, this.label, this.grams);
  final Color color;
  final String label;
  final int grams;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 3),
    child: Row(
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 8),
        Expanded(child: Text(label, style: const TextStyle(fontSize: 13))),
        Text(
          '${fa(grams)} گرم',
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
      ],
    ),
  );
}

class _MacroRing extends StatelessWidget {
  const _MacroRing({
    required this.protein,
    required this.carbs,
    required this.fat,
    required this.kcal,
  });
  final double protein, carbs, fat;
  final int kcal;

  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
    tween: Tween(begin: 0, end: 1),
    duration: Motion.slow * 2,
    curve: Motion.curve,
    builder: (context, t, _) => SizedBox(
      width: 112,
      height: 112,
      child: Stack(
        alignment: Alignment.center,
        children: [
          CustomPaint(
            size: const Size.square(112),
            painter: _MacroPainter(protein * t, carbs * t, fat * t),
          ),
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                fa((kcal * t).round()),
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: pine,
                ),
              ),
              const Text(
                'کیلوکالری',
                style: TextStyle(fontSize: 10, color: muted),
              ),
            ],
          ),
        ],
      ),
    ),
  );
}

class _MacroPainter extends CustomPainter {
  _MacroPainter(this.p, this.c, this.f);
  final double p, c, f;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = (Offset.zero & size).deflate(8);
    var start = -math.pi / 2;
    void arc(double share, Color color) {
      final sweep = share * 2 * math.pi;
      canvas.drawArc(
        rect,
        start + 0.03,
        math.max(0, sweep - 0.06),
        false,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 11
          ..strokeCap = StrokeCap.round
          ..color = color,
      );
      start += sweep;
    }

    arc(p, const Color(0xFFD9694B));
    arc(c, const Color(0xFFE0A93B));
    arc(f, const Color(0xFF6FA8DC));
  }

  @override
  bool shouldRepaint(_MacroPainter old) =>
      old.p != p || old.c != c || old.f != f;
}
