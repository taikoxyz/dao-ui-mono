import type { Editor } from '@tiptap/react';
import { IconType } from '../../icon';
export interface ITextAreaRichTextAction {
    /**
     * Icon of the action.
     */
    icon: IconType;
    /**
     * TipTap command or callback called on action click.
     */
    action?: () => unknown;
    /**
     * Hides the action when set to true.
     */
    hidden?: boolean;
}
export interface ITextAreaRichTextActionsProps {
    /**
     * Instance of the TipTap editor.
     */
    editor: Editor | null;
    /**
     * Renders the actions as disabled when set to true.
     */
    disabled?: boolean;
    /**
     * Callback called on expand action click.
     */
    onExpandClick?: () => void;
}
export declare const TextAreaRichTextActions: React.FC<ITextAreaRichTextActionsProps>;
