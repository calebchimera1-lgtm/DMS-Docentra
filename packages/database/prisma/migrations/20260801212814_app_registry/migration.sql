-- CreateEnum
CREATE TYPE "PluginKind" AS ENUM ('MODULE', 'INTEGRATION');

-- AlterTable
ALTER TABLE "plugins" ADD COLUMN     "icon" TEXT,
ADD COLUMN     "kind" "PluginKind" NOT NULL DEFAULT 'INTEGRATION',
ADD COLUMN     "permission_module" TEXT,
ADD COLUMN     "route" TEXT,
ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0;
