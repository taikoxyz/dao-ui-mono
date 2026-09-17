import { useState } from "react";
import { CardEmptyState, DataList } from "@aragon/ods";
import { AccountListItemPending, AccountListItemReady } from "./AccountListItem";
import { PleaseWaitSpinner } from "@/components/please-wait";
import { PUB_CHAIN } from "@/constants";
import { useSignerList } from "@/plugins/security-council/hooks/useSignerList";
import { useEncryptionAccounts } from "../hooks/useEncryptionAccounts";
import { BYTES32_ZERO } from "@/utils/evm";
import { Address, isAddressEqual } from "viem";
import {
  compareSecurityCouncilAddresses,
  securityCouncilProfileMatchesQuery,
} from "@/utils/getSecurityCouncilMemberData";

export const AccountList: React.FC = () => {
  const [searchValue, setSearchValue] = useState<string>();
  const { data: accounts, isLoading: isLoadingSigners, error: signerListError } = useSignerList();
  const { data: encryptionAccounts, isLoading: isLoadingEncryption, error: encryptionError } = useEncryptionAccounts();

  if (signerListError) {
    return <NoSignersView title="Could not fetch" message={signerListError.message} />;
  }

  if (isLoadingSigners || isLoadingEncryption || !accounts) {
    return <PleaseWaitSpinner fullMessage="Please wait, loading accounts" />;
  }

  if (!accounts.length) {
    if (encryptionError) return <NoSignersView title="Could not fetch" message={encryptionError.message} />;
    return <NoSignersView title="No signers registered" message="There are no signers listed on SignerList yet." />;
  }

  const registry = encryptionAccounts ?? [];

  return (
    <DataList.Root entityLabel={accounts.length === 1 ? "account" : "accounts"} itemsCount={accounts.length}>
      <DataList.Filter onSearchValueChange={setSearchValue} searchValue={searchValue} placeholder="Filter by address" />
      <DataList.Container className="grid grid-cols-[repeat(auto-fill,_minmax(200px,_1fr))] gap-5">
        {accounts
          .filter((acc: Address) => securityCouncilProfileMatchesQuery(acc, searchValue))
          .sort(compareSecurityCouncilAddresses)
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
