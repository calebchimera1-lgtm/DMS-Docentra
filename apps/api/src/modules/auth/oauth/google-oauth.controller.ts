import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { ApiExcludeEndpoint, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import type { Request } from "express";
import { Public } from "../../../common/decorators/public.decorator";
import { AuthService } from "../auth.service";
import type { GoogleOAuthUser } from "./google-oauth.strategy";

@ApiTags("auth")
@Controller("auth/oauth/google")
export class GoogleOAuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Get()
  @ApiExcludeEndpoint()
  @UseGuards(AuthGuard("google"))
  initiate(): void {
    // Passport redirects to Google's consent screen; nothing to do here.
  }

  @Public()
  @Get("callback")
  @ApiExcludeEndpoint()
  @UseGuards(AuthGuard("google"))
  async callback(@Req() req: Request & { user: GoogleOAuthUser }) {
    return this.authService.loginWithOAuthEmail(req.user.email, {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      deviceLabel: "Google OAuth",
    });
  }
}
