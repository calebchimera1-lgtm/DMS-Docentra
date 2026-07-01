import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import AWS from 'aws-sdk';
import { env } from '../config/env';

export interface StorageDriver {
  put(key: string, buffer: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, expiresSeconds?: number): Promise<string>;
}

class LocalStorageDriver implements StorageDriver {
  private root: string;

  constructor() {
    this.root = path.resolve(env.localStoragePath);
    if (!fs.existsSync(this.root)) {
      fs.mkdirSync(this.root, { recursive: true });
    }
  }

  private resolveKey(key: string): string {
    const resolved = path.resolve(this.root, key);
    if (!resolved.startsWith(this.root)) {
      throw new Error('Invalid storage key');
    }
    return resolved;
  }

  async put(key: string, buffer: Buffer): Promise<void> {
    const filePath = this.resolveKey(key);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, buffer);
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFileSync(this.resolveKey(key));
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolveKey(key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  async getSignedUrl(key: string): Promise<string> {
    // Local dev fallback: served through an authenticated API route, not a public URL.
    return `${env.appUrl}/api/v1/documents/stream/${encodeURIComponent(key)}`;
  }
}

class S3StorageDriver implements StorageDriver {
  private s3: AWS.S3;

  constructor() {
    this.s3 = new AWS.S3({
      region: env.s3Region,
      endpoint: env.s3Endpoint,
      accessKeyId: env.s3AccessKeyId,
      secretAccessKey: env.s3SecretAccessKey,
      s3ForcePathStyle: env.s3ForcePathStyle,
    });
  }

  async put(key: string, buffer: Buffer): Promise<void> {
    await this.s3
      .putObject({ Bucket: env.s3Bucket, Key: key, Body: buffer, ServerSideEncryption: 'AES256' })
      .promise();
  }

  async get(key: string): Promise<Buffer> {
    const result = await this.s3.getObject({ Bucket: env.s3Bucket, Key: key }).promise();
    return result.Body as Buffer;
  }

  async delete(key: string): Promise<void> {
    await this.s3.deleteObject({ Bucket: env.s3Bucket, Key: key }).promise();
  }

  async getSignedUrl(key: string, expiresSeconds = 900): Promise<string> {
    return this.s3.getSignedUrlPromise('getObject', {
      Bucket: env.s3Bucket,
      Key: key,
      Expires: expiresSeconds,
    });
  }
}

export const storage: StorageDriver = env.storageDriver === 's3' ? new S3StorageDriver() : new LocalStorageDriver();

export function computeChecksum(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// AES-256-GCM at-rest encryption helpers (encryption key is per-org derived from a master key in production).
const ENCRYPTION_KEY = crypto.createHash('sha256').update(env.jwtAccessSecret).digest();

export function encryptBuffer(buffer: Buffer): Buffer {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]);
}

export function decryptBuffer(payload: Buffer): Buffer {
  const iv = payload.subarray(0, 12);
  const authTag = payload.subarray(12, 28);
  const encrypted = payload.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}
