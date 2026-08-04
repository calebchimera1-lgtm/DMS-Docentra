import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuthorizationService } from "../authorization/authorization.service";
import { PrismaService } from "../../prisma/prisma.service";
import { POLYMORPHIC_ENTITY_REGISTRY } from "./polymorphic-entity.registry";

export type PolymorphicAccessMode = "read" | "write";

/**
 * Gates the generic Comments/Attachments modules, which take an
 * arbitrary `entityType` string at request time rather than a fixed
 * route, so the usual static `@RequirePermissions` decorator can't
 * express "you need CRM permissions to comment on a CrmAccount but
 * Sales permissions to comment on a Quote." This is the single place
 * that translates entityType -> the module permission it belongs to.
 */
@Injectable()
export class PolymorphicAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
  ) {}

  /** Throws unless the user holds the module permission for this entityType. Returns the registry entry for reuse (e.g. existence checks). */
  async assertAccess(userId: string, entityType: string, mode: PolymorphicAccessMode) {
    const definition = POLYMORPHIC_ENTITY_REGISTRY[entityType];
    if (!definition) {
      throw new BadRequestException(`Unsupported entityType: ${entityType}`);
    }

    const required = mode === "read" ? definition.readPermission : definition.writePermission;
    const effective = await this.authorization.getEffectivePermissions(userId);
    if (!effective.has(required)) {
      throw new ForbiddenException(`Missing required permission: ${required}`);
    }

    return definition;
  }

  /** For writes: also verifies entityId actually exists in this company, so comments/attachments can never be filed against an orphan or wrong-tenant id. */
  async assertEntityExists(companyId: string, entityType: string, entityId: string): Promise<void> {
    const definition = POLYMORPHIC_ENTITY_REGISTRY[entityType];
    if (!definition) {
      throw new BadRequestException(`Unsupported entityType: ${entityType}`);
    }
    const count = await definition.model(this.prisma).count({ where: { id: entityId, companyId } });
    if (count === 0) {
      throw new NotFoundException(`${entityType} ${entityId} not found`);
    }
  }
}
