import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Normalize an address string: trim, collapse internal spaces, title-case each word.
// Returns null if the input is empty/nullish.
export function normalizeAddress(value) {
  if (!value?.trim()) return null
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
