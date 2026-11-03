import { useMutation } from "@tanstack/react-query";
import type { UploadedFile } from "../../domain";
import { ApiError, apiFetch } from "../client";
import type { UploadedFileDto } from "../dto";

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

export function useUploadFile(year: number) {
  return useMutation({
    mutationFn: async (file: File): Promise<UploadedFile> => {
      if (!ALLOWED_TYPES.includes(file.type)) throw new ApiError("file_type", 0);
      if (file.size > MAX_UPLOAD_BYTES) throw new ApiError("file_too_large", 0);
      const form = new FormData();
      form.append("file", file);
      const dto = await apiFetch<UploadedFileDto>(`/files?year=${year}`, { method: "POST", body: form });
      return { fileId: dto.fileId, name: dto.name, mediaType: dto.mediaType };
    },
  });
}
