import { useTranslation } from "react-i18next";
import type { ChatPart } from "../../../domain";
import { Notice } from "../../../ui/molecules";

export interface ToolErrorNoticeProps {
  part: ChatPart & { kind: "toolError" };
}

export function ToolErrorNotice({ part }: ToolErrorNoticeProps) {
  const { t } = useTranslation("common");
  return (
    <Notice tone="danger">
      <p>{part.message}</p>
      <small>{t("chat.tool.errorCode", { code: part.code })}</small>
    </Notice>
  );
}
