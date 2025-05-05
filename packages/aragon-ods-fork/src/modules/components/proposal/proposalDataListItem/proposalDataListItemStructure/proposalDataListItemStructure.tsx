import classNames from 'classnames';
import { DataList } from '../../../../../core';
import { ApprovalThresholdResult } from '../approvalThresholdResult';
import { MajorityVotingResult } from '../majorityVotingResult';
import { ProposalDataListItemStatus } from '../proposalDataListItemStatus';
import { proposalDataListItemUtils } from '../proposalDataListItemUtils';
import { type IProposalDataListItemStructureProps } from './proposalDataListItemStructure.api';

export const maxPublishersDisplayed = 3;

/**
 * `ProposalDataListItemStructure` module component
 */
export const ProposalDataListItemStructure: React.FC<IProposalDataListItemStructureProps> = (props) => {
    const {
        wagmiConfig: config,
        chainId,
        id,
        className,
        type,
        result,
        date,
        tag,
        publisher,
        status,
        summary,
        title,
        voted,
        ...otherProps
    } = props;

    const isOngoing = proposalDataListItemUtils.isOngoingStatus(status);

    return (
        <DataList.Item className={classNames('flex flex-col gap-y-4', className)} {...otherProps}>
            <ProposalDataListItemStatus date={date} status={status} voted={voted} />
            <div className="flex flex-col gap-y-1">
                <p className="flex gap-x-3 text-lg leading-tight md:text-2xl">
                    {id && <span className="shrink-0 text-neutral-500">{id}</span>}
                    <span className="line-clamp-1 text-neutral-800">{title}</span>
                </p>
                <p className="line-clamp-2 leading-normal text-neutral-500 md:text-lg">{summary}</p>
            </div>

            {isOngoing && type === 'approvalThreshold' && result && <ApprovalThresholdResult {...result} />}

            {isOngoing && type === 'majorityVoting' && result && <MajorityVotingResult {...result} />}
        </DataList.Item>
    );
};
