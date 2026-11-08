import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import '../data/customer_auth.dart';
import '../theme.dart';
import 'auth/auth_screen.dart';
import 'core/api.dart';
import 'core/motion.dart';
import 'home/gate.dart';
import 'session.dart';

/// Root of the production app: sign in, then let the server decide what comes next.
/// Everything below talks to the real backend through [Services]; there is no demo data.
class RealApp extends StatefulWidget {
  const RealApp({super.key, required this.auth, this.services});
  final CustomerAuth auth;

  /// Tests inject fakes; production builds the HTTP implementations.
  final Services? services;

  @override
  State<RealApp> createState() => _RealAppState();
}

class _RealAppState extends State<RealApp> {
  late final SessionController session = SessionController(widget.auth)
    ..restore();
  late final Services services =
      widget.services ?? Services.http(CustomerApiClient(widget.auth));

  @override
  void dispose() {
    session.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'سبزینه',
    debugShowCheckedModeBanner: false,
    theme: appTheme(),
    locale: const Locale('fa'),
    supportedLocales: const [Locale('fa'), Locale('en')],
    localizationsDelegates: GlobalMaterialLocalizations.delegates,
    builder: (context, child) =>
        Directionality(textDirection: TextDirection.rtl, child: child!),
    home: ListenableBuilder(
      listenable: session,
      builder: (context, _) => AnimatedSwitcher(
        duration: Motion.page,
        child: session.restoring
            ? const Scaffold(
                key: ValueKey('restoring'),
                body: Center(child: CircularProgressIndicator()),
              )
            : session.signedIn
            ? PostLoginGate(
                key: const ValueKey('gate'),
                session: session,
                services: services,
              )
            : AuthScreen(key: const ValueKey('auth'), session: session),
      ),
    ),
  );
}
