import 'package:flutter/material.dart';
import '../../data/connection.dart';
import '../../core/theme/theme.dart';
import '../screens/splash.dart';
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
        final initialCheck = !link.ready;
        final blocked = link.fault != null || initialCheck;
        return Stack(
          children: [
            Offstage(offstage: blocked, child: child!),
            if (initialCheck)
              const Positioned.fill(child: SplashScreen())
            else if (blocked)
              Positioned.fill(child: ConnectionScreen(link: link)),
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
    null => 'یه لحظه صبر کن…',
    LinkFault.expired => 'برای ادامه، دوباره وارد شو',
    _ => 'یه لحظه گیر کردیم',
  };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: const ValueKey('connection-screen'),
      backgroundColor: cream,
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 360),
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(28),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (link.fault != null && link.fault != LinkFault.expired)
                    const BrandScene(
                      kind: BrandSceneKind.connectionProblem,
                      height: 120,
                    )
                  else
                    const SabzineMark(size: 48),
                  const SizedBox(height: 16),
                  Text(
                    title,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: ink,
                    ),
                  ),
                  const SizedBox(height: 18),
                  FilledButton(
                    key: const ValueKey('connection-retry'),
                    onPressed: link.checking ? null : link.check,
                    child: Text(
                      link.checking ? 'یه لحظه…' : 'دوباره امتحان کن',
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
