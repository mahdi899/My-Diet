import 'package:flutter/material.dart';
import '../data/demo_store.dart';
import '../theme.dart';
import '../widgets/ui.dart';

class EntryScreen extends StatelessWidget {
  const EntryScreen({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: PageBody(
        children: [
          const SizedBox(height: 25),
          const Center(child: Icon(Icons.spa_outlined, size: 72, color: pine)),
          const SizedBox(height: 4),
          Text(
            'سبزینه',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.headlineLarge,
          ),
          const Text(
            'برنامهٔ غذایی، به سبک تو',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 18, color: muted),
          ),
          const Center(child: FoodArt(size: 210)),
          const Text(
            'به سبزینه خوش اومدی',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
          ),
          const Text(
            'برای دیدن بخش‌های اپ، یک نقش انتخاب کن.',
            textAlign: TextAlign.center,
            style: TextStyle(color: muted),
          ),
          ...AppRole.values.map(
            (r) => Surface(
              onTap: () => DemoScope.of(context).selectRole(r),
              padding: 17,
              child: Row(
                children: [
                  CircleAvatar(
                    backgroundColor: sage,
                    child: Icon(switch (r) {
                      AppRole.user => Icons.person_outline,
                      AppRole.expert => Icons.health_and_safety_outlined,
                      AppRole.admin => Icons.manage_accounts_outlined,
                    }, color: pine),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Text(
                      'ورود به عنوان ${r.label}',
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ),
                  const Icon(Icons.chevron_left, color: muted),
                ],
              ),
            ),
          ),
          const Notice(
            'نسخهٔ نمایشی رابط کاربری؛ اطلاعات نمونه‌اند و به سرور ارسال نمی‌شوند.',
            icon: Icons.science_outlined,
          ),
        ],
      ),
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
  bool codeStep = false;
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

  void finish() {
    DemoScope.of(context).login(
      widget.role,
      phone: latinDigits(phone.text).trim().isEmpty
          ? '09120000000'
          : latinDigits(phone.text).trim(),
    );
    Navigator.of(context).popUntil((r) => r.isFirst);
  }

  @override
  Widget build(BuildContext context) => PopScope<void>(
    canPop: false,
    onPopInvokedWithResult: (didPop, result) {
      if (!didPop) back();
    },
    child: Scaffold(
      appBar: AppBar(
        title: Text('ورود ${widget.role.label}'),
        leading: IconButton(
          tooltip: widget.role == AppRole.user
              ? 'بازگشت به داشبورد'
              : 'بازگشت به آنبوردینگ',
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: back,
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
                  ? 'کد نمونه: ۱۲۳۴۵۶'
                  : 'برای بررسی ظاهر فرم، یک شمارهٔ نمونه وارد کن.',
              style: const TextStyle(color: muted),
            ),
            Form(
              key: form,
              child: TextFormField(
                key: ValueKey(codeStep),
                controller: codeStep ? code : phone,
                keyboardType: TextInputType.phone,
                textDirection: TextDirection.ltr,
                textAlign: TextAlign.center,
                decoration: InputDecoration(
                  labelText: codeStep ? 'کد تأیید' : 'شمارهٔ موبایل',
                  hintText: codeStep ? '123456' : '09120000000',
                ),
                validator: (value) {
                  final v = latinDigits(value ?? '').trim();
                  if (codeStep) {
                    return v == '123456' ? null : 'کد نمونه ۱۲۳۴۵۶ است.';
                  }
                  return RegExp(r'^09\d{9}$').hasMatch(v)
                      ? null
                      : 'شمارهٔ ۱۱ رقمی با ۰۹ وارد کن.';
                },
              ),
            ),
            PrimaryButton(
              codeStep ? 'ورود' : 'دریافت کد نمونه',
              onPressed: () {
                if (!form.currentState!.validate()) return;
                if (codeStep) {
                  finish();
                } else {
                  setState(() => codeStep = true);
                }
              },
            ),
            OutlinedButton.icon(
              onPressed: finish,
              icon: const Icon(Icons.play_circle_outline),
              label: const Text('ورود مستقیم با حساب نمایشی'),
            ),
            const Notice(
              'ورود نمایشی است و پیامکی ارسال نمی‌شود. پاسخ‌های تکمیل‌شدهٔ پرسش‌نامه روی همین دستگاه ذخیره می‌شوند.',
            ),
          ],
        ),
      ),
    ),
  );
}
