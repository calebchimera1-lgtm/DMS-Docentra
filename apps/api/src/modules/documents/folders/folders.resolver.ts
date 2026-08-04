import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { ListFoldersArgs, PaginatedDocumentFolders } from "./graphql/list-folders.args";
import { toDocumentFolderItemType } from "./graphql/folder.mapper";
import { DocumentFolderItemType } from "./graphql/folder.type";
import { FoldersService } from "./folders.service";

@Resolver(() => DocumentFolderItemType)
@RequirePermissions(PERMISSIONS.DOCUMENTS_READ)
export class FoldersResolver {
  constructor(private readonly foldersService: FoldersService) {}

  @Query(() => PaginatedDocumentFolders, { name: "documentFolders" })
  async documentFolders(
    @CurrentUser() user: RequestUser,
    @Args() args: ListFoldersArgs,
  ): Promise<PaginatedDocumentFolders> {
    const result = await this.foldersService.list(user.companyId, args);
    return {
      ...result,
      items: (result.items as Parameters<typeof toDocumentFolderItemType>[0][]).map(toDocumentFolderItemType),
    };
  }

  @Query(() => DocumentFolderItemType, { name: "documentFolder" })
  async documentFolder(
    @CurrentUser() user: RequestUser,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<DocumentFolderItemType> {
    const folder = await this.foldersService.findOne(user.companyId, id);
    return toDocumentFolderItemType(folder);
  }
}
