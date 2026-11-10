import 'package:flutter/material.dart';
import '../../core/motion/motion.dart';
import '../../core/theme/tokens.dart';
import '../widgets/brand_mark.dart';
import '../widgets/kit/pill_button.dart';

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
    backgroundColor: AppColors.bg,
    resizeToAvoidBottomInset: true,
    body: DecoratedBox(
      decoration: const BoxDecoration(gradient: AppGradients.warmBackground),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 12, 24, 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(),
              const Center(child: SabzineMark(size: 72)),
              const SizedBox(height: 16),
              Text(
                'یه قدم تا برنامهٔ تو',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 10),
              const Text(
                'برای ساخت برنامه، پاسخ‌ها ذخیره و پردازش می‌شوند. فقط پزشک مسئول و مدیر مجاز آن‌ها را می‌بینند.',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.muted, height: 1.8),
              ),
              const SizedBox(height: 12),
              CheckboxListTile(
                value: agreed,
                contentPadding: EdgeInsets.zero,
                onChanged: busy
                    ? null
                    : (v) {
                        Haptics.tap();
                        setState(() => agreed = v ?? false);
                      },
                controlAffinity: ListTileControlAffinity.leading,
                title: const Text(
                  'با پردازش اطلاعات سلامتم موافقم',
                  style: TextStyle(fontSize: 13.5, height: 1.6),
                ),
              ),
              if (error != null)
                Text(
                  error!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.danger, height: 1.6),
                ),
              const Spacer(),
              PillButton(
                label: 'موافقم و ادامه',
                loading: busy,
                onPressed: agreed && !busy ? _accept : null,
              ),
              TextButton(
                onPressed: busy ? null : widget.onSignOut,
                child: const Text('خروج از حساب'),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
