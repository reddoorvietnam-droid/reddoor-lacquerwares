/**
 * Stock-rule verification against a real MongoDB (Atlas replica set), because
 * the guarantees under test — no negative stock, concurrent issues serialised
 * through the material document, cancel restores the balance — live in the
 * database transaction, not in pure code.
 *
 *   npx tsx --env-file-if-exists=.env --conditions=react-server tests/integration/materials-stock-check.ts
 *
 * Creates materials/facilities prefixed `E2E-NVL-` and removes them again.
 * Audit events are append-only and stay behind (they reference test ids only).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { connectToDatabase } from "../../src/lib/db/mongoose";
import {
  getFacilityModel,
  getMaterialModel,
  getMaterialTransactionModel,
} from "../../src/domains/materials/models";
import {
  cancelTransaction,
  readBalances,
  readLookups,
  saveMasters,
  saveTransactions,
} from "../../src/domains/materials/service";
import { MaterialsError } from "../../src/domains/materials/contracts";
import { getAuditEventModel } from "../../src/domains/audit/model";

const actor = "000000000000000000000e2e";
const allowed = { receive: true, issue: true };
const prefix = "E2E-NVL-";
const results: string[] = [];

async function cleanup() {
  const materials = await getMaterialModel()
    .find({ code: { $regex: `^${prefix}` } })
    .select("_id")
    .lean<{ _id: string }[]>()
    .exec();
  const ids = materials.map((m) => m._id);
  await getMaterialTransactionModel().deleteMany({ materialId: { $in: ids } });
  await getMaterialModel().deleteMany({ _id: { $in: ids } });
  await getFacilityModel().deleteMany({ code: { $regex: `^${prefix}` } });
}

async function material(code: string, opening: string) {
  const id = randomUUID();
  await saveMasters(
    {
      kind: "material",
      changes: [
        {
          id,
          version: 0,
          patch: {
            code,
            name: `Vật tư ${code}`,
            unit: "Cái",
            openingQuantity: opening,
          },
        },
      ],
    },
    actor,
  );
  return id;
}

async function facility(code: string) {
  const id = randomUUID();
  await saveMasters(
    {
      kind: "facility",
      changes: [{ id, version: 0, patch: { code, name: `Cơ sở ${code}` } }],
    },
    actor,
  );
  return id;
}

async function line(
  type: "INBOUND" | "OUTBOUND",
  materialCode: string,
  quantity: string,
  facilityCode?: string,
) {
  const id = randomUUID();
  const result = await saveTransactions(
    {
      changes: [
        {
          id,
          version: 0,
          type,
          patch: {
            transactionDate: "2026-09-09",
            materialCode,
            quantity,
            ...(facilityCode ? { facilityCode } : {}),
          },
        },
      ],
    },
    actor,
    allowed,
  );
  return result.rows[0]!;
}

async function current(materialId: string) {
  const balances = await readBalances([materialId]);
  return balances.get(materialId)!.currentQuantity;
}

async function expectRejected(promise: Promise<unknown>, contains: string) {
  try {
    await promise;
  } catch (error) {
    assert.ok(
      error instanceof MaterialsError,
      `expected MaterialsError, got ${String(error)}`,
    );
    assert.ok(
      error.message.includes(contains),
      `expected message containing "${contains}", got "${error.message}"`,
    );
    return error;
  }
  throw new Error(`expected rejection containing "${contains}"`);
}

function pass(label: string) {
  results.push(`PASS ${label}`);
  console.info(`PASS ${label}`);
}

async function main() {
  const db = await connectToDatabase();
  await cleanup();
  const facilityCode = `${prefix}CS`;
  await facility(facilityCode);
  try {
    // #79 basic: 100 + 20 − 30 = 90
    const a = await material(`${prefix}A`, "100");
    await line("INBOUND", `${prefix}A`, "20");
    await line("OUTBOUND", `${prefix}A`, "30", facilityCode);
    assert.equal(await current(a), "90");
    pass("#79 opening 100 + in 20 − out 30 = 90");

    // #80 several inbounds: 10 + 5 + 3 + 2 = 20
    const b = await material(`${prefix}B`, "10");
    for (const q of ["5", "3", "2"]) await line("INBOUND", `${prefix}B`, q);
    assert.equal(await current(b), "20");
    pass("#80 multiple inbound = 20");

    // #81 several outbounds: 100 − 10 − 5 − 15 = 70
    const c = await material(`${prefix}C`, "100");
    for (const q of ["10", "5", "15"])
      await line("OUTBOUND", `${prefix}C`, q, facilityCode);
    assert.equal(await current(c), "70");
    pass("#81 multiple outbound = 70");

    // #82 in and out: 100 + 50 − 40 = 110
    const d = await material(`${prefix}D`, "100");
    await line("INBOUND", `${prefix}D`, "50");
    await line("OUTBOUND", `${prefix}D`, "40", facilityCode);
    assert.equal(await current(d), "110");
    pass("#82 in 50 out 40 = 110");

    // #83 no negative stock: 10, request 11 → rejected, nothing created
    const e = await material(`${prefix}E`, "10");
    const error = await expectRejected(
      line("OUTBOUND", `${prefix}E`, "11", facilityCode),
      "vượt quá tồn kho",
    );
    assert.equal((error as MaterialsError).status, 409);
    assert.equal(await current(e), "10");
    assert.equal(
      await getMaterialTransactionModel().countDocuments({ materialId: e }),
      0,
    );
    pass("#83 over-issue rejected, stock unchanged, no line created");

    // #84 concurrent: 10, two issues of 7 → exactly one commits, stock 3
    const f = await material(`${prefix}F`, "10");
    const settled = await Promise.allSettled([
      line("OUTBOUND", `${prefix}F`, "7", facilityCode),
      line("OUTBOUND", `${prefix}F`, "7", facilityCode),
    ]);
    const fulfilled = settled.filter((s) => s.status === "fulfilled").length;
    assert.equal(
      fulfilled,
      1,
      `expected exactly one success, got ${fulfilled}`,
    );
    assert.equal(await current(f), "3");
    pass("#84 concurrent outbound: one commits, ending stock 3 (never −4)");

    // #85 cancel outbound restores stock and leaves an audit trail
    const g = await material(`${prefix}G`, "100");
    const out = await line("OUTBOUND", `${prefix}G`, "20", facilityCode);
    assert.equal(await current(g), "80");
    await cancelTransaction(
      { id: out.id, version: out.version, reason: "kiểm thử" },
      actor,
    );
    assert.equal(await current(g), "100");
    const audit = await getAuditEventModel().countDocuments({
      resourceType: "materials",
      resourceId: out.id,
      action: "materials.transaction.cancel",
    });
    assert.ok(audit >= 1, "cancel audit event missing");
    pass("#85 cancel outbound → stock 100, audit present");

    // #86 cancel inbound that would drive stock negative is refused
    const h = await material(`${prefix}H`, "100");
    const inb = await line("INBOUND", `${prefix}H`, "20");
    await line("OUTBOUND", `${prefix}H`, "110", facilityCode);
    assert.equal(await current(h), "10");
    await expectRejected(
      cancelTransaction({ id: inb.id, version: inb.version }, actor),
      "vượt quá tồn kho",
    );
    assert.equal(await current(h), "10");
    pass("#86 cancel inbound refused when it would make stock −10");

    // #87 case-insensitive material lookup, no duplicate created
    const lookups = await readLookups();
    const viaLower = await line("INBOUND", `${prefix}A`.toLowerCase(), "1");
    assert.equal(viaLower.materialId, a);
    assert.equal(viaLower.materialCode, `${prefix}A`);
    assert.equal(
      lookups.materials.filter(
        (m) => m.code.toLowerCase() === `${prefix}A`.toLowerCase(),
      ).length,
      1,
    );
    pass("#87 lower-case code resolves to the canonical material");

    // #88 facility lookup fills the name from master data
    const viaFacility = await line(
      "OUTBOUND",
      `${prefix}A`,
      "1",
      facilityCode.toLowerCase(),
    );
    assert.equal(viaFacility.facilityName, `Cơ sở ${facilityCode}`);
    pass("#88 facility code resolves to its master name");

    // Optimistic concurrency on edits: stale version is rejected
    const stale = await line("INBOUND", `${prefix}A`, "2");
    await saveTransactions(
      {
        changes: [
          {
            id: stale.id,
            version: stale.version,
            type: "INBOUND",
            patch: { note: "lần 1" },
          },
        ],
      },
      actor,
      allowed,
    );
    const conflict = await expectRejected(
      saveTransactions(
        {
          changes: [
            {
              id: stale.id,
              version: stale.version,
              type: "INBOUND",
              patch: { note: "lần 2" },
            },
          ],
        },
        actor,
        allowed,
      ),
      "người khác thay đổi",
    );
    assert.equal((conflict as MaterialsError).status, 409);
    pass("#75 stale version rejected with 409");

    // Editing a posted outbound above stock is refused; reducing it is allowed
    const i = await material(`${prefix}I`, "10");
    const issued = await line("OUTBOUND", `${prefix}I`, "8", facilityCode);
    await expectRejected(
      saveTransactions(
        {
          changes: [
            {
              id: issued.id,
              version: issued.version,
              type: "OUTBOUND",
              patch: { quantity: "11" },
            },
          ],
        },
        actor,
        allowed,
      ),
      "vượt quá tồn kho",
    );
    await saveTransactions(
      {
        changes: [
          {
            id: issued.id,
            version: issued.version,
            type: "OUTBOUND",
            patch: { quantity: "5" },
          },
        ],
      },
      actor,
      allowed,
    );
    assert.equal(await current(i), "5");
    pass("edit of posted outbound respects the stock rule");

    // Code lock once a material has transactions
    const stored = await getMaterialModel()
      .findById(a)
      .lean<{ version: number } | null>()
      .exec();
    await expectRejected(
      saveMasters(
        {
          kind: "material",
          changes: [
            { id: a, version: stored!.version, patch: { code: `${prefix}A2` } },
          ],
        },
        actor,
      ),
      "đã có giao dịch",
    );
    pass("#57 material code locked after first transaction");
  } finally {
    await cleanup();
    await db.disconnect();
  }
  console.info(`\n${results.length} checks passed`);
}

main().catch((error) => {
  console.error(
    "FAIL",
    error instanceof Error ? (error.stack ?? error.message) : error,
  );
  process.exitCode = 1;
});
