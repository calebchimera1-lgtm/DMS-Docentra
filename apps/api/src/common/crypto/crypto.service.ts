import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

/**
 * AES-256-GCM encryption for sensitive at-rest values (e.g. TOTP secrets)
 * that the app needs to read back in plaintext — unlike passwords, which
 * are one-way hashed. The key is derived from ENCRYPTION_KEY via scrypt
 * so the configured secret doesn't need to already be exactly 32 bytes.
 */
@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const secret = config.get<string>("ENCRYPTION_KEY");
    if (!secret) {
      throw new Error("ENCRYPTION_KEY must be set");
    }
    this.key = scryptSync(secret, "omniflow-encryption-salt", 32);
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [iv, authTag, ciphertext].map((buf) => buf.toString("base64")).join(".");
  }

  decrypt(payload: string): string {
    const [ivB64, authTagB64, ciphertextB64] = payload.split(".");
    if (!ivB64 || !authTagB64 || !ciphertextB64) {
      throw new Error("Malformed encrypted payload");
    }
    const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextB64, "base64")),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  }
}
