import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../data/customer_auth.dart';
import '../../data/demo_store.dart';
import '../../core/theme/theme.dart';
import '../widgets/auth_canvas.dart';
import '../widgets/kit/pill_button.dart';
import '../widgets/ui.dart';
import '../widgets/sms_otp_autofill.dart';

/// Compatibility widget; the customer application no longer has role selection.
class EntryScreen extends StatelessWidget {
  const EntryScreen({super.key});
  @override
  Widget build(BuildContext context) => const CustomerSignInPrompt();
}

class CustomerSignInPrompt extends StatelessWidget {
  const CustomerSignInPrompt({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('حساب من')),
    body: PageBody(
      children: [
        const SizedBox(height: 40),
        const Center(child: Icon(Icons.person_outline, size: 72, color: pine)),
        const Heading(
          'به حساب خودت وارد شو',
          subtitle: 'برای دیدن برنامه، پیام‌ها و اطلاعات شخصی وارد حساب شو.',
        ),
        PrimaryButton(
          'ورود به حساب',
          onPressed: DemoScope.of(context).openUserLogin,
        ),
        const Notice('متخصص و مدیر از سامانه وب رژیم من استفاده می‌کنند.'),
      ],
    ),
  );
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, required this.role});
  final AppRole role;
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final phone = TextEditingController(), code = TextEditingController();
  late final _smsAutofill = SmsOtpAutofill(
    controller: code,
    onFilled: () {
      if (mounted) setState(() => error = null);
    },
  );
  final form = GlobalKey<FormState>();
  bool codeStep = false, busy = false;
  String? error;
  @override
  void dispose() {
    _smsAutofill.stop();
    phone.dispose();
    code.dispose();
    super.dispose();
  }

  void back() {
    if (codeStep) {
      _smsAutofill.stop();
      setState(() => codeStep = false);
    } else {
      final store = DemoScope.of(context);
      if (widget.role == AppRole.user) {
        store.cancelUserEntry();
      } else {
        store.returnToOnboarding();
      }
    }
  }

  Future<void> finish({bool demo = false}) async {
    final store = DemoScope.of(context);
    setState(() {
      busy = true;
      error = null;
    });
    try {
      if (demo && !store.serverAuthEnabled) {
        store.login(AppRole.user);
      } else {
        await store.verifyLoginCode(
          latinDigits(phone.text).trim(),
          latinDigits(code.text).trim(),
        );
      }
      _smsAutofill.stop();
      TextInput.finishAutofillContext(shouldSave: false);
      if (mounted) Navigator.of(context).popUntil((r) => r.isFirst);
    } catch (failure) {
      if (mounted) setState(() => error = failure.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> sendCode() async {
    if (!form.currentState!.validate() || busy) return;
    if (codeStep) {
      await finish();
      return;
    }
    final store = DemoScope.of(context);
    setState(() {
      busy = true;
      error = null;
    });
    try {
      code.clear();
      if (store.serverAuthEnabled) await _smsAutofill.start();
      if (!mounted) return;
      await store.requestLoginCode(latinDigits(phone.text).trim());
      if (mounted) setState(() => codeStep = true);
    } catch (failure) {
      _smsAutofill.stop();
      if (mounted) setState(() => error = failure.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final server = store.serverAuthEnabled;
    return PopScope<void>(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop && !busy) back();
      },
      child: AuthCanvas(
        onBack: busy ? null : back,
        backTooltip: widget.role == AppRole.user
            ? 'بازگشت به داشبورد'
            : 'بازگشت به آنبوردینگ',
        title: codeStep ? 'کد ورود رو وارد کن' : 'شماره‌ات رو وارد کن',
        subtitle: codeStep
            ? (server
                  ? 'کد ارسال‌شده به شماره‌ات را وارد کن.'
                  : (kDebugMode
                        ? 'کد نمونه: ۱۲۳۴۵۶'
                        : 'کد ارسال‌شده به شماره‌ات را وارد کن.'))
            : 'شماره تلفن همراه خودت را وارد کن.',
        footer: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (!server) ...[
              PillButton(
                label: 'ورود مستقیم با حساب نمایشی',
                variant: PillVariant.outline,
                icon: Icons.play_circle_outline,
                onPressed: busy ? null : () => finish(demo: true),
              ),
              const SizedBox(height: 8),
              const Notice(
                'حالت نمایشی: پیامکی ارسال نمی‌شود و نشست فقط روی همین دستگاه ذخیره می‌شود.',
              ),
            ] else
              const Notice(
                'پس از ورود، می‌توانی پلن موردنظرت را انتخاب و پرداخت کنی.',
              ),
          ],
        ),
        child: AutofillGroup(
          child: Form(
            key: form,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextFormField(
                  key: ValueKey(codeStep),
                  controller: codeStep ? code : phone,
                  enabled: !busy,
                  keyboardType: codeStep
                      ? TextInputType.number
                      : TextInputType.phone,
                  autocorrect: false,
                  autofocus: codeStep,
                  autofillHints: [
                    codeStep
                        ? AutofillHints.oneTimeCode
                        : AutofillHints.telephoneNumberNational,
                  ],
                  textDirection: TextDirection.ltr,
                  textAlign: TextAlign.center,
                  scrollPadding: const EdgeInsets.only(bottom: 140),
                  decoration: InputDecoration(
                    labelText: codeStep ? 'کد تأیید' : 'شماره تلفن',
                    hintText: codeStep
                        ? (kDebugMode ? '123456' : null)
                        : '09120000000',
                  ),
                  validator: (value) {
                    final v = latinDigits(value ?? '').trim();
                    if (codeStep) {
                      return RegExp(r'^\d{6}$').hasMatch(v) ||
                              debugLoginOtp(latinDigits(phone.text).trim(), v)
                          ? null
                          : 'کد شش‌رقمی را وارد کن.';
                    }
                    return RegExp(r'^09\d{9}$').hasMatch(v)
                        ? null
                        : 'شمارهٔ ۱۱ رقمی با ۰۹ وارد کن.';
                  },
                ),
                if (error != null) ...[
                  const SizedBox(height: 12),
                  Semantics(
                    liveRegion: true,
                    child: Notice(error!, icon: Icons.error_outline),
                  ),
                ],
                const SizedBox(height: 16),
                PillButton(
                  label: busy
                      ? 'در حال بررسی…'
                      : codeStep
                      ? 'ورود'
                      : (server || !kDebugMode)
                      ? 'دریافت کد'
                      : 'دریافت کد نمونه',
                  loading: busy,
                  onPressed: busy ? null : sendCode,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
