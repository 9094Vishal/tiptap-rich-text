import { useCallback, useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';

const SILENCE_TIMEOUT_MS = 20000;

export type VoiceErrorKind = 'unsupported' | 'denied' | 'blocked' | 'other';

export interface VoiceError {
  kind: VoiceErrorKind;
  message: string;
}

export interface BrowserInfo {
  name: 'Chrome' | 'Edge' | 'Firefox' | 'Safari' | 'Brave' | 'Other';
  isBrave: boolean;
}

// Minimal ambient shape for the (still non-standard) Web Speech API —
// not in lib.dom.d.ts, and browser vendors haven't converged on a single
// shared type package for it.
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  [index: number]: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionErrorEventLike {
  error: string;
}
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

const getSpeechRecognitionCtor = (): (new () => SpeechRecognitionLike) | undefined => {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition;
};

export function useVoiceDictation(editor: Editor | null) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<VoiceError | null>(null);
  const [browserInfo, setBrowserInfo] = useState<BrowserInfo>({ name: 'Chrome', isBrave: false });

  const isListeningRef = useRef(false);
  const lastToggleRef = useRef(0);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interimRangeRef = useRef<{ from: number; to: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const detect = async () => {
      let name: BrowserInfo['name'] = 'Chrome';
      let isBrave = false;
      const ua = navigator.userAgent;
      const nav = navigator as Navigator & { brave?: { isBrave: () => Promise<boolean> } };

      if (nav.brave && (await nav.brave.isBrave())) {
        name = 'Brave';
        isBrave = true;
      } else if (/edg/i.test(ua)) {
        name = 'Edge';
      } else if (/firefox|fxios/i.test(ua)) {
        name = 'Firefox';
      } else if (/safari/i.test(ua) && !/chrome/i.test(ua)) {
        name = 'Safari';
      } else if (/chrome|chromium|crios/i.test(ua)) {
        name = 'Chrome';
      } else {
        name = 'Other';
      }

      if (!cancelled) setBrowserInfo({ name, isBrave });
    };
    void detect();
    return () => {
      cancelled = true;
    };
  }, []);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const resetSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
    }, SILENCE_TIMEOUT_MS);
  }, [clearSilenceTimer]);

  const setListening = useCallback((val: boolean) => {
    isListeningRef.current = val;
    setIsListening(val);
  }, []);

  const toggleListening = useCallback(() => {
    const now = Date.now();
    if (now - lastToggleRef.current < 400) return;
    lastToggleRef.current = now;

    const SpeechRecognitionCtor = getSpeechRecognitionCtor();
    if (!SpeechRecognitionCtor) {
      setError({ kind: 'unsupported', message: 'Speech-to-text dictation is not natively supported by this browser.' });
      return;
    }

    if (isListeningRef.current) {
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
      clearSilenceTimer();
      setListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setListening(true);
        resetSilenceTimer();
      };

      recognition.onresult = (event) => {
        resetSilenceTimer();
        let finalTranscript = '';
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript + ' ';
          } else {
            interimTranscript += result[0].transcript;
          }
        }

        if (editor) {
          try {
            if (interimRangeRef.current) {
              editor.chain().setTextSelection(interimRangeRef.current).run();
            }
            if (finalTranscript) {
              editor.chain().focus().insertContent(finalTranscript).run();
              interimRangeRef.current = null;
            }
            if (interimTranscript) {
              const from = editor.state.selection.from;
              editor.chain().focus().insertContent(interimTranscript).run();
              const to = editor.state.selection.to;
              interimRangeRef.current = { from, to };
            }
          } catch {
            interimRangeRef.current = null;
          }
        }
      };

      recognition.onerror = (event) => {
        if (event.error === 'not-allowed') {
          setError({ kind: 'denied', message: 'Microphone access was denied by your browser.' });
        } else if (event.error === 'network' || event.error === 'service-not-allowed') {
          setError({ kind: 'blocked', message: "Speech recognition is blocked by your browser's privacy settings." });
        } else if (event.error !== 'no-speech') {
          setError({ kind: 'other', message: `Speech recognition error: ${event.error}` });
        }
        clearSilenceTimer();
        setListening(false);
        interimRangeRef.current = null;
      };

      recognition.onend = () => {
        clearSilenceTimer();
        setListening(false);
        interimRangeRef.current = null;
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch {
      clearSilenceTimer();
      setListening(false);
    }
  }, [editor, clearSilenceTimer, resetSilenceTimer, setListening]);

  useEffect(
    () => () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    },
    []
  );

  return { isListening, error, clearError: () => setError(null), browserInfo, toggleListening };
}
