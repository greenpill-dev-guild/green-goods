// Types for chat-copy.mjs, which the agent's copy tests import. The module stays plain JavaScript
// so scripts/design/check-em-dashes.mjs can import it under Node.

export type ChatCopyLocale = "en" | "es" | "pt";

export interface ChatCopyBlock {
  /** Repository-relative path of the module that holds the block. */
  readonly file: string;
  readonly locale: ChatCopyLocale;
  /** The source text that opens the block. */
  readonly opening: string;
  /** The first source text after the opening that closes the block. */
  readonly closing: string;
  /** The fewest strings the block holds. */
  readonly least: number;
}

export interface ChatCopyString {
  /** The string as it renders, escape sequences resolved. */
  readonly text: string;
  /** The 1-based line of the file where the string's literal starts. */
  readonly line: number;
}

export const CHAT_COPY: readonly ChatCopyBlock[];

export function copyLiterals(block: string): Array<{ text: string; index: number }>;

export function readChatCopy(root: string): Array<ChatCopyBlock & { strings: ChatCopyString[] }>;
