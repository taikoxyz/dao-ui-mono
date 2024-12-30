import { Else, If, Then } from "@/components/if";
import { formatHexString, equalAddresses, ADDRESS_ZERO } from "@/utils/evm";
import { type IDataListItemProps, DataList, MemberAvatar, Tag } from "@aragon/ods";
import { useAccount } from "wagmi";
import { Address, Hex } from "viem";
import { AccountEncryptionStatus, useAccountEncryptionStatus } from "../hooks/useAccountEncryptionStatus";
import { AddressText } from "@/components/text/address";
import SecurityCouncilProfiles from "../../../security-council-profiles.json";

export interface IAccountListItemProps extends IDataListItemProps {
  /** 0x address of the account owner */
  owner: Address;
  /** Address of the EOA appointed (if any) */
  appointedAgent?: Address;
  /** The public key of the appointed agent */
  publicKey?: Hex;
  /** Direct URL src of the user avatar image to be rendered */
  avatarSrc?: string;
}

export const AccountListItemReady: React.FC<IAccountListItemProps> = (props) => {
  const { avatarSrc, owner, appointedAgent, publicKey, ...otherProps } = props;
  const { address: currentUserAddress, isConnected } = useAccount();
  const isCurrentUser = isConnected && owner && equalAddresses(currentUserAddress, owner);
  const selfAppointed = !appointedAgent || equalAddresses(appointedAgent, ADDRESS_ZERO);
  const profile = SecurityCouncilProfiles.find((profile) => equalAddresses(profile.address, owner));

  return (
    <DataList.Item className="min-w-fit !py-0 px-4 md:px-6" {...otherProps}>
      <div className="flex flex-col items-start justify-center gap-y-3 py-4 md:min-w-44 md:py-6">
        <div className="flex w-full items-center justify-between">
          <MemberAvatar address={owner} avatarSrc={avatarSrc} responsiveSize={{ md: "md" }} />
          <If condition={isCurrentUser}>
            <Then>
              <Tag variant="success" label="You" />
            </Then>
            <Else>
              <Tag variant="success" label="Signer" />
            </Else>
          </If>
        </div>

        <p className="inline-block w-full text-lg text-neutral-800 md:text-xl">{profile?.name}</p>
        <p className="inline-block w-full truncate text-sm text-neutral-400">{formatHexString(owner)}</p>
        <p className="inline-block w-full text-sm text-success-500">
          <If condition={selfAppointed}>
            <Then>The owner can decrypt emergency proposals</Then>
            <Else>Appointed: {appointedAgent === currentUserAddress ? "You" : formatHexString(appointedAgent)}</Else>
          </If>
        </p>
        <div className="text-md w-full text-neutral-400">{profile?.description}</div>
      </div>
    </DataList.Item>
  );
};

export const AccountListItemPending: React.FC<IAccountListItemProps> = (props) => {
  const { avatarSrc, owner, appointedAgent, publicKey, ...otherProps } = props;
  const { address: currentUserAddress, isConnected } = useAccount();
  const isCurrentUser = isConnected && owner && equalAddresses(currentUserAddress, owner);
  const { status } = useAccountEncryptionStatus(owner);
  const profile = SecurityCouncilProfiles.find((profile) => equalAddresses(profile.address, owner));

  let comment = "";
  switch (status) {
    case AccountEncryptionStatus.LOADING_ENCRYPTION_STATUS:
      comment = "Loading status";
      break;
    case AccountEncryptionStatus.ERR_COULD_NOT_LOAD:
      comment = "Cannot load status";
      break;
    // case AccountEncryptionStatus.ERR_NOT_LISTED_OR_APPOINTED:
    case AccountEncryptionStatus.ERR_APPOINTED_A_SMART_WALLET_CANNOT_GENERATE_PUBLIC_KEY:
      comment = "The owner cannot define a public key as a smart wallet";
      break;
    case AccountEncryptionStatus.WARN_APPOINTED_MUST_REGISTER_PUB_KEY:
    case AccountEncryptionStatus.CTA_APPOINTED_MUST_REGISTER_PUB_KEY:
      comment = "No public key defined";
      break;
    case AccountEncryptionStatus.CTA_OWNER_MUST_APPOINT:
      comment = "The owner needs to appoint an agent";
      break;
    case AccountEncryptionStatus.CTA_OWNER_MUST_APPOINT_OR_REGISTER_PUB_KEY:
      comment = "The owner needs to define a public key or appoint an agent";
      break;
    // case AccountEncryptionStatus.READY_CAN_CREATE:
    // case AccountEncryptionStatus.READY_ALL:
  }

  return (
    <DataList.Item className="min-w-fit !py-0 px-4 md:px-6" {...otherProps}>
      <div className="flex flex-col items-start justify-center gap-y-3 py-4 md:min-w-44 md:py-6">
        <div className="flex w-full items-center justify-between">
          <MemberAvatar address={owner} avatarSrc={avatarSrc} responsiveSize={{ md: "md" }} />
          <If condition={isCurrentUser}>
            <Then>
              <Tag variant="warning" label="You" />
            </Then>
            <Else>
              <Tag variant="warning" label="Signer" />
            </Else>
          </If>
        </div>
        <p className="inline-block w-full text-lg text-neutral-800 md:text-xl">{profile?.name}</p>
        <p className="inline-block w-full truncate text-sm text-neutral-400">{formatHexString(owner)}</p>
        <If condition={!!appointedAgent && appointedAgent !== ADDRESS_ZERO}>
          <p className="inline-block w-full text-sm text-neutral-400">
            Appointed: {appointedAgent === currentUserAddress ? "You" : <AddressText>{appointedAgent}</AddressText>}
          </p>
        </If>
        <If condition={!!comment}>
          <p className="inline-block w-full text-sm text-primary-300">{comment}</p>
        </If>
        <div className="text-md w-full text-neutral-400">{profile?.description}</div>
      </div>
    </DataList.Item>
  );
};
