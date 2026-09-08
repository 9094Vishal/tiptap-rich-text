import { useCallback, useEffect, useRef, useState } from 'react';

const DRAFT_KEY_PREFIX = 'rte-draft:';
const DEBOUNCE_MS = 500;

const safeGetItem = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Private browsing with storage disabled, a browser policy blocking
    // access, or no `window` at all (SSR) — degrade to "no draft"
    // rather than throwing.
    return null;
  }
};

const safeSetItem = (key: string, value: string): void => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Quota exceeded or storage unavailable — saving silently becomes a
    // no-op rather than crashing the editor over a best-effort feature.
  }
};

const safeRemoveItem = (key: string): void => {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
};

export interface UseDraftResult {
  draftValue: string | null;
  hasDraft: boolean;
  setDraftValue: (html: string) => void;
  saveDraftNow: () => void;
  clearDraft: () => void;
  /** Ref-backed, not React state — reads the current value immediately
   *  after a synchronous `clearDraft()`/`setDraftValue()` call, instead
   *  of whatever `draftValue` was as of the last completed render. Use
   *  this from an imperative ref API; use `draftValue`/`hasDraft` for
   *  anything driven by React's own render cycle (e.g. an effect). */
  getDraftValueSync: () => string | null;
}

/**
 * localStorage-backed draft autosave, keyed by `draftKey`. A draft is
 * just an HTML string — typically a few KB — so localStorage's simple,
 * synchronous API is the right fit; IndexedDB's advantages (async I/O,
 * much larger quotas, blob storage) matter for data this never stores
 * (uploaded files are handled separately by AttachmentManager, and stay
 * explicitly in-memory-only in deferred-upload mode).
 *
 * Writes are debounced (~500ms) so a fast typist doesn't hit
 * localStorage on every keystroke; a pending write is flushed
 * immediately on unmount so the last debounce window is never lost.
 */
export function useDraft(draftKey: string | undefined): UseDraftResult {
  const storageKey = draftKey ? `${DRAFT_KEY_PREFIX}${draftKey}` : null;

  const initialValue = storageKey ? safeGetItem(storageKey) : null;
  const [draftValue, setDraftValueState] = useState<string | null>(initialValue);
  // Mirrors `draftValue` synchronously — React state updates (setState)
  // don't apply until the next render, so an imperative caller doing
  // `clearDraft(); hasDraft()` in the same tick would otherwise read the
  // value as of the *previous* render instead of the change it just made.
  const currentValueRef = useRef<string | null>(initialValue);

  const pendingValueRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const setBoth = useCallback((value: string | null) => {
    currentValueRef.current = value;
    setDraftValueState(value);
  }, []);

  // A different draftKey is a different draft slot entirely — re-read.
  useEffect(() => {
    setBoth(storageKey ? safeGetItem(storageKey) : null);
  }, [storageKey, setBoth]);

  const flush = useCallback(() => {
    if (!storageKey || pendingValueRef.current === null) return;
    safeSetItem(storageKey, pendingValueRef.current);
    pendingValueRef.current = null;
  }, [storageKey]);

  const setDraftValue = useCallback(
    (html: string) => {
      setBoth(html);
      if (!storageKey) return;
      pendingValueRef.current = html;
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, DEBOUNCE_MS);
    },
    [storageKey, flush, setBoth]
  );

  const saveDraftNow = useCallback(() => {
    clearTimeout(timerRef.current);
    flush();
  }, [flush]);

  const clearDraft = useCallback(() => {
    clearTimeout(timerRef.current);
    pendingValueRef.current = null;
    setBoth(null);
    if (storageKey) safeRemoveItem(storageKey);
  }, [storageKey, setBoth]);

  useEffect(
    () => () => {
      clearTimeout(timerRef.current);
      flush();
    },
    [flush]
  );

  return {
    draftValue,
    hasDraft: Boolean(draftValue),
    setDraftValue,
    saveDraftNow,
    clearDraft,
    getDraftValueSync: () => currentValueRef.current,
  };
}
