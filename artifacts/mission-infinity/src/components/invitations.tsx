import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Clock, X } from 'lucide-react';
import { useRespondToInvitation, type Invitation } from '@workspace/api-client-react';
import { HudButton, Portrait } from '@/components/ui-kit';
import { errMsg, invalidateGame } from '@/lib/game';
import { useToast } from '@/hooks/use-toast';

function timeLeft(expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (Number.isNaN(ms)) return '';
  if (ms <= 0) return 'expired';
  const m = Math.round(ms / 60000);
  return m < 60 ? `${m} min left` : `${Math.round(m / 60)} h left`;
}

export function InvitationRow({ inv }: { inv: Invitation }) {
  const respond = useRespondToInvitation();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const incoming = inv.direction === 'incoming';

  const act = (action: 'accept' | 'decline') =>
    respond.mutate(
      { id: inv.id, data: { action } },
      {
        onSuccess: async (res) => {
          await invalidateGame(qc);
          if (action === 'accept' && res.session) setLocation(`/session/${res.session.id}`);
          else toast({ title: action === 'accept' ? 'Invitation accepted' : 'Invitation declined' });
        },
        onError: (e) => toast({ title: 'Could not respond', description: errMsg(e), variant: 'destructive' }),
      },
    );

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-burn/30 bg-burn/[.05] p-4 sm:flex-row sm:items-center" data-testid={`row-invitation-${inv.id}`}>
      {(() => {
        const who = incoming ? inv.from : inv.to;
        return <Portrait presetId={who.presetId} name={who.name} size={44} online={who.online} ring="burn" />;
      })()}
      <div className="min-w-0 flex-1">
        <div className="text-sm">
          {incoming ? (
            <>
              <span className="font-semibold">{inv.from.name}</span> wants you on <span className="text-burn">{inv.missionTitle}</span>
            </>
          ) : (
            <>
              You invited <span className="font-semibold">{inv.to.name}</span> to <span className="text-burn">{inv.missionTitle}</span>
            </>
          )}
        </div>
        <div className="mt-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <Clock className="h-3 w-3" /> {inv.status} / {timeLeft(inv.expiresAt)}
        </div>
      </div>
      {incoming && (
        <div className="flex gap-2">
          <HudButton variant="ghost" className="min-h-9 px-3" onClick={() => act('decline')} disabled={respond.isPending} data-testid={`button-decline-${inv.id}`}>
            <X className="h-4 w-4" /> Decline
          </HudButton>
          <HudButton variant="burn" className="min-h-9 px-3" onClick={() => act('accept')} loading={respond.isPending} data-testid={`button-accept-${inv.id}`}>
            <Check className="h-4 w-4" /> Join
          </HudButton>
        </div>
      )}
    </div>
  );
}
