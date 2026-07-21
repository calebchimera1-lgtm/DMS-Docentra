import { Module } from "@nestjs/common";
import { GoogleOAuthController } from "./google-oauth.controller";
import { GoogleOAuthStrategy } from "./google-oauth.strategy";

/**
 * Only imported by AuthModule when GOOGLE_CLIENT_ID/SECRET are set (see
 * auth.module.ts) — that keeps the /auth/oauth/google routes and the
 * Google Passport strategy entirely out of the app when OAuth isn't
 * configured, rather than registering routes that would fail at runtime.
 */
@Module({
  controllers: [GoogleOAuthController],
  providers: [GoogleOAuthStrategy],
})
export class GoogleOAuthModule {}
