import { useState } from "react";
import { CardEmptyState, DataList } from "@aragon/ods";
import { AccountListItemPending, AccountListItemReady } from "./AccountListItem";
import { PleaseWaitSpinner } from "@/components/please-wait";
import { PUB_CHAIN } from "@/constants";
import { useSignerList } from "@/plugins/security-council/hooks/useSignerList";
import { useEncryptionAccounts } from "../hooks/useEncryptionAccounts";
import { BYTES32_ZERO } from "@/utils/evm";
import SecurityCouncilProfiles from "../../../security-council-profiles.json";
import { Address, isAddressEqual } from "viem";

interface IAccountListProps {}

export const AccountList: React.FC<IAccountListProps> = ({}) => {
  const [searchValue, setSearchValue] = useState<string>();
  const { data: accounts, isLoading: isLoading1 } = useSignerList();
  const { data: encryptionAccounts, isLoading: isLoading2, error } = useEncryptionAccounts();

  if (!encryptionAccounts || !accounts || isLoading1 || isLoading2) {
    return <PleaseWaitSpinner fullMessage="Please wait, loading accounts" />;
  } else if (!encryptionAccounts.length) {
    if (error) return <NoSignersView title="Could not fetch" message={error?.message} />;
    return (
      <NoSignersView
        title="No signers registered"
        message="There are no signers registered on the Encryption Registry. Be the first one to register a public key or appoint an agent that uses an EOA."
      />
    );
  }
  

  return (
    <DataList.Root entityLabel={accounts.length === 1 ? "account" : "accounts"} itemsCount={accounts.length}>
      <DataList.Filter onSearchValueChange={setSearchValue} searchValue={searchValue} placeholder="Filter by address" />
      <DataList.Container className="grid grid-cols-[repeat(auto-fill,_minmax(200px,_1fr))] gap-5">
        {accounts
          .filter((acc) => {
            const profile = SecurityCouncilProfiles.find((profile) => isAddressEqual(profile.address as Address, acc));
            return (
              !searchValue ||
              acc.toLowerCase().includes(searchValue.toLowerCase()) ||
              profile?.name.toLowerCase().includes(searchValue.toLowerCase()) ||
              profile?.description.toLowerCase().includes(searchValue.toLowerCase())
            );
          })
          .map((account) => {
            const eAcc = encryptionAccounts.find((a) => a.owner === account);

            if (!eAcc || !eAcc.publicKey || eAcc.publicKey === BYTES32_ZERO) {
              return (
                <AccountListItemPending
                  key={account}
                  href={`${PUB_CHAIN.blockExplorers?.default.url}/address/${account}`}
                  target="_blank"
                  owner={account}
                  appointedAgent={eAcc?.appointedAgent}
                  publicKey={eAcc?.publicKey}
                />
              );
            }

            return (
              <AccountListItemReady
                key={account}
                owner={account}
                appointedAgent={eAcc?.appointedAgent}
                publicKey={eAcc?.publicKey}
              />
            );
          })
          .sort((a, b) => {
            const _a = SecurityCouncilProfiles.findIndex((profile) =>
              isAddressEqual(profile.address as Address, a.props.owner)
            );
            const _b = SecurityCouncilProfiles.findIndex((profile) =>
              isAddressEqual(profile.address as Address, b.props.owner)
            );
            return _a - _b;
          })}
      </DataList.Container>
      {/* <DataList.Pagination /> */}
    </DataList.Root>
  );
};

function NoSignersView({ message, title }: { message: string; title: string }) {
  return (
    <CardEmptyState
      description={message}
      heading={title}
      objectIllustration={{
        object: "LABELS",
      }}
    />
  );
}
