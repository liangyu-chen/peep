// The bulletin board's shared rules: used by the API (to clean what comes in) and by the café (to count what is typed)
export const NICK_MAX = 8;
export const MSG_MAX = 40;
export const DEFAULT_NICK = '路過的客人';
export const BOARD_LIMIT = 40;   // notes on the board at once

export const REPLY_MAX = 60;     // the owner's reply to a note

// reply is '' when the owner hasn't answered; repliedAt is then null
export type BoardPost = { id: number; nickname: string; message: string; createdAt: string; reply: string; repliedAt: string | null };

const len = (s: string) => Array.from(s).length;
const cut = (s: string, n: number) => Array.from(s).slice(0, n).join('');

// one line of plain text: control, format (bidi, zero-width) and line-break characters become spaces or go, runs of spaces collapse
export function cleanText(v: unknown, max: number): string {
  const s = String(v ?? '')
    .replace(/[\p{Cc}\p{Zl}\p{Zp}]+/gu, ' ')
    .replace(/[\p{Cf}]+/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cut(s, max);
}
export const tooLong = (v: unknown, max: number) => len(cleanText(v, Infinity)) > max;
