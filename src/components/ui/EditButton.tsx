// components/ui/EditButton.tsx
"use client";
import React from "react";
import clsx from "clsx";
// If you prefer Ionicons, uncomment the next line and replace the icon below.
// import { Pencil } from "lucide-react"; // alternative icon set
import { PencilSquareIcon } from "@heroicons/react/24/solid";

type EditButtonProps = {
  onClick?: () => void;
  className?: string;
  children?: React.ReactNode; // custom label (defaults to "Edit")
  isLoading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "outline" | "subtle" | "ghost";
  size?: "sm" | "md" | "lg";
  iconPosition?: "left" | "right";
  title?: string; // native tooltip
  ariaLabel?: string;
  iconOnly?: boolean; // compact round icon button
};

const variants: Record<NonNullable<EditButtonProps["variant"]>, string> = {
  primary:
    "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm hover:shadow-md hover:from-amber-600 hover:to-orange-600 focus-visible:ring-amber-500",
  outline:
    "bg-white text-amber-700 border border-amber-300 hover:bg-amber-50 focus-visible:ring-amber-500",
  subtle:
    "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-transparent focus-visible:ring-amber-400",
  ghost:
    "bg-transparent text-amber-700 hover:bg-amber-50 border border-transparent focus-visible:ring-amber-400",
};

const sizes: Record<NonNullable<EditButtonProps["size"]>, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-sm",
  lg: "h-11 px-5 text-base",
};

export default function EditButton({
  onClick,
  className,
  children,
  isLoading = false,
  disabled = false,
  variant = "primary",
  size = "md",
  iconPosition = "left",
  title,
  ariaLabel,
  iconOnly = false,
}: EditButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? (iconOnly ? "Edit" : undefined)}
      aria-label={ariaLabel ?? (iconOnly ? "Edit" : undefined)}
      aria-busy={isLoading || undefined}
      disabled={isDisabled}
      className={clsx(
        "relative inline-flex select-none items-center justify-center rounded-xl transition-all duration-200",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ring-offset-white",
        variants[variant],
        iconOnly
          ? clsx(
              // icon-only pill
              size === "sm" ? "h-8 w-8" : size === "lg" ? "h-11 w-11" : "h-9 w-9",
              "p-0"
            )
          : sizes[size],
        isDisabled && "opacity-60 cursor-not-allowed",
        !isDisabled && "hover:-translate-y-0.5",
        className
      )}
    >
      {/* shimmer on hover */}
      {!isDisabled && (
        <span
          className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          aria-hidden="true"
        >
          <span className="absolute -top-1/2 left-0 h-[200%] w-16 rotate-12 bg-white/20 blur-md translate-x-[-120%] group-hover:translate-x-[160%] transition-transform duration-700 ease-out" />
        </span>
      )}

      {/* content */}
      {isLoading ? (
        <Spinner />
      ) : (
        <span className={clsx("inline-flex items-center gap-2", iconOnly && "gap-0")}>
          {iconPosition === "left" && <EditIcon iconOnly={iconOnly} />}
          {!iconOnly && <span>{children ?? "Edit"}</span>}
          {iconPosition === "right" && <EditIcon iconOnly={iconOnly} />}
        </span>
      )}
    </button>
  );
}

function EditIcon({ iconOnly }: { iconOnly?: boolean }) {
  return (
    <PencilSquareIcon
      className={clsx(
        "shrink-0",
        iconOnly ? "h-5 w-5" : "h-4 w-4"
      )}
    />
  );
}

function Spinner() {
  return (
    <svg
      className="h-5 w-5 animate-spin text-white"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-30" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
