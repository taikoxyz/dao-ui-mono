import { isAddressEqual, type Address } from "viem";
import { ProfileAside } from "../components/ProfileAside";
import { DelegationStatement } from "../components/DelegationStatement";
import { HeaderMember } from "../components/HeaderMember";
import { useDelegateAnnounce } from "../hooks/useDelegateAnnounce";
import { formatHexString } from "@/utils/evm";
import { GlinConfig } from "@/constants";
import { useEffect } from "react";
import { useProfanityChecker } from "glin-profanity";
import BannedDelegates from "@/data/banned-delegates.json";

export const DelegateProfile = ({ address }: { address: Address }) => {
  const { announce } = useDelegateAnnounce(address);
  const { result, checkText } = useProfanityChecker(GlinConfig);

  useEffect(() => {
    if (!announce) return;
    checkText(`${announce.identifier}\n${announce.bio}\n${announce.message}`);
  }, [announce]);

  if (BannedDelegates.findIndex((d) => isAddressEqual(d.address as Address, address)) >= 0) {
    return null;
  }
  return (
    <div className="flex flex-col items-center">
      {(!result || !result.containsProfanity) && (
        <HeaderMember address={address} name={announce?.identifier ?? formatHexString(address)} bio={announce?.bio} />
      )}
      <div className="flex w-full max-w-screen-xl flex-col gap-x-12 gap-y-12 px-4 py-6 md:flex-row md:px-16 md:pb-20">
        {/* Main section */}
        <div className="flex flex-col gap-y-12 md:w-[63%] md:gap-y-20">
          {/* Delegation Statement */}
          <div className="flex w-full flex-col gap-y-6 overflow-auto">
            {result && result.containsProfanity ? (
              "PROFILE MODERATED DUE TO PROFANITY"
            ) : (
              <DelegationStatement message={announce?.message} />
            )}
          </div>
        </div>
        {/* Aside */}
        <aside className="flex w-full flex-1 flex-col gap-y-12 md:max-w-[33%] md:gap-y-6">
          <ProfileAside address={address} resources={announce?.resources} />
        </aside>
      </div>
    </div>
  );
};
