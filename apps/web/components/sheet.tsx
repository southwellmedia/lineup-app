"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A modal panel on the native <dialog>: focus is trapped, Esc closes it and
 * the page behind is inert. Slides in from the right on wide screens and
 * up from the bottom on phones. Render it only while open.
 */
export function Sheet(props: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { onClose } = props;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    const handleClose = () => onClose();
    dialog.addEventListener("close", handleClose);
    return () => {
      dialog.removeEventListener("close", handleClose);
      if (dialog.open) dialog.close();
    };
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      aria-label={props.title}
      onClick={(e) => {
        // A click on the backdrop lands on the dialog element itself.
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
      className="sheet m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-3xl bg-card p-0 text-ink shadow-2xl backdrop:bg-ink/40 backdrop:backdrop-blur-[2px] sm:ml-auto sm:mt-0 sm:h-dvh sm:max-h-none sm:w-[28rem] sm:rounded-none sm:rounded-l-3xl"
    >
      <div className="flex max-h-[92dvh] flex-col sm:h-full sm:max-h-none">
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="text-xl font-semibold tracking-tight">{props.title}</h2>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            className="grid size-9 place-items-center rounded-full text-muted hover:bg-paper hover:text-ink focus-visible:outline-2 focus-visible:outline-brand"
          >
            <span aria-hidden>✕</span>
            <span className="sr-only">Close</span>
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5">{props.children}</div>
      </div>
    </dialog>
  );
}
