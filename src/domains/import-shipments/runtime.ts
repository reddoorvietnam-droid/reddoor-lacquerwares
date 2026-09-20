import "server-only";

import { mongoAuditRepository } from "@/domains/audit/mongo-repository";
import { mongoImportShipmentStore } from "@/domains/import-shipments/persistence/mongo-store";
import { ImportShipmentCommandService } from "@/domains/import-shipments/service";
import { getCloudinaryEnv } from "@/lib/env/server";

export const importShipmentCommandService = new ImportShipmentCommandService({
  store: mongoImportShipmentStore,
  auditRepository: mongoAuditRepository,
  // Read lazily: a missing storage configuration must not break reads.
  uploadFolder: () => getCloudinaryEnv().CLOUDINARY_UPLOAD_FOLDER,
});
