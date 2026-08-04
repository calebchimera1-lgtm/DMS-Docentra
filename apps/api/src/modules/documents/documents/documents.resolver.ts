import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import type { DocumentStatus } from "@omniflow/database";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { ListDocumentsArgs, PaginatedDocuments } from "./graphql/list-documents.args";
import { toDocumentItemType } from "./graphql/document.mapper";
import { DocumentItemType } from "./graphql/document.type";
import { DocumentsService } from "./documents.service";

@Resolver(() => DocumentItemType)
@RequirePermissions(PERMISSIONS.DOCUMENTS_READ)
export class DocumentsResolver {
  constructor(private readonly documentsService: DocumentsService) {}

  @Query(() => PaginatedDocuments, { name: "documents" })
  async documents(@CurrentUser() user: RequestUser, @Args() args: ListDocumentsArgs): Promise<PaginatedDocuments> {
    const result = await this.documentsService.list(user.companyId, {
      ...args,
      status: args.status as DocumentStatus | undefined,
    });
    return {
      ...result,
      items: (result.items as Parameters<typeof toDocumentItemType>[0][]).map(toDocumentItemType),
    };
  }

  @Query(() => DocumentItemType, { name: "document" })
  async document(
    @CurrentUser() user: RequestUser,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<DocumentItemType> {
    const document = await this.documentsService.findOne(user.companyId, id);
    return toDocumentItemType(document);
  }
}
