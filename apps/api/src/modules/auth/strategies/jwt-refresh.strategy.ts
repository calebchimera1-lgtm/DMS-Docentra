import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Request } from "express";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { RefreshTokenPayload } from "../interfaces/jwt-payload.interface";

export interface RefreshTokenRequestUser {
  sub: string;
  sessionId: string;
  refreshToken: string;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, "jwt-refresh") {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField("refreshToken"),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>("JWT_REFRESH_SECRET"),
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: RefreshTokenPayload): RefreshTokenRequestUser {
    const refreshToken = (req.body as { refreshToken?: string }).refreshToken;
    return { sub: payload.sub, sessionId: payload.sessionId, refreshToken: refreshToken ?? "" };
  }
}
