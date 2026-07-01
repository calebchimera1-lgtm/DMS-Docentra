/// Central runtime configuration for the Docentra mobile client.
///
/// Override at build/run time with:
///   flutter run --dart-define=API_BASE_URL=https://api.your-docentra-domain.com/api/v1
class AppConfig {
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:4000/api/v1', // 10.0.2.2 = host loopback from the Android emulator
  );
}
