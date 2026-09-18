import { useState } from "react";
import { AlertInline, CardEmptyState, DataList } from "@aragon/ods";
import { AccountListItemPending, AccountListItemReady } from "./AccountListItem";
import { PleaseWaitSpinner } from "@/components/please-wait";
import { PUB_CHAIN } from "@/constants";
import { useSignerList } from "@/plugins/security-council/hooks/useSignerList";
import { useEncryptionAccounts } from "../hooks/useEncryptionAccounts";
import { BYTES32_ZERO } from "@/utils/evm";
import SecurityCouncilProfiles from "@/data/security-council-profiles.json";
import { Address, isAddressEqual } from "viem";

export const AccountList: React.FC = () => {
  const [searchValue, setSearchValue] = useState<string>();
  const { data: accounts, isLoading: isLoadingSigners, error: signerListError } = useSignerList();
  const { data: encryptionAccounts, error: encryptionError } = useEncryptionAccounts();

  // The signer list now surfaces subgraph failures instead of silently
  // resolving to []; without this the spinner below would never resolve.
  if (signerListError) {
    return <NoSignersView title="Could not fetch" message={signerListError.message} />;
  }

  if (!accounts || isLoadingSigners) {
    return <PleaseWaitSpinner fullMessage="Please wait, loading accounts" />;
  } else if (!accounts.length) {
    return (
      <NoSignersView
        title="No signers registered"
        message="There are no members listed in the Security Council roster."
      />
    );
  }

  // Keep members mounted while keys load or fail. Pending rows show the key
  // query's loading/error status; a failed refetch must not reuse stale keys.
  const registry = encryptionError ? [] : (encryptionAccounts ?? []);

  return (
    <DataList.Root entityLabel={accounts.length === 1 ? "account" : "accounts"} itemsCount={accounts.length}>
      {encryptionError && (
        <AlertInline variant="warning" message="Could not load encryption keys. Member key status is unavailable." />
      )}
      <DataList.Filter onSearchValueChange={setSearchValue} searchValue={searchValue} placeholder="Filter by address" />
      <DataList.Container className="grid grid-cols-[repeat(auto-fill,_minmax(200px,_1fr))] gap-5">
        {accounts
          .filter((acc: Address) => {
            const profile = SecurityCouncilProfiles.find((profile) => isAddressEqual(profile.address as Address, acc));
            return (
              !searchValue ||
              acc.toLowerCase().includes(searchValue.toLowerCase()) ||
              (profile?.name.toLowerCase().includes(searchValue.toLowerCase()) ??
                profile?.description.toLowerCase().includes(searchValue.toLowerCase()))
            );
          })
          .map((account: Address) => {
            const eAcc = registry.find((a) => isAddressEqual(a.owner, account));
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
