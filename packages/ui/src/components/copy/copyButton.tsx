import { useState } from "react";

interface ICopyButtonProps {
  value: string;
  label?: string;
  className?: string;
}

/**
 * Small clipboard button that copies the full `value` (e.g. an unshortened
 * address or hash). Stops event propagation so it never toggles a parent
 * accordion / <details> it lives inside.
 */
export const CopyButton: React.FC<ICopyButtonProps> = ({ value, label = "Copy", className = "" }) => {
  const [copied, setCopied] = useState(false);

  const onCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // clipboard unavailable (e.g. insecure context) — silently ignore
    }
  };

  return (
    <button
      type="button"
      aria-label={label}
      title={value}
      onClick={onCopy}
      className={`inline-flex shrink-0 items-center rounded p-0.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 ${className}`}
    >
      {copied ? (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-success-600" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
};
