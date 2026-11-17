export type SupplierFeedItem = {
  externalProductId: string;
  supplierSku?: string;
  name: string;
  category: string;
  description?: string;
  imageUrl?: string;
  currency?: string;
  unitCost?: number;
  minimumOrderQuantity?: number;
  leadTimeDays?: number;
  stockStatus?: string;
  externalStockQuantity?: number;
};

export function parseSupplierCsv(text: string): SupplierFeedItem[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);

  if (quoted) {
    throw new Error("CSV contains an unterminated quoted field.");
  }

  if (rows.length < 2) {
    throw new Error("CSV must include a header row and at least one product row.");
  }

  const normalizeHeader = (value: string) =>
    value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

  const headers = rows[0].map(normalizeHeader);

  const aliases: Record<keyof SupplierFeedItem, string[]> = {
    externalProductId: ["externalproductid", "externalid", "productid", "id"],
    supplierSku: ["suppliersku", "sku"],
    name: ["name", "productname", "title"],
    category: ["category", "productcategory", "type"],
    description: ["description", "desc"],
    imageUrl: ["imageurl", "image", "imageuri"],
    currency: ["currency", "currencycode"],
    unitCost: ["unitcost", "cost", "suppliercost"],
    minimumOrderQuantity: ["minimumorderquantity", "moq"],
    leadTimeDays: ["leadtimedays", "leadtime"],
    stockStatus: ["stockstatus", "availability", "status"],
    externalStockQuantity: [
      "externalstockquantity",
      "stockquantity",
      "quantity",
      "qty",
    ],
  };

  const indexFor = (key: keyof SupplierFeedItem) =>
    headers.findIndex((header) => aliases[key].includes(header));

  for (const key of ["externalProductId", "name", "category"] as const) {
    if (indexFor(key) < 0) {
      throw new Error(
        "CSV is missing required column: " +
          key +
          ". Required columns are externalProductId, name and category."
      );
    }
  }

  const get = (values: string[], key: keyof SupplierFeedItem) => {
    const position = indexFor(key);
    return position < 0 ? "" : (values[position] || "").trim();
  };

  return rows.slice(1).map((values) => {
    const unitCost = get(values, "unitCost");
    const moq = get(values, "minimumOrderQuantity");
    const lead = get(values, "leadTimeDays");
    const stockQty = get(values, "externalStockQuantity");

    return {
      externalProductId: get(values, "externalProductId"),
      supplierSku: get(values, "supplierSku") || undefined,
      name: get(values, "name"),
      category: get(values, "category"),
      description: get(values, "description") || undefined,
      imageUrl: get(values, "imageUrl") || undefined,
      currency: get(values, "currency") || undefined,
      unitCost: unitCost === "" ? undefined : Number(unitCost),
      minimumOrderQuantity: moq === "" ? 1 : Number(moq),
      leadTimeDays: lead === "" ? undefined : Number(lead),
      stockStatus: get(values, "stockStatus") || "unknown",
      externalStockQuantity: stockQty === "" ? undefined : Number(stockQty),
    };
  });
}
