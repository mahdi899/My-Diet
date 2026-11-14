import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/theme.dart';
import '../../data/customer_auth.dart';
import '../../data/demo_store.dart';
import '../../data/network/customer_api_client.dart';
import '../../data/onboarding/http_onboarding_repository.dart';
import '../../domain/onboarding/onboarding.dart';
import '../../domain/onboarding/spec.dart';
import '../../core/photos/food_image.dart';
import '../widgets/kit/pill_button.dart';
import 'controller.dart';
import 'onboarding_flow.dart';

/// Questionnaire inside the app for a phone that is not registered yet.
class SignupOnboardingPage extends StatefulWidget {
  const SignupOnboardingPage({
    super.key,
    required this.store,
    this.initialPhone,
  });

  final DemoStore store;
  final String? initialPhone;

  @override
  State<SignupOnboardingPage> createState() => _SignupOnboardingPageState();
}

class _SignupOnboardingPageState extends State<SignupOnboardingPage> {
  OnboardingController? controller;
  String? error;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    widget.store.suppressLiveEntry = true;
    _load();
  }

  @override
  void dispose() {
    controller?.dispose();
    widget.store.suppressLiveEntry = false;
    final store = widget.store;
    WidgetsBinding.instance.addPostFrameCallback((_) => store.update());
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    final auth = widget.store.customerAuth;
    if (auth == null) {
      setState(() {
        loading = false;
        error = 'سرویس ثبت‌نام در دسترس نیست.';
      });
      return;
    }
    try {
      final spec = OnboardingSpec.fromJson(
        await auth.publicGet('public/onboarding-spec'),
      );
      if (!mounted) return;
      controller?.dispose();
      final local = _LocalOnboardingRepository(spec);
      controller = OnboardingController(
        repository: _SubmittingRepository(
          local: local,
          ensureAccount: _ensureAccount,
          auth: auth,
        ),
        spec: spec,
        state: const OnboardingState(
          nextStep: NextStep.start,
          claimedFromDemo: false,
          track: null,
          missing: [],
        ),
      );
      setState(() => loading = false);
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          loading = false;
          error = e.message;
        });
      }
    } on AuthFailure catch (e) {
      if (mounted) {
        setState(() {
          loading = false;
          error = e.message;
        });
      }
    }
  }

  Future<void> _ensureAccount() async {
    final auth = widget.store.customerAuth;
    if (auth?.session != null) return;
    final ready = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      isDismissible: false,
      enableDrag: false,
      builder: (context) => _SignupCodeSheet(
        store: widget.store,
        initialPhone: widget.initialPhone,
      ),
    );
    if (ready != true || auth?.session == null) {
      throw const ApiException('برای ذخیرهٔ پاسخ‌ها شماره را تأیید کن.');
    }
  }

  void _close() {
    if (Navigator.of(context).canPop()) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Scaffold(
        backgroundColor: AppColors.emeraldDark,
        body: Stack(
          fit: StackFit.expand,
          children: [
            FoodImage(
              photoId: 'emerald_sprout_rising_through_ring',
              fit: BoxFit.cover,
              alignment: Alignment.topCenter,
            ),
            DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  stops: [0.18, 0.48, 0.72, 1],
                  colors: [
                    Color(0x14000000),
                    Color(0x660A5C42),
                    Color(0xF20A5C42),
                    AppColors.bg,
                  ],
                ),
              ),
            ),
          ],
        ),
      );
    }
    if (error != null || controller == null) {
      return Scaffold(
        backgroundColor: AppColors.bg,
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(error ?? '', textAlign: TextAlign.center),
                const SizedBox(height: 16),
                FilledButton(onPressed: _load, child: const Text('تلاش دوباره')),
                TextButton(onPressed: _close, child: const Text('بازگشت')),
              ],
            ),
          ),
        ),
      );
    }
    return OnboardingFlow(
      controller: controller!,
      onExit: _close,
      onDone: (_) => _close(),
    );
  }
}

class _LocalOnboardingRepository implements OnboardingRepository {
  _LocalOnboardingRepository(this._spec);
  final OnboardingSpec _spec;
  final Answers answers = {};
  String? track;
  int version = 0;

  @override
  Future<OnboardingSpec> spec() async => _spec;

  @override
  Future<OnboardingState> state() async => const OnboardingState(
    nextStep: NextStep.start,
    claimedFromDemo: false,
    track: null,
    missing: [],
  );

  @override
  Future<int> saveDraft({
    String? track,
    required Answers patch,
    String? stepKey,
    int? progress,
    int? baseVersion,
  }) async {
    if (track != null) this.track = track;
    patch.forEach((key, value) {
      if (value == null) {
        answers.remove(key);
      } else {
        answers[key] = value;
      }
    });
    version += 1;
    return version;
  }

  @override
  Future<ProfileSummary> submit({required Answers patch}) =>
      throw UnimplementedError();

  @override
  Future<void> consent() async {}
}

class _SubmittingRepository implements OnboardingRepository {
  _SubmittingRepository({
    required this.local,
    required this.ensureAccount,
    required this.auth,
  });

  final _LocalOnboardingRepository local;
  final Future<void> Function() ensureAccount;
  final CustomerAuth auth;

  @override
  Future<OnboardingSpec> spec() => local.spec();

  @override
  Future<OnboardingState> state() => local.state();

  @override
  Future<int> saveDraft({
    String? track,
    required Answers patch,
    String? stepKey,
    int? progress,
    int? baseVersion,
  }) => local.saveDraft(
    track: track,
    patch: patch,
    stepKey: stepKey,
    progress: progress,
    baseVersion: baseVersion,
  );

  @override
  Future<void> consent() async {}

  @override
  Future<ProfileSummary> submit({required Answers patch}) async {
    patch.forEach((key, value) {
      if (value == null) {
        local.answers.remove(key);
      } else {
        local.answers[key] = value;
      }
    });
    await ensureAccount();
    final http = HttpOnboardingRepository(CustomerApiClient(auth));
    await http.saveDraft(
      track: local.track,
      patch: local.answers,
      progress: 100,
    );
    return http.submit(patch: const {});
  }
}

class _SignupCodeSheet extends StatefulWidget {
  const _SignupCodeSheet({required this.store, this.initialPhone});
  final DemoStore store;
  final String? initialPhone;

  @override
  State<_SignupCodeSheet> createState() => _SignupCodeSheetState();
}

class _SignupCodeSheetState extends State<_SignupCodeSheet> {
  late final TextEditingController phone = TextEditingController(
    text: widget.initialPhone ?? '',
  );
  final code = TextEditingController();
  bool codeStep = false;
  bool busy = false;
  String? error;

  @override
  void dispose() {
    phone.dispose();
    code.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final digits = latinDigits(phone.text).trim();
    if (!RegExp(r'^09\d{9}$').hasMatch(digits)) {
      setState(() => error = 'شمارهٔ موبایل ۱۱ رقمی را با ۰۹ وارد کن.');
      return;
    }
    final auth = widget.store.customerAuth;
    if (auth == null) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await auth.requestCode(digits);
      if (mounted) setState(() => codeStep = true);
    } on AuthFailure catch (failure) {
      if (mounted) setState(() => error = failure.message);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _verify() async {
    final digits = latinDigits(code.text).trim();
    if (!RegExp(r'^\d{6}$').hasMatch(digits)) {
      setState(() => error = 'کد شش‌رقمی را وارد کن.');
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await widget.store.verifyLoginCode(latinDigits(phone.text).trim(), digits);
      if (mounted) Navigator.pop(context, true);
    } on AuthFailure catch (failure) {
      if (mounted) setState(() => error = failure.message);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 16, 20, 20 + bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'تأیید شماره',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          Text(
            codeStep
                ? 'کد پیامک‌شده را وارد کن تا پاسخ‌ها ذخیره شود.'
                : 'برای ساخت حساب، شماره را تأیید کن.',
            style: const TextStyle(color: AppColors.muted, height: 1.6),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: codeStep ? code : phone,
            enabled: !busy,
            keyboardType: TextInputType.phone,
            textDirection: TextDirection.ltr,
            inputFormatters: [
              LengthLimitingTextInputFormatter(codeStep ? 6 : 11),
            ],
            decoration: InputDecoration(
              labelText: codeStep ? 'کد تأیید' : 'شماره موبایل',
            ),
            onSubmitted: (_) => codeStep ? _verify() : _send(),
          ),
          if (error != null) ...[
            const SizedBox(height: 12),
            Text(error!, style: const TextStyle(color: AppColors.danger)),
          ],
          const SizedBox(height: 16),
          PillButton(
            label: busy
                ? 'در حال بررسی…'
                : codeStep
                ? 'تأیید'
                : 'دریافت کد',
            loading: busy,
            onPressed: busy ? null : (codeStep ? _verify : _send),
          ),
          TextButton(
            onPressed: busy ? null : () => Navigator.pop(context, false),
            child: const Text('انصراف'),
          ),
        ],
      ),
    );
  }
}
