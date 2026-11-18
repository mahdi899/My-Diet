import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/motion/motion.dart';
import '../../core/theme/theme.dart';
import '../../data/demo_store.dart' show DemoScope, latinDigits;
import '../../data/customer_auth.dart';
import '../../data/onboarding/signup_progress.dart';
import '../onboarding/signup_onboarding.dart';
import '../widgets/brand_mark.dart';
import '../widgets/sms_otp_autofill.dart';
import '../widgets/kit/pill_button.dart';

class FirstLoginScreen extends StatefulWidget {
  const FirstLoginScreen({super.key});
  @override
  State<FirstLoginScreen> createState() => _FirstLoginScreenState();
}

class _FirstLoginScreenState extends State<FirstLoginScreen> {
  final _phone = TextEditingController();
  final _code = TextEditingController();
  late final _smsAutofill = SmsOtpAutofill(
    controller: _code,
    onFilled: () {
      if (mounted) setState(() => _error = null);
    },
  );
  final _form = GlobalKey<FormState>();
  final _inputFocus = FocusNode();
  bool _inputSubmitted = false;
  bool _busy = false, _codeStep = false, _unregistered = false;
  String? _error;
  static var _resumedOnce = false;

  @override
  void initState() {
    super.initState();
    _inputFocus.addListener(_inputFocusChanged);
    WidgetsBinding.instance.addPostFrameCallback((_) => _resumeIfNeeded());
  }

  Future<void> _resumeIfNeeded() async {
    final tests = WidgetsBinding.instance.runtimeType.toString().contains(
      'Test',
    );
    if (!mounted || _resumedOnce || tests) return;
    try {
      final saved = await SignupProgressStore().read();
      if (!mounted || saved == null || !saved.hasProgress) return;
      _resumedOnce = true;
      await _openOnboarding();
    } catch (_) {}
  }

  @override
  void dispose() {
    _smsAutofill.stop();
    _inputFocus.dispose();
    _phone.dispose();
    _code.dispose();
    super.dispose();
  }

  Future<void> _openOnboarding({bool fresh = false}) async {
    final store = DemoScope.of(context);
    final phone = latinDigits(_phone.text).trim();
    final initial = RegExp(r'^09\d{9}$').hasMatch(phone) ? phone : null;
    await Navigator.of(context).push(
      PageRouteBuilder<void>(
        transitionDuration: const Duration(milliseconds: 560),
        reverseTransitionDuration: const Duration(milliseconds: 380),
        pageBuilder: (_, animation, _) => FadeTransition(
          opacity: CurvedAnimation(
            parent: animation,
            curve: Curves.easeOutCubic,
          ),
          child: SignupOnboardingPage(
            store: store,
            initialPhone: initial,
            startFresh: fresh,
          ),
        ),
      ),
    );
  }

  Future<void> _continue() async {
    if (_busy) return;
    setState(() => _inputSubmitted = true);
    if (!_form.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    final store = DemoScope.of(context);
    final auth = store.customerAuth;
    if (auth == null) {
      if (const bool.fromEnvironment('USE_DEMO')) {
        store.loginDemoUser();
        return;
      }
      setState(() => _error = 'سرویس ورود در دسترس نیست.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    final phone = latinDigits(_phone.text).trim();
    try {
      if (_codeStep) {
        await store.verifyLoginCode(phone, latinDigits(_code.text).trim());
        _smsAutofill.stop();
        TextInput.finishAutofillContext(shouldSave: false);
      } else {
        _code.clear();
        await _smsAutofill.start();
        if (!mounted) return;
        await auth.requestCode(phone, existingAccountOnly: true);
        if (mounted) {
          setState(() {
            _codeStep = true;
            _inputSubmitted = false;
          });
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted && _codeStep) _inputFocus.requestFocus();
          });
        }
      }
    } on AuthFailure catch (failure) {
      if (!_codeStep) _smsAutofill.stop();
      if (!mounted) return;
      if (failure.code == 'account_not_registered') {
        setState(() => _unregistered = true);
      } else {
        setState(() => _error = failure.message);
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _inputFocusChanged() {
    if (mounted) setState(() {});
  }

  String? _inputError(String? value, {required bool requireComplete}) {
    final digits = latinDigits(value ?? '').trim();
    if (digits.isEmpty) {
      return _inputSubmitted
          ? (_codeStep ? 'کد تأیید را وارد کن.' : 'شماره موبایلت را وارد کن.')
          : null;
    }
    if (!_codeStep &&
        (!digits.startsWith('0') ||
            (digits.length >= 2 && !digits.startsWith('09')))) {
      return 'شماره موبایل باید با ۰۹ شروع شود.';
    }
    final length = _codeStep ? 6 : 11;
    final debugCode =
        _codeStep && debugLoginOtp(latinDigits(_phone.text).trim(), digits);
    if (requireComplete && digits.length != length && !debugCode) {
      return _codeStep
          ? 'کد تأیید باید ۶ رقم باشد.'
          : 'شماره موبایل باید ۱۱ رقم باشد.';
    }
    return null;
  }

  Widget _numberInput(BuildContext context) {
    final digits = latinDigits((_codeStep ? _code : _phone).text).trim();
    final phone = latinDigits(_phone.text).trim();
    final valid = (_codeStep
        ? RegExp(r'^\d{6}$').hasMatch(digits) || debugLoginOtp(phone, digits)
        : RegExp(r'^09\d{9}$').hasMatch(digits));
    final error = _inputError(
      digits,
      requireComplete: _inputSubmitted || !_inputFocus.hasFocus,
    );
    const mint = Color(0xFFB9E4CF);
    const coral = Color(0xFFFFB4B4);
    final accent = error != null ? coral : mint;
    OutlineInputBorder border(Color color, [double width = 1]) =>
        OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: BorderSide(color: color, width: width),
        );
    final title = _codeStep ? 'کد تأیید پیامکی' : 'شماره موبایل';
    return Reveal(
      dy: 8,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ExcludeSemantics(
            child: Padding(
              padding: const EdgeInsetsDirectional.only(start: 4, bottom: 10),
              child: Text(
                title,
                style: const TextStyle(
                  color: Color(0xFFE6F4EA),
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ),
          Semantics(
            label: title,
            child: TextFormField(
              key: ValueKey(_codeStep),
              focusNode: _inputFocus,
              controller: _codeStep ? _code : _phone,
              enabled: !_busy,
              keyboardType: _codeStep
                  ? TextInputType.number
                  : TextInputType.phone,
              autocorrect: false,
              textInputAction: TextInputAction.done,
              textDirection: TextDirection.ltr,
              textAlign: TextAlign.left,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.w500,
                height: 1.2,
              ),
              cursorColor: mint,
              scrollPadding: const EdgeInsets.only(bottom: 80),
              autofillHints: [
                _codeStep
                    ? AutofillHints.oneTimeCode
                    : AutofillHints.telephoneNumberNational,
              ],
              inputFormatters: [
                TextInputFormatter.withFunction((oldValue, newValue) {
                  return newValue.copyWith(text: latinDigits(newValue.text));
                }),
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(_codeStep ? 6 : 11),
              ],
              autovalidateMode: AutovalidateMode.always,
              validator: (value) => _inputError(
                value,
                requireComplete: _inputSubmitted || !_inputFocus.hasFocus,
              ),
              decoration: InputDecoration(
                hintText: _codeStep ? '— — — — — —' : '0912 345 6789',
                hintTextDirection: TextDirection.ltr,
                hintStyle: const TextStyle(
                  color: Color(0xFFB2C4BC),
                  fontSize: 20,
                  fontWeight: FontWeight.w400,
                  height: 1.2,
                ),
                helperText: _codeStep
                    ? 'کد پیامک را از پیشنهاد تکمیل خودکار انتخاب کن یا وارد کن.'
                    : valid
                    ? 'فرمت شماره درست است.'
                    : 'شماره‌ات را با ۰۹ وارد کن؛ ۱۱ رقم.',
                helperStyle: TextStyle(
                  color: valid ? mint : const Color(0xFFB2C4BC),
                  fontSize: 12,
                  height: 1.6,
                ),
                helperMaxLines: 2,
                errorStyle: const TextStyle(
                  color: coral,
                  fontSize: 12,
                  height: 1.6,
                ),
                errorMaxLines: 2,
                prefixIcon: Padding(
                  padding: const EdgeInsetsDirectional.only(start: 14, end: 14),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        _codeStep
                            ? Icons.sms_outlined
                            : Icons.phone_android_rounded,
                        color: const Color(0xFFE6F4EA),
                        size: 22,
                      ),
                      const SizedBox(width: 14),
                      Container(
                        width: 1,
                        height: 22,
                        color: Colors.white.withValues(alpha: 0.18),
                      ),
                    ],
                  ),
                ),
                suffixIcon: SizedBox(
                  width: 44,
                  child: AnimatedSwitcher(
                    duration: Motion.of(context, Motion.quick),
                    child: error != null || valid
                        ? Icon(
                            error != null
                                ? Icons.error_outline_rounded
                                : Icons.check_circle_rounded,
                            key: ValueKey(error != null),
                            size: 20,
                            color: accent,
                          )
                        : const SizedBox.shrink(),
                  ),
                ),
                filled: true,
                fillColor: Colors.white.withValues(alpha: 0.08),
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 18,
                  vertical: 18,
                ),
                border: border(Colors.white.withValues(alpha: 0.22)),
                enabledBorder: border(
                  valid
                      ? mint.withValues(alpha: 0.6)
                      : Colors.white.withValues(alpha: 0.22),
                ),
                focusedBorder: border(mint, 1.5),
                errorBorder: border(coral),
                focusedErrorBorder: border(coral, 1.5),
                disabledBorder: border(Colors.white.withValues(alpha: 0.12)),
              ),
              onChanged: (_) {
                setState(() {
                  _error = null;
                  _unregistered = false;
                });
              },
              onFieldSubmitted: (_) => _continue(),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    resizeToAvoidBottomInset: true,
    backgroundColor: AppColors.emeraldDark,
    body: AutofillGroup(
      child: Stack(
        fit: StackFit.expand,
        children: [
          Image.asset(
            'assets/images/brand_scenes/login_nutrition.png',
            fit: BoxFit.cover,
            alignment: Alignment.topCenter,
            excludeFromSemantics: true,
          ),
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                stops: [0.28, 0.58, 0.78, 1],
                colors: [
                  Color(0x00000000),
                  Color(0x990A1F18),
                  Color(0xF20A1F18),
                  Color(0xFF071510),
                ],
              ),
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 12, 24, 16),
              child: Form(
                key: _form,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Spacer(),
                    const SabzineMark(size: 64, color: Colors.white),
                    const SizedBox(height: 10),
                    const BrandWordmark(width: 120, color: Colors.white),
                    const SizedBox(height: 18),
                    const Text(
                      'ادامهٔ مسیر سلامتی تو',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 28,
                        fontWeight: FontWeight.w800,
                        height: 1.45,
                      ),
                    ),
                    const SizedBox(height: 22),
                    _numberInput(context),
                    const SizedBox(height: 18),
                    PillButton(
                      label: _busy
                          ? 'در حال بررسی…'
                          : _codeStep
                          ? 'تأیید و ورود'
                          : 'ورود',
                      loading: _busy,
                      onPressed: _busy ? null : _continue,
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 12),
                      Text(
                        _error!,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: Color(0xFFFFB4B4),
                          height: 1.7,
                        ),
                      ),
                    ],
                    if (_unregistered) ...[
                      const SizedBox(height: 12),
                      const Text(
                        'ثبت‌نام نکردی',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Color(0xFFFFB4B4), height: 1.7),
                      ),
                      const SizedBox(height: 12),
                      PillButton(
                        label: 'ثبت‌نام',
                        onPressed: _busy
                            ? null
                            : () => _openOnboarding(fresh: true),
                      ),
                    ],
                    if (_codeStep)
                      TextButton(
                        onPressed: _busy
                            ? null
                            : () => setState(() {
                                _smsAutofill.stop();
                                _codeStep = false;
                                _inputSubmitted = false;
                                _code.clear();
                                _error = null;
                                _unregistered = false;
                              }),
                        child: const Text(
                          'تغییر شماره یا درخواست کد جدید',
                          style: TextStyle(color: Colors.white),
                        ),
                      )
                    else if (!_unregistered)
                      TextButton(
                        onPressed: _busy
                            ? null
                            : () => _openOnboarding(fresh: true),
                        child: const Text(
                          'هنوز ثبت‌نام نکردی؟',
                          style: TextStyle(color: Colors.white),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    ),
  );
}
