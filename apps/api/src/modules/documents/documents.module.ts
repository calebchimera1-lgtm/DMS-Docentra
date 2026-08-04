import { Module } from "@nestjs/common";
import { FoldersController } from "./folders/folders.controller";
import { FoldersResolver } from "./folders/folders.resolver";
import { FoldersService } from "./folders/folders.service";
import { DocumentsController } from "./documents/documents.controller";
import { DocumentsResolver } from "./documents/documents.resolver";
import { DocumentsService } from "./documents/documents.service";
import { DocumentsReportsController } from "./reports/documents-reports.controller";
import { DocumentsReportsResolver } from "./reports/documents-reports.resolver";
import { DocumentsReportsService } from "./reports/documents-reports.service";

@Module({
  // Sibling literal sub-paths under "documents" (folders, files, reports) —
  // no controller claims the bare "documents" root, so there is no ":id"
  // wildcard for any of them to shadow. Documents live under
  // "documents/files" rather than "documents" precisely to keep that true
  // (same collision-avoidance-by-construction as every module since
  // Projects).
  controllers: [DocumentsReportsController, FoldersController, DocumentsController],
  providers: [
    FoldersService,
    FoldersResolver,
    DocumentsService,
    DocumentsResolver,
    DocumentsReportsService,
    DocumentsReportsResolver,
  ],
})
export class DocumentsModule {}
