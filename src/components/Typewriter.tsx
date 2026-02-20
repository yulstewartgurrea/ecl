// # file: src/features/chatbot/components/Typewriter.tsx
import React, {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
  memo,
} from "react";

export type TypewriterHandle = { finish: () => void };

type Props = {
  text: string;
  enabled?: boolean;
  speed?: number; // ms per char
  jitter?: number; // +/- ms jitter
  onDone?: () => void;
  onStart?: () => void;
  className?: string;
  innerClassName?: string;
  renderText?: (displayed: string) => React.ReactNode;
  ariaLive?: "polite" | "off";
  continueOnAppend?: boolean;
  cursor?: boolean;
};

function TypewriterInner(
  {
    text,
    enabled = true,
    speed = 8,
    jitter = 3,
    onDone,
    onStart,
    className,
    innerClassName,
    renderText,
    ariaLive = "polite",
    continueOnAppend = true,
  }: Props,
  ref: React.Ref<TypewriterHandle | null>,
) {
  const prefersReduced = useRef(false);
  const [displayed, setDisplayed] = useState("");
  const idxRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const accRef = useRef(0);

  const textRef = useRef(text || "");
  const prevTextRef = useRef(text || "");
  const startedRef = useRef(false);

  useImperativeHandle(ref, () => ({
    finish: () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      idxRef.current = textRef.current.length;
      setDisplayed(textRef.current);
      onDone?.();
    },
  }));

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

    prevTextRef.current = oldText;
    textRef.current = newText;

    // If reduced motion or disabled: render instantly but still trigger onDone
    if (!enabled || prefersReduced.current) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      startedRef.current = false;
      idxRef.current = newText.length;
      setDisplayed(newText);
      onDone?.();
      return;
    }

    const appended =
      continueOnAppend &&
      oldText.length > 0 &&
      newText.length >= oldText.length &&
      newText.startsWith(oldText);

    if (!appended && idxRef.current > newText.length) {
      idxRef.current = 0;
      accRef.current = 0;
      lastTimeRef.current = null;
      startedRef.current = false;
      setDisplayed("");
    }

    idxRef.current = Math.min(idxRef.current, newText.length);

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

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
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
          onDone?.();
          return;
        }
      }

      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
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

const Typewriter = memo(forwardRef(TypewriterInner));

export default Typewriter;
