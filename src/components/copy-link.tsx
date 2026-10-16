"use client";

import { useState } from "react";

/** Yöneticinin kullanıcıya kendisi ileteceği bağlantı; tek tıkla kopyalanır. */
export function CopyLink({ link, label = "Kopyala", copiedLabel = "Kopyalandı" }: { link: string; label?: string; copiedLabel?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-2 flex items-start gap-2">
      <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="input min-w-0 flex-1 font-mono text-xs" />
      <button
        type="button"
        className="btn-secondary shrink-0"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
          } catch {
            // Pano izni yoksa kullanıcı kutudan elle kopyalar.
          }
        }}
      >
        {copied ? copiedLabel : label}
      </button>
    </div>
  );
}
