/**
 * Object representing the structure of copy texts used in various parts of the ODS Modules package.
 * Each property in the object corresponds to a specific component or feature, containing the necessary
 * text labels or functions that return text strings.
 */
export declare const modulesCopy: {
    addressInput: {
        clear: string;
        paste: string;
    };
    assetDataListItemStructure: {
        unknown: string;
    };
    memberDataListItemStructure: {
        yourDelegate: string;
        you: string;
        delegations: string;
        votingPower: string;
    };
    approvalThresholdResult: {
        stage: string;
        outOf: (threshold: string) => string;
    };
    majorityVotingResult: {
        winningOption: string;
        stage: string;
    };
    proposalActionsContainer: {
        containerName: string;
        collapse: string;
        expand: string;
    };
    proposalActionsAction: {
        notVerified: string;
        nativeSendAlert: string;
        nativeSendDescription: (amount: string) => string;
    };
    proposalActionsActionDecodedView: {
        valueHelper: string;
        valueLabel: string;
    };
    proposalActionsActionRawView: {
        to: string;
        data: string;
        value: string;
        copyButton: string;
    };
    proposalActionsActionViewAsMenu: {
        basic: string;
        dropdownLabel: string;
        decoded: string;
        raw: string;
    };
    proposalActionChangeMembers: {
        summary: string;
        added: string;
        removed: string;
        members: string;
        adjustMemberCount: {
            addMembers: string;
            removeMembers: string;
        };
        existingMembers: string;
        blockNote: string;
    };
    proposalActionsChangeSettings: {
        existingToggle: string;
        proposedToggle: string;
    };
    proposalActionsUpdateMetadata: {
        logoTerm: string;
        nameTerm: string;
        linkTerm: string;
        descriptionTerm: string;
        existingToggle: string;
        proposedToggle: string;
    };
    proposalActionsTokenMint: {
        summaryHeading: string;
        newTokensTerm: string;
        newHoldersTerm: string;
        totalTokenSupplyTerm: string;
        totalHoldersTerm: string;
    };
    proposalDataListItemStatus: {
        voted: string;
        ago: string;
        left: string;
        statusLabel: {
            ACCEPTED: string;
            ACTIVE: string;
            CHALLENGED: string;
            DRAFT: string;
            EXECUTED: string;
            EXPIRED: string;
            FAILED: string;
            PARTIALLY_EXECUTED: string;
            PENDING: string;
            EXECUTABLE: string;
            REJECTED: string;
            VETOED: string;
        };
    };
    proposalDataListItemStructure: {
        by: string;
        creators: string;
    };
    proposalVotingTabs: {
        breakdown: string;
        votes: string;
        details: string;
    };
    proposalVotingBreakdownMultisig: {
        name: string;
        description: (count: string | null) => string;
    };
    proposalVotingBreakdownToken: {
        option: {
            yes: string;
            no: string;
            abstain: string;
        };
        support: {
            name: string;
            description: (value: string) => string;
        };
        minParticipation: {
            name: string;
            description: (value: string) => string;
        };
    };
    proposalVotingStageStatus: {
        main: {
            proposal: string;
            stage: string;
        };
        secondary: {
            pending: string;
            active: string;
            accepted: string;
            rejected: string;
            unreached: string;
        };
        status: {
            accepted: string;
            rejected: string;
        };
    };
    proposalVotingDetails: {
        voting: string;
        governance: string;
    };
    proposalVotingStage: {
        stage: (index: number) => string;
    };
    voteDataListItemStructure: {
        yourDelegate: string;
        you: string;
    };
    voteProposalDataListItemStructure: {
        voted: string;
    };
    wallet: {
        connect: string;
    };
};
export type ModulesCopy = typeof modulesCopy;
