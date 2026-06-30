import { PUB_CHAIN } from "@/constants";
import { formatHexString } from "@/utils/evm";
import {
  AccordionContainer,
  AccordionItem,
  AccordionItemContent,
  AccordionItemHeader,
  Button,
  IconType,
} from "@aragon/ods";
import Link from "next/link";
import type { RawAction } from "@/utils/types";
import { If } from "../if";
import { useActionTree } from "@/hooks/useActionTree";
import { decodeCamelCase } from "@/utils/case";
import { ActionNodeBody } from "./actionNode";
import { leadParts, contractLabel, chainLabel, worstTrust } from "./actionNode.helpers";
import { TrustBadge } from "./trustBadge";
import { EncodedView } from "./encodedView";
import { ActionErrorBoundary } from "./actionErrorBoundary";

const DEFAULT_DESCRIPTION =
  "When the proposal passes the community vote, the following actions will be executable by the DAO.";
const DEFAULT_EMPTY_LIST_DESCRIPTION = "The proposal has no actions defined, it will behave as a signaling poll.";

interface IProposalActionsProps {
  description?: string;
  emptyListDescription?: string;
  actions?: RawAction[];
  onRemove?: (index: number) => any;
  executionTxHash?: string;
}

export const ProposalActions: React.FC<IProposalActionsProps> = (props) => {
  const { actions, description, emptyListDescription, onRemove, executionTxHash } = props;

  let message: string;
  if (actions?.length) {
    message = description ?? DEFAULT_DESCRIPTION;
  } else {
    message = emptyListDescription ?? DEFAULT_EMPTY_LIST_DESCRIPTION;
  }

  return (
    <div className="overflow-hidden rounded-xl bg-neutral-0 pb-2 shadow-neutral">
      {/* Header */}
      <div className="flex flex-col gap-y-2 px-4 py-4 md:gap-y-3 md:px-6 md:py-6">
        <div className="flex justify-between gap-x-2 gap-y-2">
          <p className="text-xl leading-tight text-neutral-800 md:text-2xl">Actions</p>
        </div>
        <p className="md:text-md text-base leading-normal text-neutral-500">{message}</p>
        {executionTxHash && (
          <Link
            href={`${PUB_CHAIN.blockExplorers?.default.url}/tx/${executionTxHash}`}
            target="_blank"
            className="text-sm text-primary-500 underline md:text-base"
          >
            View execution transaction ↗
          </Link>
        )}
      </div>

      {/* Content */}
      <If condition={actions?.length}>
        <AccordionContainer isMulti={true} className="border-t border-t-neutral-100">
          {actions?.map((action, index) => (
            <ActionItem
              key={index}
              index={index}
              rawAction={action}
              onRemove={onRemove ? () => onRemove?.(index) : undefined}
            />
          ))}
        </AccordionContainer>
      </If>
    </div>
  );
};

const ActionItem = ({ index, rawAction, onRemove }: { index: number; rawAction: RawAction; onRemove?: () => any }) => {
  const { node, isLoading, isError } = useActionTree(rawAction);
  const title = `Action ${index + 1}`;
  const headline = node ? leadParts(node).text : decodeCamelCase("(loading)");
  const label = node ? contractLabel(node) : null;
  const chain = node ? chainLabel(node.chainId) : null;
  // Collapsed header reflects the WORST trust across the whole subtree, so a
  // "Verified" wrapper can't mask an unverified descendant before it's expanded.
  const headerTrust = node ? (node.children.length > 0 ? worstTrust(node) : node.trust) : null;

  return (
    <AccordionItem className="border-t border-t-neutral-100 bg-neutral-0" value={title}>
      <AccordionItemHeader className="!items-start">
        <div className="flex w-full justify-between gap-x-4">
          <div className="flex w-full flex-1 flex-col items-start gap-y-1.5">
            <span className="text-left text-lg font-semibold leading-tight text-neutral-800 md:text-xl">
              {headline}
            </span>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              {label && <span className="font-semibold text-neutral-700">{label}</span>}
              <Link
                href={`${PUB_CHAIN.blockExplorers?.default.url}/address/${rawAction.to}`}
                target="_blank"
                onClick={(e) => e.stopPropagation()}
                className="font-mono text-neutral-500 hover:underline"
              >
                {formatHexString(rawAction.to)}
              </Link>
              {headerTrust && <TrustBadge trust={headerTrust} />}
              {chain && (
                <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-700">↗ {chain}</span>
              )}
            </div>
          </div>
          <div className="hidden w-24 shrink-0 text-right text-sm text-neutral-500 sm:block md:text-base">{title}</div>
        </div>
      </AccordionItemHeader>
      <AccordionItemContent className="!h-auto !overflow-visible">
        <div className="flex flex-col gap-y-4">
          {isLoading ? (
            <p className="text-neutral-500">Decoding…</p>
          ) : node && !isError ? (
            <ActionErrorBoundary rawAction={rawAction}>
              <ActionNodeBody node={node} />
            </ActionErrorBoundary>
          ) : (
            // Settled with an error or no decoded node: degrade honestly to raw
            // calldata instead of stranding on a permanent "Decoding…" spinner.
            <div className="flex flex-col gap-y-2">
              <p className="text-sm text-warning-800">Could not decode — showing raw calldata.</p>
              <EncodedView rawAction={rawAction} />
            </div>
          )}
          <If condition={!!onRemove}>
            <div className="mt-2">
              <Button variant="tertiary" size="sm" iconLeft={IconType.CLOSE} onClick={onRemove}>
                Remove action
              </Button>
            </div>
          </If>
        </div>
      </AccordionItemContent>
    </AccordionItem>
  );
};
