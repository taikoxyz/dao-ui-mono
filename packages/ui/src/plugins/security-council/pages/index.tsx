import { MainSection } from "@/components/layout/main-section";
import { AlertCard, AlertVariant, Button, Heading, IconType, Link, Toggle, ToggleGroup } from "@aragon/ods";
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
import { PUB_APP_NAME, PUB_PROJECT_URL } from "@/constants";
import EmergencyProposalList from "../../emergency-multisig/pages/proposal-list";

import RegularProposalList from "../../multisig/pages/proposal-list";
import { useCanCreateProposal } from "@/plugins/emergency-multisig/hooks/useCanCreateProposal";

export default function EncryptionPage() {
  const [toggleValue, setToggleValue] = useState<"members" | "community-proposals" | "emergency-proposals">("members");
  const onToggleChange = (value: string | undefined) => {
    if (value) setToggleValue(value as "members" | "community-proposals" | "emergency-proposals");
  };

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
              <Toggle value="community-proposals" label="Standard Proposals" className="rounded-lg" />
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
  const { isConnected } = useAccount();
  const { canCreate } = useCanCreateProposal();

  return (
    <aside className="flex w-full flex-col gap-y-4 lg:max-w-[280px] lg:gap-y-6">
      <div className="flex flex-col gap-y-3">
        <If condition={toggleValue === "members"}>
          <Then>
            <Heading size="h3">Details</Heading>

            <p className="text-neutral-500">
              Security Council member accounts can create Standard and Emergency Proposals, however only externally
              owned addresses (EOA) have the ability to encrypt and decrypt confidential data. The Security Council
              member accounts are required to be smart contract based, and must appoint a separate EOA as an agent
              (“Agent Address”)
            </p>
            <p className="text-neutral-500">
              This section allows the Agent Address to register and generate a public key in order to receive encrypted
              payloads related to Emergency Proposals.
            </p>

            <div className="flex flex-col gap-y-3">
              <Heading size="h3">Account status</Heading>
              <AccountStatus />
            </div>
          </Then>
          <ElseIf condition={toggleValue === "emergency-proposals"}>
            <Heading size="h3">Emergency Proposals</Heading>

            <p className="text-neutral-500">
              Emergency Proposals are created by the Security Council and are passed immediately after satisfying the
              voting requirements. Emergency Proposals require that their contents remain encrypted until executed.{" "}
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
            <ul className="list-inside list-disc">
              <li>Approved by the lesser of at least 6 or 75% of Security Council Members</li>
            </ul>
          </ElseIf>
          <ElseIf condition={toggleValue === "community-proposals"}>
            <Heading size="h3">Standard Proposals</Heading>
            <p className="text-neutral-500">
              Standard Proposals are created by the Security Council. Following approval by the Security Council
              Members, the proposal is open to a 9 day public voting period and passed if not vetoed.
            </p>

            <If condition={isConnected && canCreate}>
              <Link href="/plugins/taiko-council/#/new">
                <Button iconLeft={IconType.PLUS} size="md" variant="primary">
                  Submit Standard Proposal
                </Button>
              </Link>
            </If>

            <div className="divider" />
            <Heading size="h4">Voting Requirements</Heading>
            <ul className="list-inside list-disc">
              <li>
                Approved by the lesser of at least 5 or 62.5% of Security Council Members, prior to entering a 21 day
                public voting period
              </li>
              <li>10% of community votes are required to veto a Standard Proposal</li>
              <li>Standard Proposal are passed if there is no veto within the public voting period</li>
            </ul>
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
  let actions: React.ReactNode[] = [];
  const { address, isConnected } = useAccount();
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
      <Button key="0" size="md" isLoading={isConfirming} variant="secondary" onClick={() => setShowAppointModal(true)}>
        Appoint a different agent
      </Button>,
    ];
  } else if (status === AccountEncryptionStatus.CTA_APPOINTED_MUST_REGISTER_PUB_KEY) {
    title = "Warning";
    description = "You are appointed by a signer but you have not defined your public key yet.";
    actions = [
      <Button key="0" size="md" isLoading={isConfirming} onClick={() => registerPublicKey("appointed")}>
        Define my public key
      </Button>,
    ];
  } else if (status === AccountEncryptionStatus.CTA_OWNER_MUST_APPOINT) {
    title = "Warning";
    description =
      "You are listed as a signer but you have not appointed an Externally Owned Account for decryption yet.";
    actions = [
      <Button key="0" size="md" isLoading={isConfirming} onClick={() => setShowAppointModal(true)}>
        Appoint an agent
      </Button>,
    ];
  } else if (status === AccountEncryptionStatus.CTA_OWNER_MUST_APPOINT_OR_REGISTER_PUB_KEY) {
    title = "Warning";
    description = "You are listed as a signer but you have not defined your public key or appointed an agent yet.";
    actions = [
      <Button key="0" size="md" isLoading={isConfirming} onClick={() => registerPublicKey("own")}>
        Define my public key
      </Button>,
      <Button key="1" size="md" isLoading={isConfirming} variant="secondary" onClick={() => setShowAppointModal(true)}>
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
