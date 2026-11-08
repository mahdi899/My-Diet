import 'package:flutter/material.dart';
import '../../data/demo_store.dart';
import '../../core/theme/theme.dart';
import '../widgets/ui.dart';

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
  final form = GlobalKey<FormState>();
  bool codeStep = false, busy = false;
  String? error;
  @override
  void dispose() {
    phone.dispose();
    code.dispose();
    super.dispose();
  }

  void back() {
    if (codeStep) {
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
      await store.requestLoginCode(latinDigits(phone.text).trim());
      if (mounted) setState(() => codeStep = true);
    } catch (failure) {
      if (mounted) setState(() => error = failure.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => PopScope<void>(
    canPop: false,
    onPopInvokedWithResult: (didPop, result) {
      if (!didPop && !busy) back();
    },
    child: Scaffold(
      appBar: AppBar(
        title: Text('ورود ${widget.role.label}'),
        leading: IconButton(
          tooltip: widget.role == AppRole.user
              ? 'بازگشت به داشبورد'
              : 'بازگشت به آنبوردینگ',
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: busy ? null : back,
        ),
      ),
      body: SafeArea(
        child: PageBody(
          children: [
            const SizedBox(height: 24),
            const Icon(Icons.spa_outlined, size: 64, color: pine),
            Text(
              codeStep ? 'کد ورود رو وارد کن' : 'شماره‌ات رو وارد کن',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            Text(
              codeStep
                  ? (DemoScope.of(context).serverAuthEnabled
                        ? 'کد ارسال‌شده به شماره‌ات را وارد کن.'
                        : 'کد نمونه: ۱۲۳۴۵۶')
                  : 'شماره تلفن همراه خودت را وارد کن.',
              style: const TextStyle(color: muted),
            ),
            Form(
              key: form,
              child: TextFormField(
                key: ValueKey(codeStep),
                controller: codeStep ? code : phone,
                enabled: !busy,
                keyboardType: TextInputType.phone,
                textDirection: TextDirection.ltr,
                textAlign: TextAlign.center,
                decoration: InputDecoration(
                  labelText: codeStep ? 'کد تأیید' : 'شماره تلفن',
                  hintText: codeStep ? '123456' : '09120000000',
                ),
                validator: (value) {
                  final v = latinDigits(value ?? '').trim();
                  if (codeStep) {
                    return RegExp(r'^\d{6}$').hasMatch(v)
                        ? null
                        : 'کد شش‌رقمی را وارد کن.';
                  }
                  return RegExp(r'^09\d{9}$').hasMatch(v)
                      ? null
                      : 'شمارهٔ ۱۱ رقمی با ۰۹ وارد کن.';
                },
              ),
            ),
            if (error != null)
              Semantics(
                liveRegion: true,
                child: Notice(error!, icon: Icons.error_outline),
              ),
            PrimaryButton(
              busy
                  ? 'در حال بررسی…'
                  : codeStep
                  ? 'ورود'
                  : DemoScope.of(context).serverAuthEnabled
                  ? 'دریافت کد'
                  : 'دریافت کد نمونه',
              onPressed: busy ? null : sendCode,
            ),
            if (!DemoScope.of(context).serverAuthEnabled) ...[
              OutlinedButton.icon(
                onPressed: busy ? null : () => finish(demo: true),
                icon: const Icon(Icons.play_circle_outline),
                label: const Text('ورود مستقیم با حساب نمایشی'),
              ),
              const Notice(
                'حالت نمایشی: پیامکی ارسال نمی‌شود و نشست فقط روی همین دستگاه ذخیره می‌شود.',
              ),
            ] else
              const Notice(
                'ورود به سرور متصل است. برنامه غذایی، کیف پول و پیام‌ها در این فاز همچنان پیش‌نمایش هستند.',
              ),
          ],
        ),
      ),
    ),
  );
}
