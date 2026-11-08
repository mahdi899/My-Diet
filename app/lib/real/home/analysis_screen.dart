import 'dart:async';
import 'package:flutter/material.dart';
import '../../theme.dart';
import '../core/api.dart';
import '../core/motion.dart';
import '../plan/plan.dart';
import '../session.dart';

/// Shown between "paid" and "the doctor approved". It reflects the real request status:
/// the AI drafting, the doctor reviewing, or the doctor asking something. The diet does not
/// start until the doctor publishes, and this screen says so plainly.
class AnalysisScreen extends StatelessWidget {
  const AnalysisScreen({
    super.key,
    required this.request,
    required this.services,
    required this.onRefresh,
    required this.onSignOut,
  });
  final PlanRequestInfo request;
  final Services services;
  final VoidCallback onRefresh;
  final VoidCallback onSignOut;

  @override
  Widget build(BuildContext context) {
    final phase = request.phase;
    return Scaffold(
      appBar: AppBar(
        title: const Text('در حال ساخت برنامه'),
        actions: [
          IconButton(
            tooltip: 'خروج',
            onPressed: onSignOut,
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => onRefresh(),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
          children: [
            const SizedBox(height: 12),
            Center(child: _Orb(phase: phase)),
            const SizedBox(height: 24),
            AnimatedSwitcher(
              duration: Motion.base,
              child: Column(
                key: ValueKey(phase),
                children: [
                  Text(
                    _title(phase),
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineMedium,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _body(phase),
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: muted, height: 1.9),
                  ),
                ],
              ),
            ),
            if (phase == RequestPhase.generating ||
                phase == RequestPhase.queued) ...[
              const SizedBox(height: 22),
              const _Thinking(),
            ],
            if (phase == RequestPhase.needsInfo)
              for (final q in request.openQuestions)
                _QuestionCard(
                  question: q,
                  services: services,
                  onAnswered: onRefresh,
                ),
            const SizedBox(height: 26),
            _Timeline(phase: phase),
          ],
        ),
      ),
    );
  }

  static String _title(RequestPhase p) => switch (p) {
    RequestPhase.queued => 'درخواستت ثبت شد',
    RequestPhase.generating => 'هوش مصنوعی داره برنامه‌ات رو می‌چینه',
    RequestPhase.needsInfo => 'دکتر یه سؤال داره',
    RequestPhase.inReview => 'دکتر داره برنامه‌ات رو بررسی می‌کنه',
    _ => 'درخواست بسته شد',
  };

  static String _body(RequestPhase p) => switch (p) {
    RequestPhase.queued => 'چند لحظهٔ دیگه ساخت پیش‌نویس شروع می‌شه.',
    RequestPhase.generating =>
      'از بین غذاهای ایرانی، چیزهایی انتخاب می‌شه که با ذائقه، بودجه و شرایط تو جور باشه.',
    RequestPhase.needsInfo =>
      'برای اینکه برنامه دقیق‌تر بشه، لطفاً جواب بده. تا جواب ندی بررسی ادامه پیدا نمی‌کنه.',
    RequestPhase.inReview =>
      'پیش‌نویس آماده‌ست و دکتر اون رو اصلاح و تأیید می‌کنه. رژیمت بعد از تأیید دکتر شروع می‌شه؛ خبرت می‌کنیم.',
    _ => 'اگه خواستی دوباره درخواست بده.',
  };
}

class _Orb extends StatefulWidget {
  const _Orb({required this.phase});
  final RequestPhase phase;
  @override
  State<_Orb> createState() => _OrbState();
}

class _OrbState extends State<_Orb> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 3),
  )..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final doctor =
        widget.phase == RequestPhase.inReview ||
        widget.phase == RequestPhase.needsInfo;
    return AnimatedBuilder(
      animation: _c,
      builder: (context, _) {
        final t = _c.value;
        return SizedBox(
          width: 150,
          height: 150,
          child: Stack(
            alignment: Alignment.center,
            children: [
              for (var i = 0; i < 3; i++)
                Opacity(
                  opacity: (1 - ((t + i / 3) % 1)) * 0.35,
                  child: Container(
                    width: 70 + 80 * ((t + i / 3) % 1),
                    height: 70 + 80 * ((t + i / 3) % 1),
                    decoration: const BoxDecoration(
                      color: Color(0xFF7C9C58),
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
              Container(
                width: 86,
                height: 86,
                decoration: const BoxDecoration(
                  color: pine,
                  shape: BoxShape.circle,
                ),
                child: AnimatedSwitcher(
                  duration: Motion.base,
                  child: Icon(
                    doctor
                        ? Icons.medical_services_outlined
                        : Icons.auto_awesome,
                    key: ValueKey(doctor),
                    color: Colors.white,
                    size: 40,
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

/// Rotating "what is happening" lines while the model works. They describe the real pipeline.
class _Thinking extends StatefulWidget {
  const _Thinking();
  @override
  State<_Thinking> createState() => _ThinkingState();
}

class _ThinkingState extends State<_Thinking> {
  static const lines = [
    'خوندن پروفایل و هدف انرژی تو',
    'حذف غذاهای ناسازگار با حساسیت و شرایطت',
    'انتخاب از سفرهٔ ایرانی: خورشت‌ها، آش‌ها، پلوها',
    'تنظیم اندازهٔ سهم‌ها تا کالری دقیق بشه',
    'چک‌کردن تنوع و ایمنی هفته',
  ];
  int i = 0;
  Timer? _t;

  @override
  void initState() {
    super.initState();
    _t = Timer.periodic(const Duration(milliseconds: 2400), (_) {
      if (mounted) setState(() => i = (i + 1) % lines.length);
    });
  }

  @override
  void dispose() {
    _t?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedSwitcher(
    duration: Motion.base,
    transitionBuilder: (c, a) => FadeTransition(
      opacity: a,
      child: SlideTransition(
        position: Tween(
          begin: const Offset(0, 0.4),
          end: Offset.zero,
        ).animate(a),
        child: c,
      ),
    ),
    child: Container(
      key: ValueKey(i),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: sage,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
          const SizedBox(width: 10),
          Flexible(child: Text(lines[i], style: const TextStyle(fontSize: 13))),
        ],
      ),
    ),
  );
}

class _Timeline extends StatelessWidget {
  const _Timeline({required this.phase});
  final RequestPhase phase;

  @override
  Widget build(BuildContext context) {
    final reached = switch (phase) {
      RequestPhase.queued => 1,
      RequestPhase.generating => 2,
      RequestPhase.needsInfo || RequestPhase.inReview => 3,
      _ => 4,
    };
    const steps = [
      ('پرداخت و ثبت درخواست', Icons.receipt_long_outlined),
      ('پیش‌نویس هوشمند', Icons.auto_awesome),
      ('بررسی و تأیید دکتر', Icons.medical_services_outlined),
      ('شروع رژیم', Icons.flag_outlined),
    ];
    return Column(
      children: [
        for (final (i, s) in steps.indexed)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Row(
              children: [
                AnimatedContainer(
                  duration: Motion.base,
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: i < reached - 1
                        ? pine
                        : i == reached - 1
                        ? sage
                        : Colors.white,
                    border: Border.all(
                      color: i < reached ? pine : const Color(0xFFDDE5D4),
                    ),
                  ),
                  child: Icon(
                    i < reached - 1 ? Icons.check : s.$2,
                    size: 18,
                    color: i < reached - 1
                        ? Colors.white
                        : i == reached - 1
                        ? pine
                        : muted,
                  ),
                ),
                const SizedBox(width: 12),
                Text(
                  s.$1,
                  style: TextStyle(
                    fontWeight: i == reached - 1
                        ? FontWeight.bold
                        : FontWeight.normal,
                    color: i < reached ? ink : muted,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _QuestionCard extends StatefulWidget {
  const _QuestionCard({
    required this.question,
    required this.services,
    required this.onAnswered,
  });
  final InfoQuestion question;
  final Services services;
  final VoidCallback onAnswered;
  @override
  State<_QuestionCard> createState() => _QuestionCardState();
}

class _QuestionCardState extends State<_QuestionCard> {
  final c = TextEditingController();
  bool busy = false;
  String? error;

  @override
  void dispose() {
    c.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    if (c.text.trim().length < 2) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await widget.services.plans.answerQuestion(
        widget.question.id,
        c.text.trim(),
      );
      widget.onAnswered();
    } on ApiException catch (e) {
      if (mounted) setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 18),
    child: Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: amber.withValues(alpha: 0.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            widget.question.prompt,
            style: const TextStyle(fontWeight: FontWeight.bold, height: 1.8),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: c,
            maxLines: 3,
            maxLength: 2000,
            decoration: const InputDecoration(hintText: 'جوابت رو بنویس'),
          ),
          if (error != null)
            Text(error!, style: const TextStyle(color: Color(0xFFA02B2B))),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: busy ? null : _send,
              child: const Text('ارسال جواب'),
            ),
          ),
        ],
      ),
    ),
  );
}
