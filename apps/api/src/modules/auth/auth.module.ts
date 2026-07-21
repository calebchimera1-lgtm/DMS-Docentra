import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAccessStrategy } from "./strategies/jwt-access.strategy";
import { JwtRefreshStrategy } from "./strategies/jwt-refresh.strategy";
import { GoogleOAuthModule } from "./oauth/google-oauth.module";

// Google OAuth only registers its routes/strategy when credentials are
// configured — see google-oauth.module.ts. process.env is checked
// directly (rather than via ConfigService) because module `imports`
// arrays are evaluated at class-decoration time, before Nest's DI
// container — and therefore ConfigModule — exists. main.ts loads
// `dotenv/config` before importing AppModule so this sees .env values too.
const googleOAuthConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}),
    ...(googleOAuthConfigured ? [GoogleOAuthModule] : []),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAccessStrategy, JwtRefreshStrategy],
  exports: [AuthService],
})
export class AuthModule {}
