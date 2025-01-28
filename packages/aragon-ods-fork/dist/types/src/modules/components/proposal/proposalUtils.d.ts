import type { TagVariant } from '../../../core';
export declare enum ProposalStatus {
    ACCEPTED = "ACCEPTED",
    ACTIVE = "ACTIVE",
    CHALLENGED = "CHALLENGED",
    DRAFT = "DRAFT",
    EXECUTED = "EXECUTED",
    EXPIRED = "EXPIRED",
    FAILED = "FAILED",
    PARTIALLY_EXECUTED = "PARTIALLY_EXECUTED",
    PENDING = "PENDING",
    EXECUTABLE = "EXECUTABLE",
    REJECTED = "REJECTED",
    VETOED = "VETOED"
}
export declare enum ProposalVotingStatus {
    ACTIVE = "ACTIVE",
    PENDING = "PENDING",
    ACCEPTED = "ACCEPTED",
    REJECTED = "REJECTED",
    UNREACHED = "UNREACHED"
}
export declare const proposalStatusToVotingStatus: Record<ProposalStatus, ProposalVotingStatus>;
export declare const proposalStatusToTagVariant: Record<ProposalStatus, TagVariant>;
