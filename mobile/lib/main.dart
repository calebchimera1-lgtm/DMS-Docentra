import 'package:flutter/material.dart';
import 'core/session.dart';
import 'screens/home_shell.dart';
import 'screens/login_screen.dart';

void main() {
  runApp(const DocentraApp());
}

class DocentraApp extends StatelessWidget {
  const DocentraApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Docentra',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorSchemeSeed: const Color(0xFF2952E3),
        useMaterial3: true,
        navigationBarTheme: const NavigationBarThemeData(),
      ),
      home: const _SessionGate(),
    );
  }
}

/// Waits for the persisted session to load before deciding whether to show
/// the login screen or drop the user straight into the app.
class _SessionGate extends StatefulWidget {
  const _SessionGate();

  @override
  State<_SessionGate> createState() => _SessionGateState();
}

class _SessionGateState extends State<_SessionGate> {
  bool _ready = false;

  @override
  void initState() {
    super.initState();
    Session.instance.load().then((_) {
      if (mounted) setState(() => _ready = true);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (!_ready) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    return Session.instance.isLoggedIn ? const HomeShell() : const LoginScreen();
  }
}
