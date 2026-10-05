import "server-only";
import { randomInt } from "node:crypto";

// Karışabilecek karakterler (0/O, 1/l/I) çıkarıldı; telefonda okunarak iletilebilir.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

export function generateTemporaryPassword(length = 14): string {
  let password = "";
  for (let i = 0; i < length; i++) password += ALPHABET[randomInt(ALPHABET.length)];
  return password;
}

export const MIN_PASSWORD_LENGTH = 10;
