import { FC } from "react";
import { Card, Tag, Icon, IconType } from "@aragon/ods";
import dayjs from "dayjs";

interface SecurityCouncilStageProps {
  status: 'pending' | 'approved' | 'rejected' | 'executed';
  approvals?: number;
  requiredApprovals?: number;
  createdAt?: number;
  approvedAt?: number;
  isEmergency?: boolean;
}

export const SecurityCouncilStage: FC<SecurityCouncilStageProps> = ({
  status,
  approvals = 0,
  requiredApprovals = 5,
  createdAt,
  approvedAt,
  isEmergency = false,
}) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'approved':
      case 'executed':
        return <Icon icon={IconType.CHECKMARK} size="md" className="text-success-600" />;
      case 'rejected':
        return <Icon icon={IconType.CLOSE} size="md" className="text-critical-600" />;
      default:
        return <Icon icon={IconType.CLOCK} size="md" className="text-primary-600" />;
    }
  };

  const getStatusTag = () => {
    switch (status) {
      case 'approved':
        return <Tag variant="success" label="Approved by Council" />;
      case 'rejected':
        return <Tag variant="critical" label="Rejected by Council" />;
      case 'executed':
        return <Tag variant="neutral" label="Executed" />;
      default:
        return <Tag variant="primary" label="Awaiting Council" />;
    }
  };

  const getStatusMessage = () => {
    if (status === 'approved') {
      return `Approved by ${approvals} of ${requiredApprovals} Security Council members`;
    } else if (status === 'pending') {
      return `${approvals} of ${requiredApprovals} approvals received`;
    } else if (status === 'rejected') {
      return 'Rejected by Security Council';
    } else {
      return 'Proposal has been executed';
    }
  };

  const progressPercentage = (approvals / requiredApprovals) * 100;

  return (
    <Card className="overflow-hidden">
      {/* Header with clear distinction */}
      <div className="bg-neutral-50 border-b border-neutral-100 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h3 className="text-base font-semibold text-neutral-900">
                Security Council {isEmergency ? 'Emergency' : 'Standard'} Approval
              </h3>
              <p className="text-sm text-neutral-600">
                {isEmergency ? 'Emergency proposal approval' : 'Initial governance approval'}
              </p>
            </div>
          </div>
          {getStatusTag()}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="flex flex-col gap-4">
          {/* Status indicator */}
          <div className="flex items-start gap-3">
            {getStatusIcon()}
            <div className="flex-1">
              <p className="text-sm font-medium text-neutral-800">{getStatusMessage()}</p>
              {createdAt && (
                <p className="text-xs text-neutral-500 mt-1">
                  Created {dayjs(createdAt).format('MMM D, YYYY HH:mm')}
                </p>
              )}
              {approvedAt && status === 'approved' && (
                <p className="text-xs text-neutral-500 mt-1">
                  Approved {dayjs(approvedAt).format('MMM D, YYYY HH:mm')}
                </p>
              )}
            </div>
          </div>

          {/* Progress bar for pending proposals */}
          {status === 'pending' && (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs text-neutral-600">
                <span>Progress</span>
                <span>{approvals} / {requiredApprovals}</span>
              </div>
              <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary-500 transition-all duration-300"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          )}

        </div>
      </div>
    </Card>
  );
};