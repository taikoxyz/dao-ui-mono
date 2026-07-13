import { Component, type ReactNode } from "react";
import type { RawAction } from "@/utils/types";
import { EncodedView } from "./encodedView";

interface IActionErrorBoundaryProps {
  rawAction: RawAction;
  children: ReactNode;
}

interface IActionErrorBoundaryState {
  hasError: boolean;
}

/**
 * Render-time safety net for a single decoded action. A malformed decoded node
 * (unexpected shape from a heuristic decode) must never white-screen the whole
 * proposal page — on a render throw we fall back to the honest raw calldata view.
 * There is no other error boundary in the app; this one is intentionally small
 * and self-contained.
 */
export class ActionErrorBoundary extends Component<IActionErrorBoundaryProps, IActionErrorBoundaryState> {
  state: IActionErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): IActionErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("ActionErrorBoundary: failed to render decoded action", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col gap-y-2">
          <p className="text-sm text-warning-800">Could not display the decoded action — showing raw calldata.</p>
          <EncodedView rawAction={this.props.rawAction} />
        </div>
      );
    }
    return this.props.children;
  }
}
