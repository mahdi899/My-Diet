import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/format/digits.dart';
import '../../core/motion/motion.dart';
import '../../core/photos/food_image.dart';
import '../../core/theme/theme.dart';
import '../../data/customer_auth.dart';
import '../../data/demo_store.dart' show latinDigits;
/// Website order after the questionnaire: analysis, specialist, plan, then phone.
class AfterAnswersFlow extends StatefulWidget {
  const AfterAnswersFlow({
    super.key,
    required this.onExit,
    required this.requestCode,
    required this.verifyCode,
    required this.onVerified,
    this.initialPhone,
    this.initialStage = 'analysis',
    this.initialSpecialistId,
    this.initialPlanId,
    this.initialOfferedIds = const [],
    this.onProgress,
    this.age,
    this.height,
    this.weight,
    this.goal,
  });

  final VoidCallback onExit;
  final String? initialPhone;
  final Future<void> Function(String phone) requestCode;
  final Future<void> Function(String phone, String code) verifyCode;
  final Future<bool> Function() onVerified;
  final String initialStage;
  final String? initialSpecialistId;
  final String? initialPlanId;
  final List<String> initialOfferedIds;
  final String? age;
  final String? height;
  final String? weight;
  final String? goal;
  final void Function({
    required String stage,
    required List<String> offeredIds,
    String? specialistId,
    String? planId,
  })?
  onProgress;

  @override
  State<AfterAnswersFlow> createState() => _AfterAnswersFlowState();
}

enum _Stage { analysis, specialists, plans, phone }

class _AfterAnswersFlowState extends State<AfterAnswersFlow> {
  late _Stage _stage = _stageOf(widget.initialStage);
  late final List<_Specialist> _offered = _offeredFrom(widget.initialOfferedIds);
  late String? _specialistId = widget.initialSpecialistId;
  late String _planId = widget.initialPlanId ?? 'monthly';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _report());
  }

  List<String> get _offeredIds => [for (final person in _offered) person.id];

  void _report() {
    widget.onProgress?.call(
      stage: _stage.name,
      offeredIds: _offeredIds,
      specialistId: _specialistId,
      planId: _planId,
    );
  }

  void _go(_Stage stage) {
    if (!mounted) return;
    setState(() => _stage = stage);
    _report();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope<void>(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        switch (_stage) {
          case _Stage.analysis:
            widget.onExit();
          case _Stage.specialists:
            widget.onExit();
          case _Stage.plans:
            _go(_Stage.specialists);
          case _Stage.phone:
            _go(_Stage.plans);
        }
      },
      child: AnimatedSwitcher(
        duration: const Duration(milliseconds: 480),
        switchInCurve: Curves.easeOutCubic,
        switchOutCurve: Curves.easeIn,
        child: switch (_stage) {
          _Stage.analysis => _AnalysisScreen(
            key: const ValueKey('analysis'),
            age: widget.age,
            height: widget.height,
            weight: widget.weight,
            goal: widget.goal,
            onDone: () => _go(_Stage.specialists),
          ),
          _Stage.specialists => _SpecialistsScreen(
            key: const ValueKey('specialists'),
            people: _offered,
            selectedId: _specialistId,
            onSelect: (id) {
              setState(() => _specialistId = id);
              _report();
            },
            onContinue: () => _go(_Stage.plans),
          ),
          _Stage.plans => _PlansScreen(
            key: const ValueKey('plans'),
            doctor: _offered
                .firstWhere((p) => p.id == _specialistId)
                .name,
            planId: _planId,
            onSelect: (id) {
              setState(() => _planId = id);
              _report();
            },
            onBuy: () => _go(_Stage.phone),
          ),
          _Stage.phone => _PhoneScreen(
            key: const ValueKey('phone'),
            initialPhone: widget.initialPhone,
            planTitle: _plans.firstWhere((p) => p.id == _planId).title,
            requestCode: widget.requestCode,
            verifyCode: widget.verifyCode,
            onVerified: widget.onVerified,
          ),
        },
      ),
    );
  }
}

class _AnalysisScreen extends StatefulWidget {
  const _AnalysisScreen({
    super.key,
    required this.onDone,
    this.age,
    this.height,
    this.weight,
    this.goal,
  });

  final VoidCallback onDone;
  final String? age;
  final String? height;
  final String? weight;
  final String? goal;

  @override
  State<_AnalysisScreen> createState() => _AnalysisScreenState();
}

class _AnalysisScreenState extends State<_AnalysisScreen>
    with TickerProviderStateMixin {
  static const _stages = [
    'پاسخ‌هات رو می‌خونه',
    'انرژی روزانه‌ات رو حساب می‌کنه',
    'عادت‌های غذاییت رو می‌بینه',
    'متخصص مناسب رو پیدا می‌کنه',
    'پیشنهادت رو جمع می‌کنه',
  ];

  late final AnimationController _scan = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2200),
  );
  late final AnimationController _progress = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 9),
  );

  @override
  void initState() {
    super.initState();
    _progress.addStatusListener((status) {
      if (status == AnimationStatus.completed && mounted) widget.onDone();
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (Motion.reduced(context)) {
        widget.onDone();
        return;
      }
      _scan.repeat(reverse: true);
      _progress.forward();
    });
  }

  @override
  void dispose() {
    _scan.dispose();
    _progress.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return _DarkShell(
      child: AnimatedBuilder(
        animation: _progress,
        builder: (context, _) {
          final eased = Curves.easeInOutSine.transform(_progress.value);
          final percent = (eased * 100).round();
          final stage = _stages[math.min(
            _stages.length - 1,
            (_progress.value * _stages.length).floor(),
          )];
          return Column(
            children: [
              const SizedBox(height: 28),
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 360),
                child: Text(
                  stage,
                  key: ValueKey(stage),
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 8),
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      _ScanFigure(scan: _scan),
                      Positioned(
                        top: 4,
                        right: 0,
                        child: _MetricTile(
                          label: 'سن',
                          value: widget.age,
                          revealed: _progress.value > 0.12,
                        ),
                      ),
                      Positioned(
                        top: 4,
                        left: 0,
                        child: _MetricTile(
                          label: 'قد',
                          value: widget.height,
                          revealed: _progress.value > 0.28,
                        ),
                      ),
                      Positioned(
                        bottom: 4,
                        right: 0,
                        child: _MetricTile(
                          label: 'وزن',
                          value: widget.weight,
                          revealed: _progress.value > 0.44,
                        ),
                      ),
                      Positioned(
                        bottom: 4,
                        left: 0,
                        child: _MetricTile(
                          label: 'هدف',
                          value: widget.goal,
                          revealed: _progress.value > 0.6,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              Text(
                '${fa(percent)}٪',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 32,
                  fontWeight: FontWeight.w800,
                  height: 1.1,
                ),
              ),
              const SizedBox(height: 10),
              SizedBox(
                width: 160,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(99),
                  child: LinearProgressIndicator(
                    value: eased,
                    minHeight: 3,
                    backgroundColor: const Color(0xFF1E4A3A),
                    color: const Color(0xFFD2F06A),
                  ),
                ),
              ),
              const SizedBox(height: 22),
            ],
          );
        },
      ),
    );
  }
}

class _MetricTile extends StatelessWidget {
  const _MetricTile({
    required this.label,
    required this.value,
    required this.revealed,
  });

  final String label;
  final String? value;
  final bool revealed;

  @override
  Widget build(BuildContext context) {
    final on = revealed && value != null && value!.isNotEmpty;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 320),
      curve: Curves.easeOutCubic,
      width: 88,
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 6),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        color: on ? const Color(0xFFD2F06A) : const Color(0x14FFFFFF),
        border: Border.all(
          color: on ? const Color(0xFFD2F06A) : const Color(0x33FFFFFF),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: on ? const Color(0xFF143528) : const Color(0xFFD5E7DC),
              fontSize: 11,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            on ? value! : '—',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: on ? const Color(0xFF143528) : const Color(0xFF9BB5A8),
              fontWeight: FontWeight.w800,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }
}

class _ScanFigure extends StatelessWidget {
  const _ScanFigure({required this.scan});

  final AnimationController scan;
  static const _asset = 'assets/images/analysis/scan_hologram.png';

  @override
  Widget build(BuildContext context) {
    Widget figure({Color? tint, double opacity = 1}) {
      return Opacity(
        opacity: opacity,
        child: Image.asset(
          _asset,
          fit: BoxFit.contain,
          gaplessPlayback: true,
          color: tint,
          colorBlendMode: tint == null ? null : BlendMode.srcATop,
        ),
      );
    }

    return Stack(
      alignment: Alignment.center,
      fit: StackFit.expand,
      children: [
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: RadialGradient(
              colors: [Color(0x3824A87A), Color(0x00000000)],
              radius: 0.75,
            ),
          ),
        ),
        figure(opacity: 0.62),
        AnimatedBuilder(
          animation: scan,
          builder: (context, _) {
            final y = Curves.easeInOut.transform(scan.value);
            Widget band(double trail, double lead, Widget child) {
              return ShaderMask(
                blendMode: BlendMode.dstIn,
                shaderCallback: (rect) => LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: const [
                    Color(0x00FFFFFF),
                    Color(0xFFFFFFFF),
                    Color(0x00FFFFFF),
                  ],
                  stops: [
                    (y - trail).clamp(0.0, 1.0),
                    y.clamp(0.0, 1.0),
                    (y + lead).clamp(0.0, 1.0),
                  ],
                ).createShader(rect),
                child: child,
              );
            }

            return Stack(
              fit: StackFit.expand,
              children: [
                band(0.22, 0.01, figure()),
                band(0.05, 0.012, figure(tint: const Color(0xFFD2F06A))),
              ],
            );
          },
        ),
      ],
    );
  }
}

class _SpecialistsScreen extends StatefulWidget {
  const _SpecialistsScreen({
    super.key,
    required this.people,
    required this.selectedId,
    required this.onSelect,
    required this.onContinue,
  });

  final List<_Specialist> people;
  final String? selectedId;
  final ValueChanged<String> onSelect;
  final VoidCallback onContinue;

  @override
  State<_SpecialistsScreen> createState() => _SpecialistsScreenState();
}

class _SpecialistsScreenState extends State<_SpecialistsScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _count = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  );

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (Motion.reduced(context)) {
        _count.value = 1;
      } else {
        _count.forward();
      }
    });
  }

  @override
  void dispose() {
    _count.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return _DarkShell(
      child: Column(
        children: [
          const SizedBox(height: 36),
          AnimatedBuilder(
            animation: _count,
            builder: (context, _) {
              final eased = Curves.easeOutCubic.transform(_count.value);
              final n = (1500 + (1623 - 1500) * eased).round();
              return Text(
                money(n).replaceAll(',', '٬'),
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Color(0xFFE8F2D9),
                  fontSize: 76,
                  fontWeight: FontWeight.w900,
                  height: 1.05,
                  letterSpacing: -1.5,
                ),
              );
            },
          ),
          const SizedBox(height: 14),
          const Text(
            'نفری هستی که عضو\nجامعه رژیم من میشی',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Color(0xFFE0E9D8),
              fontSize: 18,
              height: 1.85,
              fontWeight: FontWeight.w400,
            ),
          ),
          const SizedBox(height: 22),
          Container(
            width: 140,
            height: 1,
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0x00D9E7C7), Color(0x66D9E7C7), Color(0x00D9E7C7)],
              ),
            ),
          ),
          const SizedBox(height: 22),
          const Text(
            '۲ پروفایل نمونهٔ تغذیه',
            style: TextStyle(
              color: Color(0xFFE0E9D8),
              fontSize: 15,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 16),
          for (final person in widget.people) ...[
            _SpecialistCard(
              person: person,
              selected: widget.selectedId == person.id,
              onTap: () => widget.onSelect(person.id),
            ),
            const SizedBox(height: 12),
          ],
          const Spacer(),
          _WhiteContinue(
            enabled: widget.selectedId != null,
            onPressed: widget.onContinue,
          ),
        ],
      ),
    );
  }
}

class _PlansScreen extends StatelessWidget {
  const _PlansScreen({
    super.key,
    required this.doctor,
    required this.planId,
    required this.onSelect,
    required this.onBuy,
  });

  final String doctor;
  final String planId;
  final ValueChanged<String> onSelect;
  final VoidCallback onBuy;

  @override
  Widget build(BuildContext context) {
    final selected = _plans.firstWhere((p) => p.id == planId);
    return _LightShell(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Align(
            alignment: Alignment.centerRight,
            child: Text(
              'انتخاب نوع برنامه',
              style: TextStyle(
                color: Color(0xFF4B6451),
                fontSize: 13,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(height: 22),
          const Text(
            'یک قدم تا شروع مسیرت',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Color(0xFF173E2B),
              fontSize: 28,
              fontWeight: FontWeight.w800,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'جزئیات هر پلن را ببین و همان را بخر.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Color(0xFF6D7F72), height: 1.7),
          ),
          const SizedBox(height: 18),
          Expanded(
            child: ListView(
              children: [
                for (final plan in _plans)
                  _PlanCard(
                    plan: plan,
                    doctor: doctor,
                    open: plan.id == planId,
                    onTap: () => onSelect(plan.id),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF17472F),
              foregroundColor: Colors.white,
              minimumSize: const Size.fromHeight(52),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
            ),
            onPressed: onBuy,
            child: Text(
              'خرید پلن ${selected.title}',
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
            ),
          ),
        ],
      ),
    );
  }
}

class _PhoneScreen extends StatefulWidget {
  const _PhoneScreen({
    super.key,
    required this.planTitle,
    required this.requestCode,
    required this.verifyCode,
    required this.onVerified,
    this.initialPhone,
  });

  final String planTitle;
  final String? initialPhone;
  final Future<void> Function(String phone) requestCode;
  final Future<void> Function(String phone, String code) verifyCode;
  final Future<bool> Function() onVerified;

  @override
  State<_PhoneScreen> createState() => _PhoneScreenState();
}

class _PhoneScreenState extends State<_PhoneScreen> {
  late final TextEditingController _phone = TextEditingController(
    text: widget.initialPhone ?? '',
  );
  final _code = TextEditingController();
  bool _otp = false;
  bool _pay = false;
  bool _success = false;
  bool _busy = false;
  String? _error;
  int _shake = 0;

  @override
  void dispose() {
    _phone.dispose();
    _code.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final phone = latinDigits(_phone.text).trim();
    if (!RegExp(r'^09\d{9}$').hasMatch(phone)) {
      setState(() => _error = 'یک شمارهٔ ۱۱ رقمی که با ۰۹ شروع شود وارد کن.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.requestCode(phone);
      if (!mounted) return;
      setState(() {
        _otp = true;
        _code.clear();
        _error = null;
        _busy = false;
      });
    } on AuthFailure catch (failure) {
      if (mounted) {
        setState(() {
          _error = failure.message;
          _busy = false;
        });
      }
    }
  }

  Future<void> _verify() async {
    final code = latinDigits(_code.text).trim();
    if (!RegExp(r'^\d{6}$').hasMatch(code)) {
      setState(() => _error = 'کد شش‌رقمی پیامک‌شده را وارد کن.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.verifyCode(latinDigits(_phone.text).trim(), code);
      if (!mounted) return;
      setState(() {
        _success = true;
        _busy = false;
      });
      await Future<void>.delayed(const Duration(milliseconds: 700));
      if (mounted) {
        setState(() {
          _pay = true;
          _success = false;
        });
      }
    } on AuthFailure catch (failure) {
      if (mounted) {
        setState(() {
          _error = failure.message;
          _shake += 1;
          _busy = false;
        });
      }
    }
  }

  Future<void> _payLocal() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final ok = await widget.onVerified();
    if (!ok && mounted) {
      setState(() {
        _busy = false;
        _error = 'ورود انجام نشد. دوباره تلاش کن.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final plan = _plans.firstWhere((item) => item.title == widget.planTitle);
    return _LightShell(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Spacer(),
          Text(
            _pay
                ? 'پرداخت'
                : _otp
                ? 'کد تأیید'
                : 'شمارهٔ موبایل',
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Color(0xFF173E2B),
              fontSize: 28,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            _pay
                ? 'در حالت محلی، با زدن پرداخت وارد اپ می‌شوی.'
                : _otp
                ? 'کد پیامک‌شده را وارد کن. در محلی، ۱۲۳۴۵۶ قبول است.'
                : 'برای ساخت حساب، شماره را تأیید کن.',
            textAlign: TextAlign.center,
            style: const TextStyle(color: Color(0xFF6D7F72), height: 1.7),
          ),
          const SizedBox(height: 28),
          if (_pay) ...[
            Text(
              plan.price,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Color(0xFF173E2B),
                fontSize: 36,
                fontWeight: FontWeight.w800,
              ),
            ),
            Text(
              'تومان · پلن ${widget.planTitle}',
              textAlign: TextAlign.center,
              style: const TextStyle(color: Color(0xFF6D7F72)),
            ),
          ] else if (_otp)
            _OtpCells(
              code: _code.text,
              shake: _shake,
              success: _success,
              onChanged: (value) {
                setState(() {
                  _code.text = value;
                  _error = null;
                });
                if (value.length == 6 && !_busy && !_success) _verify();
              },
            )
          else
            TextField(
              controller: _phone,
              enabled: !_busy,
              keyboardType: TextInputType.phone,
              textDirection: TextDirection.ltr,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w700,
                color: AppColors.ink,
              ),
              inputFormatters: [LengthLimitingTextInputFormatter(11)],
              decoration: const InputDecoration(
                hintText: '۰۹۱۲۳۴۵۶۷۸۹',
                filled: true,
                fillColor: Colors.white,
              ),
              onSubmitted: (_) => _send(),
            ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(
              _error!,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Color(0xFFB42318), height: 1.6),
            ),
          ],
          const SizedBox(height: 16),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF17472F),
              foregroundColor: Colors.white,
              minimumSize: const Size.fromHeight(52),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
            ),
            onPressed: _busy || (_success && !_pay)
                ? null
                : (_pay ? _payLocal : (_otp ? _verify : _send)),
            child: Text(
              _busy
                  ? 'در حال بررسی…'
                  : _pay
                  ? 'پرداخت'
                  : _otp
                  ? 'تأیید و ادامه'
                  : 'دریافت کد',
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
            ),
          ),
          if (_otp && !_pay)
            TextButton(
              onPressed: _busy ? null : _send,
              child: const Text(
                'ارسال دوبارهٔ کد',
                style: TextStyle(color: Color(0xFF17472F)),
              ),
            ),
          const Spacer(),
        ],
      ),
    );
  }
}

class _OtpCells extends StatefulWidget {
  const _OtpCells({
    required this.code,
    required this.shake,
    required this.success,
    required this.onChanged,
  });

  final String code;
  final int shake;
  final bool success;
  final ValueChanged<String> onChanged;

  @override
  State<_OtpCells> createState() => _OtpCellsState();
}

class _OtpCellsState extends State<_OtpCells>
    with SingleTickerProviderStateMixin {
  late final TextEditingController _hidden = TextEditingController(
    text: widget.code,
  );
  late final FocusNode _focus = FocusNode();
  late final AnimationController _shakeCtrl = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 420),
  );

  @override
  void didUpdateWidget(_OtpCells oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.code != _hidden.text) _hidden.text = widget.code;
    if (widget.shake != oldWidget.shake) _shakeCtrl.forward(from: 0);
  }

  @override
  void dispose() {
    _hidden.dispose();
    _focus.dispose();
    _shakeCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final active = widget.code.length.clamp(0, 5);
    return GestureDetector(
      onTap: _focus.requestFocus,
      child: AnimatedBuilder(
        animation: _shakeCtrl,
        builder: (context, child) {
          final t = _shakeCtrl.value;
          final dx = t == 0 ? 0.0 : math.sin(t * math.pi * 6) * 8 * (1 - t);
          return Transform.translate(offset: Offset(dx, 0), child: child);
        },
        child: SizedBox(
          height: widget.success ? 84 : 64,
          child: Stack(
            alignment: Alignment.center,
            children: [
              AnimatedOpacity(
                opacity: widget.success ? 0 : 1,
                duration: const Duration(milliseconds: 280),
                child: AnimatedScale(
                  scale: widget.success ? 0.6 : 1,
                  duration: const Duration(milliseconds: 420),
                  curve: Curves.easeInCubic,
                  child: Row(
                    textDirection: TextDirection.ltr,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      for (var i = 0; i < 6; i++)
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 180),
                          curve: Curves.easeOut,
                          width: 46,
                          height: 54,
                          margin: const EdgeInsets.symmetric(horizontal: 4),
                          alignment: Alignment.center,
                          transform: Matrix4.translationValues(
                            0,
                            i == active && !widget.success ? -2 : 0,
                            0,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.surface,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                              color: i == active
                                  ? const Color(0xFF205638)
                                  : const Color(0xFFC9D7C5),
                              width: i == active ? 1.8 : 1.4,
                            ),
                            boxShadow: [
                              if (i == active)
                                const BoxShadow(
                                  color: Color(0x33205F38),
                                  blurRadius: 12,
                                  offset: Offset(0, 4),
                                ),
                            ],
                          ),
                          child: Text(
                            i < widget.code.length ? fa(widget.code[i]) : '',
                            style: const TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF1F4431),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              AnimatedOpacity(
                opacity: widget.success ? 1 : 0,
                duration: const Duration(milliseconds: 280),
                child: AnimatedScale(
                  scale: widget.success ? 1 : 0.4,
                  duration: const Duration(milliseconds: 420),
                  curve: Curves.easeOutBack,
                  child: Container(
                    width: 76,
                    height: 76,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: LinearGradient(
                        colors: [Color(0xFF347A52), Color(0xFF205638)],
                      ),
                    ),
                    child: const Icon(Icons.check_rounded, color: Colors.white, size: 40),
                  ),
                ),
              ),
              Positioned.fill(
                child: TextField(
                  controller: _hidden,
                  focusNode: _focus,
                  autofocus: true,
                  enabled: !widget.success,
                  keyboardType: TextInputType.number,
                  textDirection: TextDirection.ltr,
                  maxLength: 6,
                  style: const TextStyle(color: Colors.transparent),
                  cursorColor: Colors.transparent,
                  decoration: const InputDecoration(
                    counterText: '',
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    filled: false,
                  ),
                  inputFormatters: [
                    TextInputFormatter.withFunction((oldValue, newValue) {
                      final digits = latinDigits(
                        newValue.text,
                      ).replaceAll(RegExp(r'\D'), '');
                      final text = digits.length > 6
                          ? digits.substring(0, 6)
                          : digits;
                      return TextEditingValue(
                        text: text,
                        selection: TextSelection.collapsed(offset: text.length),
                      );
                    }),
                  ],
                  onChanged: (value) => widget.onChanged(latinDigits(value)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _LightShell extends StatelessWidget {
  const _LightShell({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(color: AppColors.bg),
      child: Scaffold(
        backgroundColor: Colors.transparent,
        resizeToAvoidBottomInset: true,
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
            child: child,
          ),
        ),
      ),
    );
  }
}

class _DarkShell extends StatelessWidget {
  const _DarkShell({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF1D4A36), Color(0xFF143528), Color(0xFF0E2A1F)],
          stops: [0, 0.48, 1],
        ),
      ),
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
            child: child,
          ),
        ),
      ),
    );
  }
}

class _SpecialistCard extends StatelessWidget {
  const _SpecialistCard({
    required this.person,
    required this.selected,
    required this.onTap,
  });

  final _Specialist person;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final name = selected ? const Color(0xFF173E2B) : Colors.white;
    final muted = selected ? const Color(0xB3173E2B) : const Color(0xB3FFFFFF);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(24),
        onTap: onTap,
        child: Ink(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            border: Border.all(
              color: selected ? const Color(0xFFDCE8C4) : const Color(0x26CDE0BD),
            ),
            gradient: LinearGradient(
              begin: Alignment.topRight,
              end: Alignment.bottomLeft,
              colors: selected
                  ? const [Color(0xFFFCFDF6), Color(0xFFEAF1DF)]
                  : const [Color(0x0CFFFFFF), Color(0x05FFFFFF)],
            ),
            boxShadow: selected
                ? const [
                    BoxShadow(
                      color: Color(0x22071B1A),
                      blurRadius: 30,
                      offset: Offset(0, 8),
                    ),
                  ]
                : null,
          ),
          child: Stack(
            children: [
              Padding(
                padding: const EdgeInsets.all(10),
                child: Row(
                  children: [
                    _Portrait(photoId: person.photoId),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            person.name,
                            style: TextStyle(
                              color: name,
                              fontSize: 17,
                              fontWeight: FontWeight.w800,
                              height: 1.5,
                            ),
                          ),
                          Text(
                            'متخصص تغذیه',
                            style: TextStyle(color: muted, fontSize: 11),
                          ),
                          const SizedBox(height: 8),
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.only(top: 8),
                            decoration: BoxDecoration(
                              border: Border(
                                top: BorderSide(
                                  color: selected
                                      ? const Color(0x2441663B)
                                      : const Color(0x27CBDAC3),
                                ),
                              ),
                            ),
                            child: Text(
                              person.focus,
                              style: TextStyle(
                                color: muted,
                                fontSize: 12,
                                height: 1.6,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              Positioned(
                top: 12,
                left: 13,
                child: Container(
                  width: 19,
                  height: 19,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: selected ? const Color(0xFF24543A) : Colors.transparent,
                    border: Border.all(
                      color: selected
                          ? const Color(0xFF24543A)
                          : const Color(0x88FFFFFF),
                      width: 1.5,
                    ),
                  ),
                  child: selected
                      ? const Icon(Icons.check, size: 12, color: Colors.white)
                      : null,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Portrait extends StatelessWidget {
  const _Portrait({required this.photoId});
  final String photoId;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 96,
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0x30FFFFFF)),
        boxShadow: const [
          BoxShadow(color: Color(0x15061B16), blurRadius: 14, offset: Offset(0, 5)),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          FoodImage(
            photoId: photoId,
            width: 96,
            height: 96,
            fit: BoxFit.cover,
            alignment: const Alignment(0, -0.4),
          ),
          const Padding(
            padding: EdgeInsets.fromLTRB(4, 7, 4, 8),
            child: Text(
              '★★★★★  ۴٫۸',
              style: TextStyle(
                color: Color(0xFF795F2A),
                fontSize: 9,
                letterSpacing: 0.2,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _WhiteContinue extends StatelessWidget {
  const _WhiteContinue({required this.enabled, required this.onPressed});
  final bool enabled;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [
          BoxShadow(color: Color(0x38000000), blurRadius: 28, offset: Offset(0, 10)),
        ],
      ),
      child: Material(
        color: enabled ? Colors.white : const Color(0xFFD7DDD4),
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: enabled ? onPressed : null,
          child: const SizedBox(
            height: 56,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  'انتخاب پلن و ادامه',
                  style: TextStyle(
                    color: Color(0xFF143528),
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                SizedBox(width: 8),
                Icon(
                  Icons.arrow_back_rounded,
                  textDirection: TextDirection.ltr,
                  color: Color(0xFF143528),
                  size: 20,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _PlanCard extends StatelessWidget {
  const _PlanCard({
    required this.plan,
    required this.doctor,
    required this.open,
    required this.onTap,
  });

  final _Plan plan;
  final String doctor;
  final bool open;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    const accent = Color(0xFF205638);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(22),
          onTap: onTap,
          child: Ink(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(22),
              color: AppColors.surface,
              border: Border.all(
                color: open ? accent : const Color(0xFFD4E3D4),
                width: open ? 2.4 : 1,
              ),
              boxShadow: [
                BoxShadow(
                  color: const Color(0x14244D3F),
                  blurRadius: open ? 24 : 12,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (plan.recommended)
                  const ColoredBox(
                    color: Color(0xFFF1F4E8),
                    child: Padding(
                      padding: EdgeInsets.fromLTRB(16, 6, 16, 6),
                      child: Text(
                        'پیشنهاد ما',
                        textAlign: TextAlign.right,
                        style: TextStyle(
                          color: Color(0xFF63794E),
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        children: [
                          Icon(
                            open
                                ? Icons.keyboard_arrow_up_rounded
                                : Icons.keyboard_arrow_down_rounded,
                            color: accent,
                          ),
                          const Spacer(),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 9,
                              vertical: 3,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF0F6ED),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: const Color(0xFFD4E3D4)),
                            ),
                            child: Text(
                              plan.days,
                              style: const TextStyle(
                                color: accent,
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            plan.title,
                            style: const TextStyle(
                              color: Color(0xFF173E2B),
                              fontSize: 22,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        plan.description,
                        textAlign: TextAlign.right,
                        style: const TextStyle(
                          color: Color(0xFF6D7F72),
                          height: 1.6,
                        ),
                      ),
                      if (open) ...[
                        const SizedBox(height: 10),
                        Align(
                          alignment: Alignment.centerRight,
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              color: accent,
                              borderRadius: const BorderRadius.all(
                                Radius.circular(99),
                              ),
                            ),
                            child: const Padding(
                              padding: EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 3,
                              ),
                              child: Text(
                                '✓  انتخاب شد',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                        for (final line in plan.features)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: Text(
                              line.replaceAll('{doctor}', doctor),
                              textAlign: TextAlign.right,
                              style: const TextStyle(
                                color: Color(0xFF3E5348),
                                height: 1.6,
                              ),
                            ),
                          ),
                        const SizedBox(height: 4),
                        Text(
                          plan.price,
                          textAlign: TextAlign.left,
                          style: const TextStyle(
                            color: Color(0xFF173E2B),
                            fontSize: 28,
                            fontWeight: FontWeight.w800,
                            height: 1,
                          ),
                        ),
                        const Text(
                          'تومان',
                          textAlign: TextAlign.left,
                          style: TextStyle(color: Color(0xFF6D7F72), fontSize: 12),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Specialist {
  const _Specialist({
    required this.id,
    required this.name,
    required this.focus,
    required this.photoId,
  });

  final String id;
  final String name;
  final String focus;
  final String photoId;
}

class _Plan {
  const _Plan({
    required this.id,
    required this.title,
    required this.days,
    required this.price,
    required this.description,
    required this.features,
    this.recommended = false,
  });

  final String id;
  final String title;
  final String days;
  final String price;
  final String description;
  final List<String> features;
  final bool recommended;
}

const _catalog = [
  _Specialist(
    id: 'sara',
    name: 'دکتر سارا محمدی',
    focus: 'کاهش وزن پایدار',
    photoId: 'female_dietitian_in_clinical_office',
  ),
  _Specialist(
    id: 'amir',
    name: 'دکتر امیر حسینی',
    focus: 'متابولیسم و تغذیه',
    photoId: 'nutritionist_in_clinical_coat',
  ),
  _Specialist(
    id: 'nazanin',
    name: 'دکتر نازنین کریمی',
    focus: 'افزایش وزن سالم',
    photoId: 'nutritionist_posing_in_clinic',
  ),
  _Specialist(
    id: 'reza',
    name: 'دکتر رضا احمدی',
    focus: 'عضله‌سازی و انرژی',
    photoId: 'nutritionist_posing_in_office',
  ),
  _Specialist(
    id: 'maryam',
    name: 'دکتر مریم نوری',
    focus: 'تغذیه بارداری',
    photoId: 'nutritionist_smiling_in_clinic',
  ),
  _Specialist(
    id: 'elham',
    name: 'دکتر الهام صادقی',
    focus: 'تغذیه شیردهی',
    photoId: 'pregnant_woman_consulting_a',
  ),
  _Specialist(
    id: 'parsa',
    name: 'دکتر پارسا کیانی',
    focus: 'تغذیه و سلامت گوارش',
    photoId: 'female_dietitian_in_clinical_office',
  ),
  _Specialist(
    id: 'hanieh',
    name: 'دکتر هانیه مرادی',
    focus: 'تغذیه متعادل',
    photoId: 'nutritionist_in_clinical_coat',
  ),
  _Specialist(
    id: 'niloofar',
    name: 'دکتر نیلوفر فرهمند',
    focus: 'اصلاح عادت‌های غذایی',
    photoId: 'nutritionist_posing_in_clinic',
  ),
  _Specialist(
    id: 'kian',
    name: 'دکتر کیان شریفی',
    focus: 'تغذیه ورزشی',
    photoId: 'nutritionist_posing_in_office',
  ),
];

_Stage _stageOf(String raw) => switch (raw) {
  'specialists' => _Stage.specialists,
  'plans' => _Stage.plans,
  'phone' => _Stage.phone,
  _ => _Stage.analysis,
};

List<_Specialist> _offeredFrom(List<String> ids) {
  final found = [
    for (final id in ids)
      for (final person in _catalog)
        if (person.id == id) person,
  ];
  if (found.length >= 2) return found.take(2).toList();
  return _sample();
}

List<_Specialist> _sample() {
  final first = math.Random().nextInt(_catalog.length);
  var second = math.Random().nextInt(_catalog.length - 1);
  if (second >= first) second += 1;
  return [_catalog[first], _catalog[second]];
}

const _plans = [
  _Plan(
    id: 'weekly',
    title: 'شروع',
    days: '۱۵ روزه',
    price: '۱٬۲۹۰٬۰۰۰',
    description: 'یک شروع مشخص، متناسب با تو',
    features: [
      'برنامه تغذیه اختصاصی با {doctor}',
      'جایگزین‌های غذایی متناسب با سلیقه‌ات',
      'لیست خرید برنامه',
    ],
  ),
  _Plan(
    id: 'monthly',
    title: 'همراه',
    days: '۳۰ روزه',
    price: '۱٬۹۹۰٬۰۰۰',
    description: 'زمان بیشتر، همراهی نزدیک‌تر',
    recommended: true,
    features: [
      'همه امکانات پلن شروع با {doctor}',
      '۲ نوبت بازبینی و اصلاح برنامه',
      'پیگیری هفتگی روند و اجرای برنامه',
      'پشتیبانی متنی در طول دوره',
    ],
  ),
  _Plan(
    id: 'quarterly',
    title: 'VIP',
    days: '۹۰ روزه',
    price: '۸٬۹۹۰٬۰۰۰',
    description: 'همراهی خصوصی و پیوسته',
    features: [
      'برنامه اختصاصی و همراهی {doctor}',
      '۶ نوبت بازبینی و اصلاح برنامه',
      '۳ جلسه آنلاین با متخصص منتخب',
      'پیگیری هفتگی و پشتیبانی اولویت‌دار',
    ],
  ),
];
