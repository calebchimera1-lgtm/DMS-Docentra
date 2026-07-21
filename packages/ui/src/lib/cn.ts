import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind class names, resolving conflicts (last one wins). Shared by every shadcn/ui-based component. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
