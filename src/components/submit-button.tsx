"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";

/** İçinde bulunduğu form gönderilirken kendini devre dışı bırakan gönder düğmesi. */
export function SubmitButton({ disabled, ...props }: Omit<ComponentProps<"button">, "type">) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending || disabled} {...props} />;
}
