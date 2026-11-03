import { useTranslation } from "react-i18next";
import type { Approval } from "../../../domain";
import { Button } from "../../../ui/atoms";
import { Card } from "../../../ui/organisms";

export interface ApprovalCardProps {
  approval: Approval;
  onApprove(): void;
  onDeny(): void;
  disabled?: boolean;
}

export function ApprovalCard({ approval, onApprove, onDeny, disabled }: ApprovalCardProps) {
  const { t } = useTranslation("common");
  return (
    <Card
      tone="warning"
      data-approval-id={approval.approvalId}
      header={<h3>{t("chat.approval.title")}</h3>}
      actions={
        <>
          <Button tone="neutral" disabled={disabled} onClick={onDeny}>
            {t("chat.approval.deny")}
          </Button>
          <Button tone="primary" disabled={disabled} onClick={onApprove}>
            {t("chat.approval.approve")}
          </Button>
        </>
      }
    >
      <p>{t("chat.approval.body")}</p>
    </Card>
  );
}
