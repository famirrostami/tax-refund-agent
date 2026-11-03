import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../client";
import type { HealthDto } from "../dto";

export const healthKeys = { all: ["health"] as const };

export function useHealth() {
  return useQuery({
    queryKey: healthKeys.all,
    queryFn: () => apiFetch<HealthDto>("/health"),
    select: (dto) => ({ country: dto.country, years: dto.years }),
  });
}
