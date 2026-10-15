import { test } from "node:test";
import assert from "node:assert/strict";
import { serializeJsonLd } from "../src/lib/structured-data.ts";

test("序列化後不含 `<`，且解析回來內容不變", () => {
  const data = { name: "</script><script>alert(1)</script>" };
  const text = serializeJsonLd(data);
  assert.ok(!text.includes("<"));
  assert.deepEqual(JSON.parse(text), data);
});
