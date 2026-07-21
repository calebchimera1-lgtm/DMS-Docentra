import { validate } from "class-validator";
import { IsStrongPassword } from "./is-strong-password.validator";

class Fixture {
  @IsStrongPassword()
  password!: string;
}

async function isValid(password: string): Promise<boolean> {
  const fixture = new Fixture();
  fixture.password = password;
  const errors = await validate(fixture);
  return errors.length === 0;
}

describe("IsStrongPassword", () => {
  it("accepts a password meeting all requirements", async () => {
    expect(await isValid("Correct-Horse-9!")).toBe(true);
  });

  it("rejects passwords under 12 characters", async () => {
    expect(await isValid("Sh0rt-1!")).toBe(false);
  });

  it("rejects passwords missing an uppercase letter", async () => {
    expect(await isValid("correct-horse-9!")).toBe(false);
  });

  it("rejects passwords missing a digit", async () => {
    expect(await isValid("Correct-Horse-!")).toBe(false);
  });

  it("rejects passwords missing a symbol", async () => {
    expect(await isValid("Correct1Horse2Battery")).toBe(false);
  });
});
