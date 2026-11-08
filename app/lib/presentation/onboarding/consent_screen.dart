import 'package:flutter/material.dart';
import '../../core/theme/theme.dart';
import '../../core/motion/motion.dart';

/// For accounts whose answers exist but who never agreed to health-data processing.
class ConsentScreen extends StatefulWidget {
  const ConsentScreen({
    super.key,
    required this.onAccept,
    required this.onSignOut,
  });
  final Future<void> Function() onAccept;
  final VoidCallback onSignOut;

  @override
  State<ConsentScreen> createState() => _ConsentScreenState();
}

class _ConsentScreenState extends State<ConsentScreen> {
  bool agreed = false, busy = false;
  String? error;

  Future<void> _accept() async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await widget.onAccept();
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Spacer(),
            const Reveal(
              child: Icon(Icons.verified_user_outlined, size: 64, color: pine),
            ),
            const SizedBox(height: 18),
            Reveal(
              index: 1,
              child: Text(
                'یه قدم تا برنامهٔ تو',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineMedium,
              ),
            ),
            const SizedBox(height: 10),
            const Reveal(
              index: 2,
              child: Text(
                'برای ساخت برنامهٔ غذایی، پاسخ‌هات رو ذخیره و پردازش می‌کنیم. اطلاعات رمزنگاری می‌شه و فقط دکتر مسئول و مدیر مجاز می‌بینه.',
                textAlign: TextAlign.center,
                style: TextStyle(color: muted, height: 1.9),
              ),
            ),
            const SizedBox(height: 18),
            CheckboxListTile(
              value: agreed,
              onChanged: (v) {
                Haptics.tap();
                setState(() => agreed = v ?? false);
              },
              controlAffinity: ListTileControlAffinity.leading,
              title: const Text(
                'با پردازش اطلاعات سلامتم موافقم',
                style: TextStyle(fontSize: 13),
              ),
            ),
            if (error != null)
              Text(
                error!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Color(0xFFA02B2B)),
              ),
            const Spacer(),
            FilledButton(
              onPressed: agreed && !busy ? _accept : null,
              child: busy
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.4,
                        color: Colors.white,
                      ),
                    )
                  : const Text('موافقم و ادامه'),
            ),
            TextButton(
              onPressed: widget.onSignOut,
              child: const Text('خروج از حساب'),
            ),
          ],
        ),
      ),
    ),
  );
}
