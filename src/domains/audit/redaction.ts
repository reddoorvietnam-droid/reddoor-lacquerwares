const secretKeyPattern =
  /(?:password|passphrase|secret|token|authorization|cookie|api.?key|private.?key|client.?secret|credential|session)/i;
const personallyIdentifyingKeyPattern =
  /(?:email|phone|telephone|address|taxid|passport|nationalid)/i;
const binaryKeyPattern = /(?:binary|buffer|filecontents|base64|dataurl)/i;

const blockedObjectKeys = new Set(["__proto__", "constructor", "prototype"]);
const maximumDepth = 6;
const maximumArrayItems = 50;
const maximumStringLength = 2_000;

function normalizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9_]/g, "").toLocaleLowerCase("en-US");
}

function redactByKey(key: string): string | null {
  const normalizedKey = normalizeKey(key);

  if (secretKeyPattern.test(normalizedKey)) {
    return "[REDACTED]";
  }

  if (personallyIdentifyingKeyPattern.test(normalizedKey)) {
    return "[REDACTED_PII]";
  }

  if (binaryKeyPattern.test(normalizedKey)) {
    return "[OMITTED]";
  }

  return null;
}

function redactValue(
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
): unknown {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    return value;
  }

  if (typeof value === "string") {
    return value.length <= maximumStringLength
      ? value
      : `${value.slice(0, maximumStringLength)}…[TRUNCATED]`;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "undefined") {
    return null;
  }

  if (typeof value === "symbol" || typeof value === "function") {
    return "[OMITTED]";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (depth >= maximumDepth) {
    return "[MAX_DEPTH]";
  }

  if (seen.has(value)) {
    return "[CIRCULAR]";
  }

  seen.add(value);

  if (Array.isArray(value)) {
    const result = value
      .slice(0, maximumArrayItems)
      .map((item) => redactValue(item, depth + 1, seen));

    if (value.length > maximumArrayItems) {
      result.push(`[${value.length - maximumArrayItems} ITEMS OMITTED]`);
    }

    return result;
  }

  const result: Record<string, unknown> = Object.create(null) as Record<
    string,
    unknown
  >;

  for (const [key, nestedValue] of Object.entries(value)) {
    if (blockedObjectKeys.has(key)) {
      continue;
    }

    const replacement = redactByKey(key);
    result[key] = replacement ?? redactValue(nestedValue, depth + 1, seen);
  }

  return result;
}

export function redactAuditValue(value: unknown): unknown {
  return redactValue(value, 0, new WeakSet<object>());
}

export function redactAuditText(value: string): string {
  return value
    .replace(/[\w.!#$%&'*+/=?^`{|}~-]+@[\w-]+(?:\.[\w-]+)+/g, "[REDACTED_PII]")
    .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [REDACTED]")
    .replace(
      /\b(password|passphrase|secret|token|api.?key)\s*[:=]\s*[^\s,;]+/gi,
      "$1=[REDACTED]",
    )
    .slice(0, maximumStringLength);
}
