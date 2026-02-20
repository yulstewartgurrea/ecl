// # file: src/features/chatbot/components/Typewriter.tsx
import React, { useEffect, useRef, useState, useImperativeHandle } from "react";

export type TypewriterHandle = { finish: () => void };

export default function Typewriter({
  text,
  enabled = true,
  speed = 8, // slightly smoother default
  jitter = 3, // small jitter so it feels organic
  onDone,
  onStart,
  className,
  innerClassName,
  forwardRef,
  renderText,
  ariaLive = "polite",
  continueOnAppend = true, // ✅ NEW: don't restart when text grows
}: {
  text: string;
  enabled?: boolean;
  speed?: number; // ms per char
  jitter?: number; // +/- ms jitter
  onDone?: () => void;
  onStart?: () => void;
  className?: string;
  innerClassName?: string;
  forwardRef?: React.Ref<TypewriterHandle | null>;
  renderText?: (displayed: string) => React.ReactNode;
  ariaLive?: "polite" | "off";
  continueOnAppend?: boolean;
}) {
  const prefersReduced = useRef(false);
  const [displayed, setDisplayed] = useState("");
  const idxRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const accRef = useRef(0);

  // Keep both last text and current text refs
  const textRef = useRef(text || "");
  const prevTextRef = useRef(text || "");
  const startedRef = useRef(false);

  useImperativeHandle(forwardRef, () => ({
    finish: () => {
      cancelLoop();
      idxRef.current = textRef.current.length;
      setDisplayed(textRef.current);
      onDone?.();
    },
  }));

  function cancelLoop() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }

  useEffect(() => {
    if (typeof window !== "undefined" && "matchMedia" in window) {
      prefersReduced.current = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
    }
  }, []);

  useEffect(() => {
    const newText = text ?? "";
    const oldText = textRef.current;

    // Update refs
    prevTextRef.current = oldText;
    textRef.current = newText;

    // Reduced motion or disabled -> show instantly
    if (!enabled || prefersReduced.current) {
      cancelLoop();
      startedRef.current = false;
      idxRef.current = newText.length;
      setDisplayed(newText);
      onDone?.();
      return;
    }

    // Decide whether to reset
    const appended =
      continueOnAppend &&
      oldText.length > 0 &&
      newText.length >= oldText.length &&
      newText.startsWith(oldText);

    // If content was rewritten (not appended), reset index
    if (!appended && idxRef.current > newText.length) {
      idxRef.current = 0;
      accRef.current = 0;
      lastTimeRef.current = null;
      startedRef.current = false;
      setDisplayed(""); // hard reset
    }

    // If appended, DO NOT reset idx; just keep going.
    // If we were still typing oldText, keep idx as-is.
    // Clamp to new length for safety:
    idxRef.current = Math.min(idxRef.current, newText.length);

    // Start loop (restart safely)
    cancelLoop();
    const step = (t: number) => {
      if (!startedRef.current) {
        startedRef.current = true;
        onStart?.();
      }

      if (lastTimeRef.current == null) lastTimeRef.current = t;
      const dt = t - lastTimeRef.current;
      lastTimeRef.current = t;
      accRef.current += dt;

      const effectiveSpeed = Math.max(
        1,
        speed + (Math.random() - 0.5) * jitter,
      );
      const advance = Math.floor(accRef.current / effectiveSpeed);

      if (advance > 0) {
        accRef.current -= advance * effectiveSpeed;
        idxRef.current = Math.min(
          textRef.current.length,
          idxRef.current + advance,
        );

        const next = textRef.current.slice(0, idxRef.current);
        setDisplayed(next);

        if (idxRef.current >= textRef.current.length) {
          cancelLoop();
          onDone?.();
          return;
        }
      }

      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      cancelLoop();
    };
  }, [text, enabled, speed, jitter, onDone, onStart, continueOnAppend]);

  return (
    <span className={className} aria-live={ariaLive}>
      {renderText ? (
        renderText(displayed)
      ) : (
        <span className={innerClassName}>{displayed}</span>
      )}
    </span>
  );
}
