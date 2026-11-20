import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_THEME_CONFIG, TEMPLATE_CATALOGUE, TEMPLATE_FAMILIES, validateStorefrontTheme } from "../lib/storefront-theme";
import {
  DIRECTION_CATALOGUE,
  DIRECTION_FAMILIES,
  defaultDirectionTheme,
  validateDirectionTheme,
} from "../lib/storefront-theme-directions";

test("every direction has a valid default theme and builds on an existing family", () => {
  assert.equal(DIRECTION_CATALOGUE.length, DIRECTION_FAMILIES.length);
  for (const family of DIRECTION_FAMILIES) {
    const result = validateDirectionTheme(defaultDirectionTheme(family));
    assert.equal(result.ok, true, family + ": " + (result.ok ? "" : result.errors.join("; ")));
    const def = DIRECTION_CATALOGUE.find((d) => d.family === family)!;
    assert.ok((TEMPLATE_FAMILIES as readonly string[]).includes(def.baseFamily));
  }
});

test("direction families do not collide with existing families", () => {
  for (const family of DIRECTION_FAMILIES) {
    assert.ok(!(TEMPLATE_FAMILIES as readonly string[]).includes(family));
  }
});

test("existing theme system is unchanged", () => {
  assert.equal(TEMPLATE_CATALOGUE.length, 6);
  assert.equal(TEMPLATE_FAMILIES.length, 6);
  assert.equal(validateStorefrontTheme(DEFAULT_THEME_CONFIG).ok, true);
  const mine = { ...DEFAULT_THEME_CONFIG, template: { family: "fashion-showroom", version: "1.0.0" } };
  assert.equal(validateStorefrontTheme(mine).ok, false);
});

test("rejects unknown family, foreign sections, bad colours and unknown tokens", () => {
  const base = defaultDirectionTheme("african-editorial");
  assert.equal(validateDirectionTheme({ ...base, template: { family: "nope", version: "1.0.0" } }).ok, false);
  assert.equal(validateDirectionTheme({
    ...base,
    storefront: { ...base.storefront, homeSections: [{ type: "spec-table", version: 1, enabled: true, settings: {} }] },
  }).ok, false);
  assert.equal(validateDirectionTheme({ ...base, direction: { ...base.direction, colours: { ink: "red" } } }).ok, false);
  assert.equal(validateDirectionTheme({ ...base, direction: { ...base.direction, colours: { evil: "#000000" } } }).ok, false);
});

test("rejects layouts from a different direction and invalid shared fields", () => {
  const base = defaultDirectionTheme("spec-sheet");
  assert.equal(validateDirectionTheme({ ...base, storefront: { ...base.storefront, bagLayout: "drawer" } }).ok, false);
  assert.equal(validateDirectionTheme({ ...base, brand: { ...base.brand, displayName: "" } }).ok, false);
  assert.equal(validateDirectionTheme({ ...base, localisation: { ...base.localisation, enabledMarkets: [] } }).ok, false);
  assert.equal(validateDirectionTheme(null).ok, false);
});

test("no name or path clashes with existing code", async () => {
  const { execSync } = await import("node:child_process");
  const added = execSync("git ls-files --others --exclude-standard; git diff --name-only 0e61775375a2ab0f30cc5008c23ad2c17ffc74c4", { encoding: "utf8" }).split("\n").filter(Boolean);
  const allowed = [
    "lib/storefront-theme-directions.ts",
    "tests/storefront-theme-directions.test.ts",
    "docs/storefront/additional-theme-directions.md",
  ];
  for (const f of added) {
    assert.ok(
      allowed.includes(f) || f.startsWith("app/admin/themes/directions/") || f.startsWith("components/storefront-directions/"),
      "unexpected file outside the isolated paths: " + f
    );
  }
  const tracked = execSync("git ls-tree -r --name-only 0e61775375a2ab0f30cc5008c23ad2c17ffc74c4", { encoding: "utf8" });
  assert.ok(!tracked.split("\n").some((f) => f.startsWith("components/storefront-directions/")), "isolated folder must not pre-exist");
});
