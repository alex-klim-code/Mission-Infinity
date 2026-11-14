import { useCallback, useEffect, useRef, useState } from 'react';
import { useCompleteAvatarUpload, useRequestAvatarUpload, type Avatar3DInput } from '@workspace/api-client-react';
import { AvatarPipelineError, isAbort, isSelfContainedGlb, metaFromExport, putSigned, readExportBlob, type Avatar3DMeta, type AvaturnExport } from '@/lib/avatar3d';
import { errMsg } from '@/lib/game';

export type DraftStatus = 'awaiting-poster' | 'uploading' | 'ready' | 'error';
export type AvatarDraft = {
  token: number;
  meta: Avatar3DMeta;
  modelSrc: string;
  posterSrc: string | null;
  /** undefined = still capturing; null = no poster available */
  poster: Blob | null | undefined;
  status: DraftStatus;
  error: string | null;
  portraitNote: string | null;
  input: Avatar3DInput | null;
};

type Limits = { maxModelBytes: number; maxPortraitBytes: number };

async function releaseModel(url: string) {
  try {
    const m = await import('@/components/avatar3d-viewer');
    m.releaseGltf(url);
  } catch {
    /* viewer chunk never loaded: nothing cached */
  }
  URL.revokeObjectURL(url);
}

/** Local Avaturn draft: decode export -> preview -> poster -> upload -> complete. Survives step changes in the parent. */
export function useAvatar3DDraft() {
  const [draft, setDraftState] = useState<AvatarDraft | null>(null);
  const [decoding, setDecoding] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const draftRef = useRef<AvatarDraft | null>(null);
  const tokenRef = useRef(0);
  const alive = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  const posterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blobs = useRef<{ model: Blob | null }>({ model: null });
  const done = useRef<{ token: number; modelId?: string; portraitId?: string }>({ token: 0 });
  const limits = useRef<Limits>({ maxModelBytes: 20971520, maxPortraitBytes: 1048576 });

  const req = useRequestAvatarUpload();
  const complete = useCompleteAvatarUpload();
  const reqRef = useRef(req.mutateAsync);
  reqRef.current = req.mutateAsync;
  const completeRef = useRef(complete.mutateAsync);
  completeRef.current = complete.mutateAsync;

  const setDraft = useCallback((d: AvatarDraft | null) => {
    draftRef.current = d;
    if (alive.current) setDraftState(d);
  }, []);
  const patch = useCallback((token: number, p: Partial<AvatarDraft>) => {
    const cur = draftRef.current;
    if (!cur || cur.token !== token) return;
    setDraft({ ...cur, ...p });
  }, [setDraft]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      abortRef.current?.abort();
      if (posterTimer.current) clearTimeout(posterTimer.current);
      const d = draftRef.current;
      if (d) {
        void releaseModel(d.modelSrc);
        if (d.posterSrc) URL.revokeObjectURL(d.posterSrc);
      }
    };
  }, []);

  const upload = useCallback(async (token: number) => {
    const d = draftRef.current;
    const model = blobs.current.model;
    if (!d || d.token !== token || !model || d.poster === undefined) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    if (done.current.token !== token) done.current = { token };
    // Keep completion IDs local to this export. A later draft can replace done.current
    // while an earlier, non-abortable API confirmation is still in flight.
    const transfer = done.current;
    patch(token, { status: 'uploading', error: null });
    try {
      if (!transfer.modelId) {
        const slot = await reqRef.current({ data: { kind: 'model', size: model.size } });
        await putSigned(slot.uploadUrl, model, slot.contentType, ctrl.signal);
        const asset = await completeRef.current({ id: slot.id });
        transfer.modelId = asset.id;
      }
      let portraitNote: string | null = null;
      const poster = draftRef.current?.token === token ? draftRef.current.poster : null;
      if (poster && !transfer.portraitId) {
        try {
          const slot = await reqRef.current({ data: { kind: 'portrait', size: poster.size } });
          await putSigned(slot.uploadUrl, poster, slot.contentType, ctrl.signal);
          const asset = await completeRef.current({ id: slot.id });
          transfer.portraitId = asset.id;
        } catch (e) {
          if (isAbort(e) || ctrl.signal.aborted) throw e;
          portraitNote = 'Badge snapshot could not be stored; your crew chip will show a 3D placeholder.';
        }
      } else if (!poster) {
        portraitNote = 'This device could not capture a badge snapshot; chips will show a 3D placeholder.';
      }
      if (ctrl.signal.aborted || draftRef.current?.token !== token) return;
      const cur = draftRef.current;
      const input: Avatar3DInput = { modelUploadId: transfer.modelId!, ...cur.meta, ...(transfer.portraitId ? { portraitUploadId: transfer.portraitId } : {}) };
      patch(token, { status: 'ready', input, portraitNote, error: null });
    } catch (e) {
      if (ctrl.signal.aborted && draftRef.current?.token !== token) return;
      if (isAbort(e) && !alive.current) return;
      const msg = e instanceof AvatarPipelineError ? e.message : errMsg(e, 'Upload interrupted.');
      patch(token, { status: 'error', error: msg });
    }
  }, [patch]);

  const attachPoster = useCallback((token: number, blob: Blob | null) => {
    const d = draftRef.current;
    if (!d || d.token !== token || d.poster !== undefined) return;
    if (posterTimer.current) clearTimeout(posterTimer.current);
    const ok = blob && blob.size <= limits.current.maxPortraitBytes && blob.type === 'image/png' ? blob : null;
    patch(token, { poster: ok, posterSrc: ok ? URL.createObjectURL(ok) : null });
    void upload(token);
  }, [patch, upload]);

  const ingest = useCallback(async (r: AvaturnExport, l: Limits) => {
    limits.current = l;
    setIngestError(null);
    let meta: Avatar3DMeta;
    try {
      meta = metaFromExport(r);
    } catch (e) {
      setIngestError((e as Error).message);
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setDecoding(true);
    try {
      const blob = await readExportBlob(r, l.maxModelBytes, ctrl.signal);
      if (!(await isSelfContainedGlb(blob))) throw new AvatarPipelineError('That export is not a self-contained GLB model. Export again from Avaturn.');
      if (ctrl.signal.aborted || !alive.current) return;
      const prev = draftRef.current;
      if (prev) {
        void releaseModel(prev.modelSrc);
        if (prev.posterSrc) URL.revokeObjectURL(prev.posterSrc);
      }
      const token = ++tokenRef.current;
      blobs.current.model = blob;
      done.current = { token };
      setDraft({ token, meta, modelSrc: URL.createObjectURL(blob), posterSrc: null, poster: undefined, status: 'awaiting-poster', error: null, portraitNote: null, input: null });
      if (posterTimer.current) clearTimeout(posterTimer.current);
      posterTimer.current = setTimeout(() => attachPoster(token, null), 20_000);
    } catch (e) {
      if (!alive.current || (isAbort(e) && ctrl.signal.aborted)) return;
      setIngestError(e instanceof AvatarPipelineError ? e.message : 'Could not read the Avaturn export. Your previous draft is kept; export again.');
    } finally {
      if (alive.current) setDecoding(false);
    }
  }, [attachPoster, setDraft]);

  const retry = useCallback(() => {
    const d = draftRef.current;
    if (d) void upload(d.token);
  }, [upload]);

  const discard = useCallback(() => {
    abortRef.current?.abort();
    if (posterTimer.current) clearTimeout(posterTimer.current);
    const d = draftRef.current;
    if (d) {
      void releaseModel(d.modelSrc);
      if (d.posterSrc) URL.revokeObjectURL(d.posterSrc);
    }
    blobs.current.model = null;
    setIngestError(null);
    setDraft(null);
  }, [setDraft]);

  return { draft, decoding, ingestError, ingest, attachPoster, retry, discard };
}

export type Avatar3DDraftApi = ReturnType<typeof useAvatar3DDraft>;
