import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/photos/food_image.dart';
import '../../core/theme/theme.dart';
import '../../data/demo_store.dart' show DemoScope, latinDigits;
import '../../data/customer_auth.dart';
import '../onboarding/signup_onboarding.dart';
import '../widgets/brand_mark.dart';
import '../widgets/kit/pill_button.dart';

class FirstLoginScreen extends StatefulWidget {
  const FirstLoginScreen({super.key});
  @override
  State<FirstLoginScreen> createState() => _FirstLoginScreenState();
}

class _FirstLoginScreenState extends State<FirstLoginScreen> {
  final _phone = TextEditingController();
  final _code = TextEditingController();
  final _form = GlobalKey<FormState>();
  bool _busy = false, _codeStep = false, _unregistered = false;
  String? _error;

  @override
  void dispose() {
    _phone.dispose();
    _code.dispose();
    super.dispose();
  }

  Future<void> _openOnboarding() async {
    final store = DemoScope.of(context);
    final phone = latinDigits(_phone.text).trim();
    final initial = RegExp(r'^09\d{9}$').hasMatch(phone) ? phone : null;
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => SignupOnboardingPage(store: store, initialPhone: initial),
      ),
    );
  }

  Future<void> _continue() async {
    if (_busy || !_form.currentState!.validate()) return;
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
      } else {
        await auth.requestCode(phone, existingAccountOnly: true);
        if (mounted) setState(() => _codeStep = true);
      }
    } on AuthFailure catch (failure) {
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

  @override
  Widget build(BuildContext context) => Scaffold(
    resizeToAvoidBottomInset: true,
    backgroundColor: AppColors.emeraldDark,
    body: Stack(
      fit: StackFit.expand,
      children: [
        const FoodImage(
          photoId: 'woman_walking_through',
          fit: BoxFit.cover,
          alignment: Alignment.topCenter,
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
                  const SabzineMark(size: 64),
                  const SizedBox(height: 10),
                  const Text(
                    'رژیم من',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
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
                  const SizedBox(height: 8),
                  const Text(
                    'برنامه‌ات آمادهٔ همراهی با توست.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Color(0xFFD7EDE3), height: 1.7),
                  ),
                  const SizedBox(height: 22),
                  TextFormField(
            key: ValueKey(_codeStep),
            controller: _codeStep ? _code : _phone,
            enabled: !_busy,
            keyboardType: TextInputType.phone,
            textInputAction: TextInputAction.done,
            textDirection: TextDirection.ltr,
            textAlign: TextAlign.center,
            scrollPadding: const EdgeInsets.only(bottom: 80),
            autofillHints: const [AutofillHints.telephoneNumberNational],
            inputFormatters: [
              LengthLimitingTextInputFormatter(_codeStep ? 6 : 11),
            ],
            decoration: InputDecoration(
              labelText: _codeStep ? 'کد تأیید پیامکی' : 'شماره موبایل',
              hintText: _codeStep ? '123456' : '09123456789',
              prefixIcon: const Icon(Icons.phone_android_rounded),
            ),
            onChanged: (_) {
              if (_error != null || _unregistered) {
                setState(() {
                  _error = null;
                  _unregistered = false;
                });
              }
            },
            onFieldSubmitted: (_) => _continue(),
            validator: (value) {
              final digits = latinDigits(value ?? '').trim();
              if (_codeStep) {
                return RegExp(r'^\d{6}$').hasMatch(digits)
                    ? null
                    : 'کد شش‌رقمی را وارد کن.';
              }
              return RegExp(r'^09\d{9}$').hasMatch(digits)
                  ? null
                  : 'شمارهٔ موبایل ۱۱ رقمی را با ۰۹ وارد کن.';
            },
          ),
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
                      style: const TextStyle(color: Color(0xFFFFB4B4), height: 1.7),
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
                      onPressed: _busy ? null : _openOnboarding,
                    ),
                  ],
                  if (_codeStep)
                    TextButton(
                      onPressed: _busy
                          ? null
                          : () => setState(() {
                              _codeStep = false;
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
                      onPressed: _busy ? null : _openOnboarding,
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
  );
}
