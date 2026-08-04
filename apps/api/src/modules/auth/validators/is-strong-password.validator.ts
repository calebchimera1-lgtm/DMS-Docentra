import { registerDecorator, ValidationOptions } from "class-validator";

/**
 * Password policy: 12+ characters with at least one uppercase, one
 * lowercase, one digit, and one symbol.
 */
const STRONG_PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: "isStrongPassword",
      target: object.constructor,
      propertyName,
      options: {
        message:
          "password must be at least 12 characters and include an uppercase letter, a lowercase letter, a digit, and a symbol",
        ...validationOptions,
      },
      validator: {
        validate(value: unknown): boolean {
          return typeof value === "string" && STRONG_PASSWORD_REGEX.test(value);
        },
      },
    });
  };
}
