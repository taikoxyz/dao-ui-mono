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
import { TrustBadge } from "./trustBadge";
import { displaySummary } from "@/utils/decoding/format";

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
  const { node, isLoading } = useActionTree(rawAction);
  const title = `Action ${index + 1}`;
  const isEthTransfer = !rawAction.data || rawAction.data === "0x";
  const headline = node?.functionName
    ? node.functionName
    : isEthTransfer
      ? `Transfer ${PUB_CHAIN.nativeCurrency.symbol}`
      : "(function call)";

  return (
    <AccordionItem className="border-t border-t-neutral-100 bg-neutral-0" value={title}>
      <AccordionItemHeader className="!items-start">
        <div className="flex w-full justify-between gap-x-4">
          <div className="flex w-full flex-1 flex-col items-start gap-y-1.5">
            <span className="text-left text-lg font-semibold leading-tight text-neutral-800 md:text-xl">
              {decodeCamelCase(headline)}
            </span>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <Link
                href={`${PUB_CHAIN.blockExplorers?.default.url}/address/${rawAction.to}`}
                target="_blank"
                onClick={(e) => e.stopPropagation()}
                className="font-mono text-neutral-500 hover:underline"
              >
                {formatHexString(rawAction.to)}
              </Link>
              {node && <TrustBadge trust={node.trust} />}
            </div>
            {node && displaySummary(node) && (
              <p className="text-left text-sm text-neutral-600 md:text-base">{displaySummary(node)}</p>
            )}
          </div>
          <div className="hidden w-24 shrink-0 text-right text-sm text-neutral-500 sm:block md:text-base">{title}</div>
        </div>
      </AccordionItemHeader>
      <AccordionItemContent className="!h-auto !overflow-visible">
        <div className="flex flex-col gap-y-4">
          {isLoading || !node ? (
            <p className="text-neutral-500">Decoding…</p>
          ) : (
            <ActionNodeBody node={node} />
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
