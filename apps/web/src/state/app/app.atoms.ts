import { atom } from "jotai";

/** Selected tax year; null until the page picks the first year from /api/health. */
export const selectedYearAtom = atom<number | null>(null);
