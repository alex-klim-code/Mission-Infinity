import { test } from "node:test";
import assert from "node:assert/strict";
import { GetGameCatalogResponse } from "@workspace/api-zod";
import { rocketCatalog, rocketOptions } from "./rocket-catalog";

test("structured propellants survive the catalog response schema", () => {
  const result = GetGameCatalogResponse.parse({ missions: [], presets: [], scenes: [], rocketCatalog });
  const options = result.rocketCatalog.flatMap(section => section.categories.flatMap(category => category.options));
  assert.equal(options.length, 119);
  assert.deepEqual(options.find(option => option.name === "SpaceX Raptor 3")?.fuel?.systems, [["methane", "lox"]]);
  assert.deepEqual(options.find(option => option.name === "Busek BHT-600")?.fuel?.systems, [["xenon"], ["krypton"]]);
});

test("documented chemistry is traced to the source; tanks and fictional engines remain unverified", () => {
  for (const option of rocketOptions) {
    if (!option.fuel) continue;
    const fuel = option.fuel;
    assert.match(fuel.sourceLocation, /^Component Catalog![ME]/);
    if (fuel.status === "documented") {
      assert.ok("originalValues" in option);
      assert.equal(fuel.sourceText, option.originalValues.M);
      assert.ok(fuel.systems.length > 0);
    } else {
      assert.deepEqual(fuel.systems, []);
    }
    if (option.categoryId === "fuel-tanks") {
      assert.equal(fuel.status, "unverified", "Tank names/capacity do not document chemistry");
      assert.equal(fuel.sourceText, "");
    }
  }
  assert.equal(rocketOptions.filter(option => option.fuel?.status === "documented").length, 16);
  assert.equal(rocketOptions.filter(option => option.fuel?.role === "engine" && option.fuel.status === "unverified").length, 9);
});
