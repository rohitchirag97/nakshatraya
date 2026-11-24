import { expect, test } from "bun:test";
import { checkPrintToken, printToken } from "./print-token";

test("print token is bound to secret, tenant, report and expiry", async () => {
  const t = await printToken("s", "tenant", "report");
  expect(await checkPrintToken("s", "tenant", "report", t)).toBe(true);
  expect(await checkPrintToken("other", "tenant", "report", t)).toBe(false);
  expect(await checkPrintToken("s", "tenant2", "report", t)).toBe(false);
  expect(await checkPrintToken("s", "tenant", "report2", t)).toBe(false);
  expect(
    await checkPrintToken("s", "tenant", "report", await printToken("s", "tenant", "report", -1)),
  ).toBe(false);
  expect(await checkPrintToken("s", "tenant", "report", "garbage")).toBe(false);
});
