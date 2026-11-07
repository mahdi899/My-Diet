import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme.dart';
import '../data/demo_store.dart' show latinDigits;

/// Presentation-only login. Never creates a session or sends an OTP.
class FirstLoginScreen extends StatefulWidget {
  const FirstLoginScreen({super.key});
  @override
  State<FirstLoginScreen> createState() => _FirstLoginScreenState();
}

class _FirstLoginScreenState extends State<FirstLoginScreen> {
  final _phone = TextEditingController();
  final _form = GlobalKey<FormState>();
  bool _submitted = false;

  @override
  void dispose() {
    _phone.dispose();
    super.dispose();
  }

  void _continue() {
    if (!_form.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() => _submitted = true);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: cream,
    body: SafeArea(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 440),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.spa_rounded, color: pine, size: 28),
                    SizedBox(width: 10),
                    Text(
                      'رژیم من',
                      style: TextStyle(
                        color: pine,
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 44),
                Center(
                  child: Container(
                    width: 108,
                    height: 108,
                    decoration: BoxDecoration(
                      color: sage,
                      borderRadius: BorderRadius.circular(36),
                    ),
                    child: const Icon(
                      Icons.eco_outlined,
                      size: 58,
                      color: pine,
                    ),
                  ),
                ),
                const SizedBox(height: 28),
                Text(
                  'ادامهٔ مسیر سلامتی تو',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                const SizedBox(height: 10),
                const Text(
                  'برنامه‌ات آمادهٔ همراهی با توست.\nبا شماره‌ای که در سایت ثبت کردی وارد شو.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: ink, height: 1.9, fontSize: 15),
                ),
                const SizedBox(height: 32),
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(28),
                    border: Border.all(color: sage),
                  ),
                  child: Form(
                    key: _form,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Text(
                          'ورود به حساب',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w700,
                            color: ink,
                          ),
                        ),
                        const SizedBox(height: 24),
                        TextFormField(
                          controller: _phone,
                          keyboardType: TextInputType.phone,
                          textInputAction: TextInputAction.done,
                          textDirection: TextDirection.ltr,
                          autofillHints: const [
                            AutofillHints.telephoneNumberNational,
                          ],
                          inputFormatters: [
                            LengthLimitingTextInputFormatter(11),
                          ],
                          decoration: const InputDecoration(
                            labelText: 'شماره موبایل',
                            hintText: '0912 345 6789',
                            prefixIcon: Icon(Icons.phone_android_rounded),
                          ),
                          onChanged: (_) {
                            if (_submitted) setState(() => _submitted = false);
                          },
                          onFieldSubmitted: (_) => _continue(),
                          validator: (value) =>
                              RegExp(
                                r'^09\d{9}$',
                              ).hasMatch(latinDigits(value ?? '').trim())
                              ? null
                              : 'شمارهٔ موبایل ۱۱ رقمی را با ۰۹ وارد کن.',
                        ),
                        const SizedBox(height: 20),
                        FilledButton(
                          onPressed: _continue,
                          style: FilledButton.styleFrom(
                            minimumSize: const Size.fromHeight(56),
                          ),
                          child: const Text(
                            'ادامه',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        if (_submitted) ...[
                          const SizedBox(height: 16),
                          Semantics(
                            liveRegion: true,
                            child: Text(
                              'ورود هنوز فعال نشده است. اتصال و ارسال کد تأیید در مرحلهٔ بعد اضافه می‌شود.',
                              style: TextStyle(color: ink, height: 1.8),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                const Text(
                  'هنوز ثبت‌نام نکردی؟',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: ink),
                ),
                const SizedBox(height: 8),
                const Text(
                  'ثبت‌نام و ساخت برنامه از طریق سایت رژیم من',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: ink, height: 1.8),
                ),
                const SelectableText(
                  'my-diet.ir/demo/',
                  textAlign: TextAlign.center,
                  textDirection: TextDirection.ltr,
                  style: TextStyle(
                    color: pine,
                    height: 2,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}
