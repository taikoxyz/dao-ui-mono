import { MainSection } from "@/components/layout/main-section";
import {
  AlertCard,
  AlertVariant,
  Button,
  Heading,
  IAlertCardProps,
  IconType,
  Link,
  Toggle,
  ToggleGroup,
} from "@aragon/ods";
import { useState } from "react";
import { AddressText } from "@/components/text/address";
import { Else, ElseIf, If, Then } from "@/components/if";
import { AccountList } from "../components/AccountList";
import { useAccount } from "wagmi";
import { ADDRESS_ZERO, BYTES32_ZERO } from "@/utils/evm";
import { PleaseWaitSpinner } from "@/components/please-wait";
import { AccountEncryptionStatus, useAccountEncryptionStatus } from "../hooks/useAccountEncryptionStatus";
import { AppointDialog } from "@/plugins/security-council/components/AppointDialog";
import { useEncryptionRegistry } from "../hooks/useEncryptionRegistry";
import { useDerivedWallet } from "@/hooks/useDerivedWallet";
import { toHex } from "viem";
import { PUB_APP_NAME, PUB_PROJECT_URL } from "@/constants";
import { useSignerList } from "../hooks/useSignerList";
import { useMultisigSettings as useEmergencyMultisigSettings } from "@/plugins/emergency-multisig/hooks/useMultisigSettings";
import { NotFound } from "@/components/not-found";
import EmergencyProposalCreate from "../../emergency-multisig/pages/new";
import EmergencyProposalList from "../../emergency-multisig/pages/proposal-list";
import EmergencyProposalDetail from "../../emergency-multisig/pages/proposal";

import RegularProposalCreate from "../../multisig/pages/new";
import RegularProposalList from "../../multisig/pages/proposal-list";
import RegularProposalDetail from "../../multisig/pages/proposal";
import { useUrl } from "@/hooks/useUrl";
import { useCanCreateProposal } from "@/plugins/emergency-multisig/hooks/useCanCreateProposal";
import { useMultisigSettings } from "@/plugins/multisig/hooks/useMultisigSettings";

export default function EncryptionPage() {
  const [toggleValue, setToggleValue] = useState<"members" | "community-proposals" | "emergency-proposals">("members");
  const onToggleChange = (value: string | undefined) => {
    if (value) setToggleValue(value as "members" | "community-proposals" | "emergency-proposals");
  };
  const { hash } = useUrl();
  return (
    <MainSection>
      <div className="flex w-full max-w-[1280] flex-col gap-x-10 gap-y-8 lg:flex-row">
        <div className="flex flex-1 flex-col gap-y-6">
          <div className="flex items-start justify-between">
            <Heading size="h1">Security Council</Heading>

            <ToggleGroup
              isMultiSelect={false}
              onChange={onToggleChange}
              value={toggleValue}
              className="flex justify-end"
            >
              <Toggle value="members" label="Members" className="rounded-lg" />
              <Toggle value="community-proposals" label="Community Proposals" className="rounded-lg" />
              <Toggle value="emergency-proposals" label="Emergency Proposals" className="rounded-lg" />
            </ToggleGroup>
          </div>

          <If condition={toggleValue === "members"}>
            <Then>
              <AccountList />
            </Then>
            <ElseIf condition={toggleValue === "emergency-proposals"}>
              <Then>
                <EmergencyProposalList />
              </Then>
            </ElseIf>
            <ElseIf condition={toggleValue === "community-proposals"}>
              <Then>
                <RegularProposalList />
              </Then>
            </ElseIf>
            <Else>
              <p className="text-neutral-500">{toggleValue}</p>
            </Else>
          </If>
        </div>
        <AsideSection toggleValue={toggleValue} />
      </div>
    </MainSection>
  );
}

function AsideSection({ toggleValue }: { toggleValue: string }) {
  const { data: multisigMembers, isLoading: isLoadingMultisigMembers } = useSignerList();
  const { settings: emergencyMultisigSettings } = useEmergencyMultisigSettings();
  const { settings: multisigSettings } = useMultisigSettings();
  const { isConnected } = useAccount();
  const { canCreate } = useCanCreateProposal();

  return (
    <aside className="flex w-full flex-col gap-y-4 lg:max-w-[280px] lg:gap-y-6">
      <div className="flex flex-col gap-y-3">
        <If condition={toggleValue === "members"}>
          <Then>
            <Heading size="h3">Details</Heading>

            <p className="text-neutral-500">
            Security Council member accounts can create emergency proposals, however only externally owned addresses (EOA) have the ability to encrypt and decrypt confidential data.
            </p>
            <p className="text-neutral-500">
            The Security Council member account, which must be smart contract based accounts, must also appoint a separate EOA as an agent (“Agent Address”) in order to generate a public key for receiving encrypted payloads.
            </p>
            <p className="text-neutral-500">
            This section allows the Agent Address to register their public key.
            </p>

            <div className="flex flex-col gap-y-3">
              <Heading size="h3">Account status</Heading>
              <AccountStatus />
            </div>
          </Then>
          <ElseIf condition={toggleValue === "emergency-proposals"}>
            <Heading size="h3">Emergency Proposals</Heading>

            <p className="text-neutral-500">
              Emergency proposals require that both their description and actions remain encrypted until executed.
            </p>
            <If condition={isConnected && canCreate}>
              <Link href="/plugins/emergency-council/#/new">
                <Button iconLeft={IconType.PLUS} size="md" variant="primary">
                  Submit Emergency Proposal
                </Button>
              </Link>
            </If>
            <div className="divider" />
            <Heading size="h4">Voting Requirements</Heading>
            <p className="text-base leading-tight text-neutral-500">
              {emergencyMultisigSettings.minApprovals || "-"} out of {multisigMembers?.length || 0} approvals before
              execution
            </p>
          </ElseIf>
          <ElseIf condition={toggleValue === "community-proposals"}>
            <Heading size="h3">Proposals</Heading>
            <p className="text-neutral-500">
              Proposals are created by the Security Council. When its members approve one, the proposal is forwarded to
              the community veto phase for ratification.
            </p>

            <If condition={isConnected && canCreate}>
              <Link href="/plugins/taiko-council/#/new">
                <Button iconLeft={IconType.PLUS} size="md" variant="primary">
                  Submit Community Proposal
                </Button>
              </Link>
            </If>

            <div className="divider" />
            <Heading size="h4">Voting Requirements</Heading>
            <p className="text-base leading-tight text-neutral-500">
              {multisigSettings.minApprovals || "-"} out of {multisigMembers?.length || 0} before entering public
              optimistic stage
            </p>
          </ElseIf>
          <Else>
            <p className="text-neutral-500">{toggleValue}</p>
          </Else>
        </If>
      </div>

      <div className="flex flex-col items-baseline gap-y-2 py-3 lg:gap-x-6 lg:py-4">
        <dt className="line-clamp-1 shrink-0 text-lg leading-tight text-neutral-800 lg:line-clamp-6 lg:w-40">
          About {PUB_APP_NAME}
        </dt>
        <dd className="size-full text-base leading-tight text-neutral-500">
          <a href={PUB_PROJECT_URL} target="_blank" className="font-semibold text-primary-400 underline">
            Learn more about the project
          </a>
        </dd>
      </div>
    </aside>
  );
}

function AccountStatus() {
  let variant: AlertVariant = "warning";
  let title = "";
  let description = "";
  let actions: JSX.Element[] = [];
  const { address, isConnected } = useAccount();
  const { publicKey: derivedPublicKey } = useDerivedWallet();
  const { status, owner, appointedAgent, publicKey } = useAccountEncryptionStatus();
  const { registerPublicKey, isConfirming } = useEncryptionRegistry();
  const [showAppointModal, setShowAppointModal] = useState(false);

  if (!isConnected) {
    return <p>Connect your wallet to display the status</p>;
  } else if (status === AccountEncryptionStatus.LOADING_ENCRYPTION_STATUS) {
    return <PleaseWaitSpinner />;
  } else if (status === AccountEncryptionStatus.ERR_COULD_NOT_LOAD) {
    variant = "critical";
    title = "Error";
    description = "Could not load the account encryption status.";
  } else if (status === AccountEncryptionStatus.ERR_NOT_LISTED_OR_APPOINTED) {
    variant = "critical";
    title = "Not a member";
    description = "You are not listed as a signer or appointed by a signer.";
  } else if (status === AccountEncryptionStatus.ERR_APPOINTED_A_SMART_WALLET_CANNOT_GENERATE_PUBLIC_KEY) {
    variant = "critical";
    title = "Error";
    description = "You are appointed by a listed signer but smart wallets cannot register public keys.";
  } else if (status === AccountEncryptionStatus.WARN_APPOINTED_MUST_REGISTER_PUB_KEY) {
    title = "Warning";
    description = "The agent you appointed needs to define a public key.";
    actions = [
      <Button size="md" isLoading={isConfirming} variant="secondary" onClick={() => setShowAppointModal(true)}>
        Appoint a different agent
      </Button>,
    ];
  } else if (status === AccountEncryptionStatus.CTA_APPOINTED_MUST_REGISTER_PUB_KEY) {
    title = "Warning";
    description = "You are appointed by a signer but you have not defined your public key yet.";
    actions = [
      <Button size="md" isLoading={isConfirming} onClick={() => registerPublicKey("appointed")}>
        Define my public key
      </Button>,
    ];
  } else if (status === AccountEncryptionStatus.CTA_OWNER_MUST_APPOINT) {
    title = "Warning";
    description =
      "You are listed as a signer but you have not appointed an Externally Owned Account for decryption yet.";
    actions = [
      <Button size="md" isLoading={isConfirming} onClick={() => setShowAppointModal(true)}>
        Appoint an agent
      </Button>,
    ];
  } else if (status === AccountEncryptionStatus.CTA_OWNER_MUST_APPOINT_OR_REGISTER_PUB_KEY) {
    title = "Warning";
    description = "You are listed as a signer but you have not defined your public key or appointed an agent yet.";
    actions = [
      <Button size="md" isLoading={isConfirming} onClick={() => registerPublicKey("own")}>
        Define my public key
      </Button>,
      <Button size="md" isLoading={isConfirming} variant="secondary" onClick={() => setShowAppointModal(true)}>
        Appoint an agent
      </Button>,
    ];
  }

  if (title && description) {
    // Show an error, warning or call to action
    return (
      <>
        <AlertCard message={title} description={description} variant={variant} />
        {actions}

        {/* Modal */}
        <AppointDialog open={showAppointModal} onClose={() => setShowAppointModal(false)} />
      </>
    );
  }

  if (status === AccountEncryptionStatus.READY_CAN_CREATE || status === AccountEncryptionStatus.READY_ALL) {
    /*
    if (derivedPublicKey && toHex(derivedPublicKey) !== publicKey) {
      actions.push(
        <Button size="md" isLoading={isConfirming} variant="secondary" onClick={() => registerPublicKey("own")}>
          Update my public key
        </Button>
      );
    }*/

    if (owner === address) {
      actions.push(
        <Button size="md" isLoading={isConfirming} variant="secondary" onClick={() => setShowAppointModal(true)}>
          Appoint an agent
        </Button>
      );
    }
  }

  // Show status
  return (
    <>
      <dl className="divide-y divide-neutral-100">
        <div className="flex flex-col items-baseline gap-y-2 py-3 lg:gap-x-6 lg:py-4">
          <dt className="line-clamp-1 shrink-0 text-lg leading-tight text-neutral-800 lg:line-clamp-6 lg:w-40">
            Account owner
          </dt>
          <dd className="size-full text-base leading-tight text-neutral-500">
            <AddressText>{owner}</AddressText>
          </dd>
        </div>
        <div className="flex flex-col items-baseline gap-y-2 py-3 lg:gap-x-6 lg:py-4">
          <dt className="line-clamp-1 shrink-0 text-lg leading-tight text-neutral-800 lg:line-clamp-6 lg:w-40">
            Appointed agent
          </dt>
          <dd className="size-full text-base leading-tight text-neutral-500">
            <If condition={!appointedAgent || appointedAgent === ADDRESS_ZERO}>
              <Then>Acting by itself (no appointed agent)</Then>
              <Else>
                <AddressText>{appointedAgent}</AddressText>
              </Else>
            </If>
          </dd>
        </div>
        <div className="flex flex-col items-baseline gap-y-2 py-3 lg:gap-x-6 lg:py-4">
          <dt className="line-clamp-1 shrink-0 text-lg leading-tight text-neutral-800 lg:line-clamp-6 lg:w-40">
            Public key
          </dt>
          <dd className="size-full text-base leading-tight text-neutral-500">
            <If condition={!publicKey || publicKey === BYTES32_ZERO}>
              <Then>Not registered</Then>
              <Else>Registered</Else>
            </If>
          </dd>
        </div>
      </dl>
      <div className="flex flex-col gap-y-3">{actions}</div>

      {/* Modal */}
      <AppointDialog open={showAppointModal} onClose={() => setShowAppointModal(false)} />
    </>
  );
}

const ProposalView = ({ hash }: { hash: string }) => {
  const id = hash.replace("#/proposals/", "");
  return <EmergencyProposalDetail id={id} />;
};
