import { expect, test } from "bun:test";
import { hashPassword, verifyPassword } from "./passwords";

test("argon2id hash round-trips and rejects wrong or malformed input", async () => {
  const h = await hashPassword("correct horse battery");
  expect(h).toStartWith("$argon2id$v=19$m=19456,t=2,p=1$");
  expect(await verifyPassword("correct horse battery", h)).toBe(true);
  expect(await verifyPassword("wrong", h)).toBe(false);
  expect(await verifyPassword("correct horse battery", "$2b$10$bcrypt")).toBe(false);
});
