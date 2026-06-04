import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function hexToInt(hex: string): number {
  return parseInt(hex.replace("#", ""), 16);
}

export function intToHex(n: number): string {
  return `#${n.toString(16).padStart(6, "0")}`;
}

export function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Perceived luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#374151" : hex;
}

export const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";
