import { Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { OnEvent } from "@nestjs/event-emitter";
import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { DomainEvents, type NotificationCreatedEvent } from "../common/events/domain-events";
import type { AccessTokenPayload } from "../modules/auth/interfaces/jwt-payload.interface";

function userRoom(userId: string): string {
  return `user:${userId}`;
}

function companyRoom(companyId: string): string {
  return `company:${companyId}`;
}

/**
 * Authenticated Socket.IO gateway for real-time push (notifications
 * today; any future "X changed, refresh your view" event rides the same
 * connection). Clients connect with `{ auth: { token: <access token> } }`
 * — the same JWT used for REST calls, verified by hand here since
 * Socket.IO's handshake doesn't go through Nest's HTTP guard pipeline.
 */
@WebSocketGateway({
  namespace: "realtime",
  cors: { origin: true, credentials: true },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) {
        throw new UnauthorizedException("Missing token");
      }

      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.getOrThrow("JWT_ACCESS_SECRET"),
      });

      client.data.userId = payload.sub;
      client.data.companyId = payload.companyId;
      await client.join(userRoom(payload.sub));
      await client.join(companyRoom(payload.companyId));
    } catch {
      client.emit("error", { message: "Unauthorized" });
      client.disconnect(true);
    }
  }

  handleDisconnect(@ConnectedSocket() client: Socket): void {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage("ping")
  handlePing(): { pong: true } {
    return { pong: true };
  }

  @OnEvent(DomainEvents.NOTIFICATION_CREATED)
  handleNotificationCreated({ notification }: NotificationCreatedEvent): void {
    this.server.to(userRoom(notification.userId)).emit("notification", notification);
  }
}
