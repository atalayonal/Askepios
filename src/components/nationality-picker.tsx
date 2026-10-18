"use client";

import { useId, useMemo, useRef, useState } from "react";
import type { Locale } from "@/i18n/dictionaries";
import { countries, searchKey } from "@/lib/countries";

/**
 * Aramalı uyruk seçimi: kutuya yazdıkça liste daralır, ok tuşları ve Enter ile seçilir.
 * Form'a ülke kodu (ör. TR) gizli alanla gider. Listeden seçilmeden form gönderilemez.
 */
export function NationalityPicker({
  name,
  locale,
  label,
  fieldLabel,
  placeholder,
  invalidMessage,
  noResults,
  onChange,
}: {
  name: string;
  locale: Locale;
  label: string;
  /** Eksik alan uyarısında görünen ad (ör. "Misafir 2: Uyruk"). */
  fieldLabel?: string;
  placeholder: string;
  invalidMessage: string;
  noResults: string;
  onChange?: (code: string) => void;
}) {
  const list = countries(locale);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [code, setCode] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const matches = useMemo(() => {
    const key = searchKey(text.trim());
    if (!key) return list;
    const starts = list.filter((c) => searchKey(c.name).startsWith(key) || c.code.toLowerCase() === key);
    const contains = list.filter((c) => !starts.includes(c) && searchKey(c.name).includes(key));
    return [...starts, ...contains];
  }, [list, text]);

  function choose(c: { code: string; name: string }) {
    setText(c.name);
    setCode(c.code);
    setOpen(false);
    inputRef.current?.setCustomValidity("");
    onChange?.(c.code);
  }

  function clearChoice(next: string) {
    setText(next);
    setOpen(true);
    setActive(0);
    if (code) {
      setCode("");
      onChange?.("");
    }
    // Kutu dolu ama listeden seçilmemişse form gönderilmez ve uyarı gösterilir.
    inputRef.current?.setCustomValidity(next.trim() ? invalidMessage : "");
  }

  return (
    <div className="relative">
      <label className="block">
        <span className="text-xs font-medium">{label} *</span>
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          required
          data-label={fieldLabel ?? label}
          value={text}
          placeholder={placeholder}
          onChange={(e) => clearChoice(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            // Tam adı yazıp listeden seçmeden çıktıysa yine de kabul et.
            if (!code) {
              const exact = list.find((c) => searchKey(c.name) === searchKey(text.trim()));
              if (exact) choose(exact);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((i) => Math.min(i + 1, matches.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && open && matches[active]) {
              e.preventDefault();
              choose(matches[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          className="input mt-1"
        />
      </label>
      <input type="hidden" name={name} value={code} />
      {open && (
        <ul id={listId} role="listbox" className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-line bg-white py-1 text-sm shadow-lg">
          {matches.length ? (
            matches.map((c, i) => (
              <li
                key={c.code}
                role="option"
                aria-selected={i === active}
                // Seçim blur'dan önce gerçekleşsin diye mousedown kullanılır.
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(c);
                }}
                onMouseEnter={() => setActive(i)}
                className={`cursor-pointer px-3 py-1.5 ${i === active ? "bg-sky text-navy" : ""}`}
              >
                {c.name}
              </li>
            ))
          ) : (
            <li className="px-3 py-1.5 text-muted">{noResults}</li>
          )}
        </ul>
      )}
    </div>
  );
}
