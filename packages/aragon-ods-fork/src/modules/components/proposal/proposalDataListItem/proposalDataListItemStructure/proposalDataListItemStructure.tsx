import classNames from 'classnames';
import { DataList, Tag } from '../../../../../core';
import { ApprovalThresholdResult } from '../approvalThresholdResult';
import { MajorityVotingResult } from '../majorityVotingResult';
import { ProposalDataListItemStatus } from '../proposalDataListItemStatus';
import { proposalDataListItemUtils } from '../proposalDataListItemUtils';
import { type IProposalDataListItemStructureProps } from './proposalDataListItemStructure.api';
import { useAccount } from 'wagmi';
import { useOdsModulesContext } from '../../../odsModulesProvider';
import { addressUtils } from '../../../../utils/addressUtils';

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
    const { address } = useAccount();
    const { copy } = useOdsModulesContext();

    const publishers = Array.isArray(publisher) ? publisher : [publisher];
    const showCreatorsOverflow = publishers.length > maxPublishersDisplayed;
    const visiblePublishers = publishers.slice(0, maxPublishersDisplayed);

    const getPublisherLabel = (publisherItem: (typeof publishers)[number]) => {
        if (address && addressUtils.isAddressEqual(address, publisherItem.address)) {
            return 'You';
        }

        return publisherItem.name ?? addressUtils.truncateAddress(publisherItem.address);
    };

    return (
        <DataList.Item className={classNames('flex flex-col gap-y-4', className)} {...otherProps}>
            <ProposalDataListItemStatus date={date} status={status} voted={voted} />
            {tag && (
                <div>
                    <Tag label={tag} variant="neutral" />
                </div>
            )}
            <div className="flex flex-col gap-y-1">
                <p className="flex gap-x-3 text-lg leading-tight md:text-2xl">
                    {id && <span className="shrink-0 text-neutral-500">{id}</span>}
                    <span className="line-clamp-1 text-neutral-800">{title}</span>
                </p>
                <p className="line-clamp-2 leading-normal text-neutral-500 md:text-lg">{summary}</p>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 text-sm text-neutral-500">
                <span>{copy.proposalDataListItemStructure.by}</span>
                {showCreatorsOverflow ? (
                    <span>{`${maxPublishersDisplayed}+ ${copy.proposalDataListItemStructure.creators}`}</span>
                ) : (
                    visiblePublishers.map((publisherItem, index) => {
                        const label = getPublisherLabel(publisherItem);
                        const content = publisherItem.link ? (
                            <a
                                href={publisherItem.link}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary-400 underline"
                            >
                                {label}
                            </a>
                        ) : (
                            <span>{label}</span>
                        );

                        return (
                            <span key={`${publisherItem.address}-${index}`} className="inline-flex items-center gap-x-1">
                                {content}
                                {index < visiblePublishers.length - 1 && <span>,</span>}
                            </span>
                        );
                    })
                )}
            </div>

            {isOngoing && type === 'approvalThreshold' && result && <ApprovalThresholdResult {...result} />}

            {isOngoing && type === 'majorityVoting' && result && <MajorityVotingResult {...result} />}
        </DataList.Item>
    );
};
