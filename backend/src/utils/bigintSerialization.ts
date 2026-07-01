// Prisma returns BigInt for large numeric columns (e.g. document/file sizes),
// but JSON.stringify cannot serialize BigInt natively. Express's res.json() relies
// on JSON.stringify, so we teach BigInt to serialize itself as a string once, globally.
declare global {
  interface BigInt {
    toJSON(): string;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function toJSON(this: bigint) {
  return this.toString();
};

export {};
