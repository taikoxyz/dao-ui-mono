import { ReactNode } from "react";
import { PleaseWaitSpinner } from "@/components/please-wait";
import { useWeb3Modal } from "@web3modal/wagmi/react";
import { useDerivedWallet } from "../../../hooks/useDerivedWallet";
import {
  AccountEncryptionStatus,
  useAccountEncryptionStatus,
} from "../../security-council/hooks/useAccountEncryptionStatus";
import { useAccount } from "wagmi";
import { CardEmptyState, IEmptyStateButton, IllustrationObjectType } from "@aragon/ods";
import { useRouter } from "next/router";

export const EncryptionPlaceholderOrChildren = ({
  children,
  needsPublicKey,
}: {
  children: ReactNode;
  needsPublicKey?: boolean;
}) => {
  const { open } = useWeb3Modal();
  const { push } = useRouter();
  const { address: selfAddress, isConnected } = useAccount();
  const { status } = useAccountEncryptionStatus(selfAddress);
  const { publicKey: derivedPublicKey, requestSignature } = useDerivedWallet();

  let title: string | undefined = undefined;
  let description: string | undefined = undefined;
  let object: IllustrationObjectType = "LABELS";
  let button: IEmptyStateButton | undefined = undefined;

  if (status === AccountEncryptionStatus.LOADING_ENCRYPTION_STATUS) {
    return <PleaseWaitSpinner fullMessage="Loading the signer public keys..." />;
  } else if (!isConnected) {
    title = "Connect your wallet";
    description = "Please, connect your wallet to continue with the Security Council proposals.";
    object = "WALLET";
    button = {
      label: "Connect wallet",
      onClick: () => open(),
    };
  } else if (status === AccountEncryptionStatus.ERR_COULD_NOT_LOAD) {
    title = "Could not load the account status";
    description = "Could not determine the status of the current account.";
    object = "ERROR";
    button = {
      label: "Reload",
      onClick: () => location.reload(),
    };
  } else if (status === AccountEncryptionStatus.ERR_NOT_LISTED_OR_APPOINTED) {
    title = "Not listed or appointed";
    description = "You are not currently listed as a Security Council signer or appointed by one.";
    object = "ERROR";
  } else if (status === AccountEncryptionStatus.ERR_APPOINTED_A_SMART_WALLET_CANNOT_GENERATE_PUBLIC_KEY) {
    title = "Smart wallets cannot be appointed as an agent";
    description =
      "You have appointed an agent that is a smart wallet. Emergency proposal decryption will not be possible until you appoint an agent that registers his public key.";
    object = "ERROR";
    button = {
      label: "Manage encryption",
      onClick: () => push("/plugins/security-council/"),
    };
  } else if (status === AccountEncryptionStatus.WARN_APPOINTED_MUST_REGISTER_PUB_KEY) {
    title = "Public key not registered";
    description =
      "The agent you appointed has not registered its public key yet. Emergency proposals cannot be decrypted by the appointed agent until this step is completed.";
    object = "ERROR";
  } else if (status === AccountEncryptionStatus.CTA_APPOINTED_MUST_REGISTER_PUB_KEY) {
    title = "Public key not registered";
    description =
      "You have not registered your public key yet. Emergency proposals cannot be decrypted until you complete this step.";
    object = "LABELS";
    button = {
      label: "Register public key",
      onClick: () => push("/plugins/security-council/"),
    };
  } else if (status === AccountEncryptionStatus.CTA_OWNER_MUST_APPOINT) {
    title = "You need to appoint an agent";
    description =
      "Security Council members need to register a public key in order to engage with both public and private (emergency) proposals. However, addresses behind a smart contract like yours cannot cryptographically sign or decrypt. You need to appoint an externally owned address that can work with cryptographic primitives, so that it can access and approve both public and private proposals.";
    object = "LABELS";
    button = {
      label: "Appoint an agent",
      onClick: () => push("/plugins/security-council/"),
    };
  } else if (status === AccountEncryptionStatus.CTA_OWNER_MUST_APPOINT_OR_REGISTER_PUB_KEY) {
    title = "Set up your encryption account";
    description =
      "Security Council members need to register a public key in order to engage with both public and private (emergency) proposals. You need to define your public key or appoint an externally owned address, so that your account can engage with both types of proposals.";
    object = "LABELS";
    button = {
      label: "Manage encryption",
      onClick: () => push("/plugins/security-council/"),
    };
  } else if (!derivedPublicKey?.length && needsPublicKey) {
    title = "Sign in to continue";
    description = "Please sign in with your wallet to decrypt the private proposal data.";
    object = "LABELS";
    button = {
      label: "Sign in",
      onClick: () => requestSignature(),
    };
  }

  // NOP:
  // - AccountEncryptionStatus.READY_CAN_CREATE
  // - AccountEncryptionStatus.READY_ALL

  if (!!title && !!description) {
    return (
      <CardEmptyState
        heading={title}
        description={description}
        objectIllustration={{
          object: object ?? "LABELS",
        }}
        primaryButton={button}
      />
    );
  }

  return children;
};
