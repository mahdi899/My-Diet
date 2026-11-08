import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../theme.dart';
import '../../widgets/brand_mark.dart';
import '../core/api.dart';
import '../core/digits.dart';
import '../core/motion.dart';
import '../session.dart';

/// Phone number, then the code. Demo-verified people simply type their number and are in:
/// the server recognises their earlier answers and skips what it already knows.
class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key, required this.session});
  final SessionController session;

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final phone = TextEditingController();
  final code = TextEditingController();
  bool codeStage = false, busy = false;
  String? error;
  int cooldown = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    error = widget.session.error;
  }

  @override
  void dispose() {
    _timer?.cancel();
    phone.dispose();
    code.dispose();
    super.dispose();
  }

  String get _phone => latin(phone.text).replaceAll(RegExp(r'\s'), '');

  void _tick() {
    cooldown = 60;
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return t.cancel();
      setState(() => cooldown -= 1);
      if (cooldown <= 0) t.cancel();
    });
  }

  Future<void> _request() async {
    if (!RegExp(r'^09\d{9}$').hasMatch(_phone)) {
      setState(() => error = 'شمارهٔ موبایل ۱۱ رقمی با ۰۹ شروع می‌شود.');
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await widget.session.requestCode(_phone);
      if (!mounted) return;
      Haptics.confirm();
      setState(() {
        codeStage = true;
        _tick();
      });
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _verify() async {
    final value = latin(code.text).trim();
    if (!RegExp(r'^\d{6}$').hasMatch(value)) {
      setState(() => error = 'کد ۶ رقمی را وارد کن.');
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await widget.session.verify(_phone, value);
    } on ApiException catch (e) {
      if (mounted) setState(() => error = e.message);
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(28),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Reveal(child: Center(child: SabzineMark(size: 92))),
                const SizedBox(height: 22),
                Reveal(
                  index: 1,
                  child: Text(
                    'به رژیم من خوش اومدی',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineMedium,
                  ),
                ),
                const SizedBox(height: 8),
                Reveal(
                  index: 2,
                  child: Text(
                    codeStage
                        ? 'کد ارسال‌شده به ${fa(_phone)} را وارد کن'
                        : 'با شمارهٔ موبایلت وارد شو؛ اگه قبلاً تو نسخهٔ آزمایشی جواب داده باشی، همون‌جا ادامه می‌دیم.',
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: muted, height: 1.9),
                  ),
                ),
                const SizedBox(height: 26),
                AnimatedSwitcher(
                  duration: Motion.base,
                  child: codeStage
                      ? TextField(
                          key: const ValueKey('code'),
                          controller: code,
                          autofocus: true,
                          keyboardType: TextInputType.number,
                          textAlign: TextAlign.center,
                          maxLength: 6,
                          inputFormatters: [
                            FilteringTextInputFormatter.allow(
                              RegExp(r'[0-9۰-۹٠-٩]'),
                            ),
                          ],
                          style: const TextStyle(
                            fontSize: 26,
                            letterSpacing: 10,
                            fontWeight: FontWeight.bold,
                          ),
                          decoration: const InputDecoration(hintText: '------'),
                          onSubmitted: (_) => _verify(),
                        )
                      : TextField(
                          key: const ValueKey('phone'),
                          controller: phone,
                          autofocus: true,
                          keyboardType: TextInputType.phone,
                          textAlign: TextAlign.center,
                          maxLength: 11,
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 2,
                          ),
                          decoration: const InputDecoration(
                            hintText: '۰۹۱۲۳۴۵۶۷۸۹',
                          ),
                          onSubmitted: (_) => _request(),
                        ),
                ),
                AnimatedSize(
                  duration: Motion.base,
                  child: error == null
                      ? const SizedBox(width: double.infinity)
                      : Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: Text(
                            error!,
                            textAlign: TextAlign.center,
                            style: const TextStyle(color: Color(0xFFA02B2B)),
                          ),
                        ),
                ),
                FilledButton(
                  onPressed: busy ? null : (codeStage ? _verify : _request),
                  child: busy
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.4,
                            color: Colors.white,
                          ),
                        )
                      : Text(codeStage ? 'ورود' : 'دریافت کد'),
                ),
                if (codeStage) ...[
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: cooldown > 0 || busy ? null : _request,
                    child: Text(
                      cooldown > 0
                          ? 'ارسال دوباره تا ${fa(cooldown)} ثانیه'
                          : 'ارسال دوبارهٔ کد',
                    ),
                  ),
                  TextButton(
                    onPressed: () => setState(() {
                      codeStage = false;
                      code.clear();
                      error = null;
                    }),
                    child: const Text('تغییر شماره'),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    ),
  );
}
