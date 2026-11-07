import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme.dart';
import '../data/demo_store.dart' show DemoScope, latinDigits;
import '../data/customer_auth.dart';

class FirstLoginScreen extends StatefulWidget {
  const FirstLoginScreen({super.key});
  @override
  State<FirstLoginScreen> createState() => _FirstLoginScreenState();
}

class _FirstLoginScreenState extends State<FirstLoginScreen> {
  final _phone = TextEditingController();
  final _code = TextEditingController();
  final _form = GlobalKey<FormState>();
  bool _busy = false, _codeStep = false;
  String? _error;

  @override
  void dispose() {
    _phone.dispose();
    _code.dispose();
    super.dispose();
  }

  Future<void> _register() async {
    try {
      await const MethodChannel(
        'ir.sabzine/registration',
      ).invokeMethod<void>('open');
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'مرورگر باز نشد. برای ثبت‌نام به my-diet.ir/demo/ برو.',
          ),
        ),
      );
    }
  }

  Future<void> _continue() async {
    if (_busy || !_form.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    final store = DemoScope.of(context);
    final auth = store.customerAuth;
    if (auth == null) {
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
        final register = await showDialog<bool>(
          context: context,
          builder: (dialog) => AlertDialog(
            title: const Text('هنوز ثبت‌نام نکردی'),
            content: const Text(
              'حسابی با این شماره پیدا نشد. برای ساخت حساب به سایت رژیم من برو.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialog),
                child: const Text('بستن'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(dialog, true),
                child: const Text('ثبت‌نام'),
              ),
            ],
          ),
        );
        if (register == true && mounted) await _register();
      } else {
        setState(() => _error = failure.message);
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
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
                Text(
                  'ادامهٔ مسیر سلامتی تو',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                const SizedBox(height: 10),
                const Text(
                  'برنامه‌ات آمادهٔ همراهی با توست.',
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
                          key: ValueKey(_codeStep),
                          controller: _codeStep ? _code : _phone,
                          enabled: !_busy,
                          keyboardType: TextInputType.phone,
                          textInputAction: TextInputAction.done,
                          textDirection: TextDirection.ltr,
                          autofillHints: const [
                            AutofillHints.telephoneNumberNational,
                          ],
                          inputFormatters: [
                            LengthLimitingTextInputFormatter(
                              _codeStep ? 6 : 11,
                            ),
                          ],
                          decoration: InputDecoration(
                            labelText: _codeStep
                                ? 'کد تأیید پیامکی'
                                : 'شماره موبایل',
                            hintText: _codeStep ? '123456' : '09123456789',
                            prefixIcon: const Icon(Icons.phone_android_rounded),
                          ),
                          onChanged: (_) {
                            if (_error != null) setState(() => _error = null);
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
                        const SizedBox(height: 20),
                        FilledButton(
                          onPressed: _busy ? null : _continue,
                          style: FilledButton.styleFrom(
                            minimumSize: const Size.fromHeight(56),
                          ),
                          child: Text(
                            _busy
                                ? 'در حال بررسی…'
                                : _codeStep
                                ? 'تأیید و ورود'
                                : 'ورود',
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        if (_error != null) ...[
                          const SizedBox(height: 16),
                          Semantics(
                            liveRegion: true,
                            child: Text(
                              _error!,
                              style: TextStyle(color: ink, height: 1.8),
                            ),
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
                                  }),
                            child: const Text('تغییر شماره یا درخواست کد جدید'),
                          )
                        else
                          TextButton(
                            onPressed: _busy ? null : _register,
                            child: const Text('هنوز ثبت‌نام نکردی؟'),
                          ),
                      ],
                    ),
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
