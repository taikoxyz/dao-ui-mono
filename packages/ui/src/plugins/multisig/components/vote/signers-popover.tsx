import { FC, useEffect, useMemo, useRef, useState } from "react";
import { Icon, IconType, MemberAvatar } from "@aragon/ods";
import { isAddressEqual, type Address } from "viem";
import { useAccount } from "wagmi";
import { PUB_CHAIN } from "@/constants";
import { formatHexString } from "@/utils/evm";
import { useSignerList } from "@/plugins/security-council/hooks/useSignerList";
import type { IVote } from "@/utils/types";

interface SignersPopoverProps {
  votes: IVote[];
}

/**
 * Small info affordance shown next to the approval counter on the Overview tab.
 * Reveals the full Security Council roster, marking who has signed and who is
 * still pending.
 *
 * Interaction is a hover + click hybrid: it opens on hover on desktop and on tap
 * on mobile (where hover doesn't exist), so "who signed" is visible without
 * switching to the Approvals tab. Rows link to the block explorer, matching the
 * Approvals tab.
 *
 * The full roster comes from the signer list; if it can't be loaded we fall back
 * to listing just the approvers.
 */
export const SignersPopover: FC<SignersPopoverProps> = ({ votes }) => {
  const { address } = useAccount();
  const { data: signerList } = useSignerList();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Dismiss on outside pointer / Escape — needed for the tap-to-open (mobile) path.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Clear any pending hover-close timer on unmount.
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  // Set of addresses that have approved (lower-cased for case-insensitive lookup).
  const approverSet = useMemo(() => new Set(votes.map((vote) => vote.address.toLowerCase())), [votes]);

  // Full roster: the signer list when available, otherwise just the approvers.
  // Signed members are listed first, then pending ones.
  const members = useMemo(() => {
    const roster: Address[] = signerList?.length ? signerList : votes.map((vote) => vote.address);
    return [...roster].sort((a, b) => {
      const aSigned = approverSet.has(a.toLowerCase());
      const bSigned = approverSet.has(b.toLowerCase());
      return aSigned === bSigned ? 0 : aSigned ? -1 : 1;
    });
  }, [signerList, votes, approverSet]);

  const signedCount = useMemo(
    () => members.filter((member) => approverSet.has(member.toLowerCase())).length,
    [members, approverSet]
  );

  const openNow = () => {
    clearTimeout(closeTimer.current);
    setOpen(true);
  };

  // Delay the hover-close so the pointer can travel from the icon into the panel.
  const scheduleClose = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  if (members.length === 0) return null;

  const explorerUrl = PUB_CHAIN.blockExplorers?.default.url;

  return (
    <div ref={containerRef} className="relative inline-flex" onMouseEnter={openNow} onMouseLeave={scheduleClose}>
      <button
        type="button"
        aria-label="Show who has signed"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center text-neutral-400 transition-colors hover:text-neutral-600"
      >
        <Icon icon={IconType.INFO} size="sm" />
      </button>

      {open && (
        <div
          role="dialog"
          className="absolute right-0 top-6 z-20 flex w-64 flex-col gap-1 rounded-xl border border-neutral-100 bg-neutral-0 p-2 shadow-neutral-sm"
        >
          <p className="px-2 py-1 text-xs font-semibold text-neutral-500">
            Signers · {signedCount}/{members.length}
          </p>
          <ul className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
            {members.map((member, index) => {
              const hasSigned = approverSet.has(member.toLowerCase());
              const isConnectedAccount = address && isAddressEqual(address, member);
              const href = explorerUrl ? `${explorerUrl}/address/${member}` : undefined;

              return (
                <li key={`${member}-${index}`}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-neutral-50"
                  >
                    <MemberAvatar
                      address={member}
                      alt="Avatar"
                      size="sm"
                      className={hasSigned ? "shrink-0" : "shrink-0 opacity-50"}
                    />
                    <span
                      className={`flex-1 truncate text-sm ${hasSigned ? "text-neutral-800" : "text-neutral-500"}`}
                    >
                      {formatHexString(member)}
                    </span>
                    {isConnectedAccount && <span className="text-xs text-neutral-400">You</span>}
                    {hasSigned ? (
                      <Icon icon={IconType.CHECKMARK} size="sm" className="shrink-0 text-success-600" />
                    ) : (
                      <span className="shrink-0 text-xs text-neutral-400">Pending</span>
                    )}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};
