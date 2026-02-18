import React from "react";

export const Icon = {
  Spark: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
      <path
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 2l1.2 4.2L17 7.4l-3.8 1.2L12 13l-1.2-4.4L7 7.4l3.8-1.2L12 2z"
      />
    </svg>
  ),
  Chevron: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
    </svg>
  ),
  Paperclip: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
      <path
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 12.5l-7.5 7.5a5 5 0 01-7.1-7.1L14 5.3a3.5 3.5 0 015 5L10.8 18.5a2 2 0 11-2.8-2.8L16 7.7"
      />
    </svg>
  ),
  Send: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
      <path
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
      />
    </svg>
  ),
  Trash: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
      <path
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 7h16M6 7l1 14h10l1-14M9 7V4h6v3"
      />
    </svg>
  ),
  Plus: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
    </svg>
  ),
};