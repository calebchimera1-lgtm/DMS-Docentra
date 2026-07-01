import 'package:flutter/material.dart';
import '../core/api_client.dart';
import '../core/session.dart';
import 'home_shell.dart';

class MfaVerifyScreen extends StatefulWidget {
  final String mfaChallengeToken;
  const MfaVerifyScreen({super.key, required this.mfaChallengeToken});

  @override
  State<MfaVerifyScreen> createState() => _MfaVerifyScreenState();
}

class _MfaVerifyScreenState extends State<MfaVerifyScreen> {
  final _codeController = TextEditingController();
  bool _loading = false;
  String? _error;

  Future<void> _submit() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await ApiClient.instance.post('/auth/login/mfa', body: {
        'mfaChallengeToken': widget.mfaChallengeToken,
        'code': _codeController.text.trim(),
      });
      await Session.instance.save(access: data['accessToken'], refresh: data['refreshToken'], userData: data['user']);
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(MaterialPageRoute(builder: (_) => const HomeShell()), (route) => false);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Two-factor verification')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('Enter the 6-digit code from your authenticator app, or a backup code.'),
            const SizedBox(height: 16),
            TextField(
              controller: _codeController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Verification code', border: OutlineInputBorder()),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: const TextStyle(color: Colors.red)),
            ],
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _loading ? null : _submit,
              child: _loading ? const CircularProgressIndicator() : const Text('Verify'),
            ),
          ],
        ),
      ),
    );
  }
}
