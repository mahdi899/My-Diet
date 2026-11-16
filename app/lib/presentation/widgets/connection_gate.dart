import 'package:flutter/material.dart';
import '../../data/connection.dart';
import '../../core/theme/theme.dart';
import 'brand_mark.dart';
import 'brand_scene.dart';

class ConnectionGate extends StatelessWidget {
  const ConnectionGate({super.key, required this.link, required this.child});
  final LinkMonitor link;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: link,
      builder: (context, child) {
        final blocked = link.fault != null || (link.checking && !link.ready);
        return Stack(
          children: [
            Offstage(offstage: blocked, child: child!),
            if (blocked) Positioned.fill(child: ConnectionScreen(link: link)),
          ],
        );
      },
      child: child,
    );
  }
}

class ConnectionScreen extends StatelessWidget {
  const ConnectionScreen({super.key, required this.link});
  final LinkMonitor link;

  String get title => switch (link.fault) {
    null => 'در حال بررسی اتصال',
    LinkFault.offline => 'ارتباط برقرار نیست',
    LinkFault.unavailable => 'سرویس موقتاً در دسترس نیست',
    LinkFault.timeout => 'پاسخ سرور به‌موقع نرسید',
    LinkFault.expired => 'نشست پایان یافته',
  };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: const ValueKey('connection-screen'),
      backgroundColor: cream,
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(28),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const SabzineMark(size: 72),
                  const SizedBox(height: 18),
                  const Text(
                    'رژیم من',
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                      color: pine,
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (link.fault != null && link.fault != LinkFault.expired)
                    const BrandScene(
                      kind: BrandSceneKind.connectionProblem,
                      height: 150,
                    ),
                  Text(
                    title,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 18, color: ink),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    link.fault == LinkFault.expired
                        ? 'برای ادامه دوباره وارد شو. برنامهٔ ذخیره‌شده به‌صورت آفلاین باز نمی‌شود.'
                        : 'برنامهٔ ذخیره‌شده به‌صورت آفلاین نمایش داده نمی‌شود.',
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: muted),
                  ),
                  const SizedBox(height: 22),
                  FilledButton(
                    key: const ValueKey('connection-retry'),
                    onPressed: link.checking ? null : link.check,
                    child: Text(
                      link.checking ? 'در حال بررسی اتصال' : 'تلاش دوباره',
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
}
