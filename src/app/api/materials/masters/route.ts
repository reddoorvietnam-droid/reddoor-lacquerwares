import {
  materialsCapabilities,
  requireMaterialsAccess,
} from "@/domains/materials/access";
import { failure, json, readJsonBody } from "@/domains/materials/http";
import { readMasters, saveMasters } from "@/domains/materials/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Danh mục vật tư + cơ sở, with the caller's capabilities for hiding controls. */
export async function GET() {
  try {
    await requireMaterialsAccess("read");
    const [masters, capabilities] = await Promise.all([
      readMasters(),
      materialsCapabilities(),
    ]);
    return json({ ...masters, capabilities });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireMaterialsAccess("manageCatalog");
    const body = await readJsonBody(request);
    return json(await saveMasters(body, access.userId));
  } catch (error) {
    return failure(error);
  }
}
