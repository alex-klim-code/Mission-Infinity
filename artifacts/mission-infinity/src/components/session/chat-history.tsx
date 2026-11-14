import { useEffect, useRef, useState } from 'react';
import { getSessionMessages, getGetSessionMessagesQueryKey, type GameSession, type SessionChatMessage } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { MessageSquare } from 'lucide-react';

export function ChatHistory({ session, meId, open }: { session: GameSession; meId: string; open: boolean }) {
  const qc = useQueryClient();
  const [history, setHistory] = useState<SessionChatMessage[]>([]);
  const [olderCursor, setOlderCursor] = useState<string | null>(null);
  const [hasOlder, setHasOlder] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const nearBottom = useRef(true);
  const historyRef = useRef<SessionChatMessage[]>([]);
  const windowEpoch = useRef(0);
  useEffect(() => {
    if (!session.chat) return;
    const fresh = session.chat.messages;
    const previous = historyRef.current;
    const previousIds = new Set(previous.map(m => m.id));
    // After a long disconnection, restart pagination at the current window
    // rather than silently leaving a gap between old and new messages.
    const gap = previous.length > 0 && fresh.length > 0 && !fresh.some(m => previousIds.has(m.id));
    if (gap) {
      windowEpoch.current++;
      setOlderCursor(null);
      setHasOlder(true);
      nearBottom.current = true;
    }
    const merged = new Map((gap ? [] : previous).map(m => [m.id, m]));
    for (const m of fresh) merged.set(m.id, m);
    historyRef.current = [...merged.values()].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id));
    setHistory(historyRef.current);
  }, [session.chat]);
  const newestId = history.at(-1)?.id;
  useEffect(() => {
    if (open && nearBottom.current && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [newestId, open]);
  const canLoadOlder = olderCursor ? hasOlder : Boolean(session.chat?.hasMore);
  async function loadOlder() {
    const before = olderCursor ?? history[0]?.id;
    if (!before || loading) return;
    setLoading(true);
    setError(null);
    const epoch = windowEpoch.current;
    const list = listRef.current;
    const previousHeight = list?.scrollHeight ?? 0;
    const previousTop = list?.scrollTop ?? 0;
    try {
      const page = await qc.fetchQuery({
        queryKey: [...getGetSessionMessagesQueryKey(session.id, { before }), meId],
        queryFn: () => getSessionMessages(session.id, { before }),
        staleTime: 0,
      });
      if (epoch !== windowEpoch.current) return;
      const merged = new Map([...page.messages, ...historyRef.current].map(m => [m.id, m]));
      historyRef.current = [...merged.values()].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id));
      setHistory(historyRef.current);
      setOlderCursor(page.messages[0]?.id ?? before);
      setHasOlder(page.hasMore);
      nearBottom.current = false;
      requestAnimationFrame(() => {
        if (list) list.scrollTop = previousTop + list.scrollHeight - previousHeight;
      });
    } catch {
      setError('Could not load older messages. Please try again.');
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="p-3">
      {canLoadOlder && <button type="button" disabled={loading} onClick={loadOlder} className="mb-2 w-full rounded border border-ion/25 px-3 py-2 text-xs text-ion disabled:opacity-50" data-testid="button-chat-older">
        {loading ? 'Loading…' : 'Load older messages'}
      </button>}
      {error && <p role="alert" className="mb-2 text-xs text-destructive">{error}</p>}
      <ul ref={listRef} onScroll={() => {
        const el = listRef.current;
        if (el) nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      }} className="scroll-thin max-h-[28dvh] space-y-2 overflow-y-auto" aria-label="Saved crew conversation" data-testid="chat-history">
        {history.map(m => <li key={m.id} className="rounded-md border border-white/[.06] bg-void/40 p-2.5" data-testid={`chat-message-${m.id}`}>
          <div className="flex items-start gap-2 text-xs text-ion">
            <MessageSquare className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 break-words font-semibold">{m.name}{m.playerId === meId ? ' (you)' : ''}</span>
            <time dateTime={m.createdAt} title={new Date(m.createdAt).toLocaleString()} className="shrink-0 text-[10px] text-muted-foreground">{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground [overflow-wrap:anywhere]">{m.text}</p>
        </li>)}
        {!history.length && <li className="py-4 text-center text-xs text-muted-foreground">No messages yet. Start the conversation.</li>}
      </ul>
    </div>
  );
}
