"use client";

import { useState } from "react";
import type { Dictionary, Locale } from "@/i18n/dictionaries";
import { NationalityPicker } from "@/components/nationality-picker";
import { isValidTckn } from "@/lib/tckn";

/**
 * Bir misafirin otel girişinde istenen bilgileri. T.C. vatandaşı için T.C. Kimlik No,
 * diğer uyruklar için pasaport no istenir. Telefon dışındaki alanlar zorunludur.
 */
export function GuestFields({ index, t, locale, today }: { index: number; t: Dictionary["clinic"]; locale: Locale; today: string }) {
  const [nationality, setNationality] = useState("");
  const turkish = nationality === "TR";
  const prefix = `${t.guest} ${index + 1}`;
  const idLabel = turkish ? t.tckn : t.passportNo;

  return (
    <fieldset className="grid gap-3 rounded-lg border border-line p-3 sm:grid-cols-2">
      <legend className="px-1 text-sm font-semibold">{prefix}</legend>
      <label className="block sm:col-span-2">
        <span className="text-xs font-medium">{t.guestName} *</span>
        <input name={`guest_${index}_name`} required data-label={`${prefix}: ${t.guestName}`} autoComplete="off" className="input mt-1" />
        <span className="mt-1 block text-xs text-muted">{t.guestNameHint}</span>
      </label>
      <NationalityPicker
        name={`guest_${index}_nationality`}
        locale={locale}
        label={t.nationality}
        fieldLabel={`${prefix}: ${t.nationality}`}
        placeholder={t.nationalityPlaceholder}
        invalidMessage={t.nationalityPick}
        noResults={t.nationalityNone}
        onChange={setNationality}
      />
      <label className="block">
        <span className="text-xs font-medium">{nationality ? idLabel : t.idNumber} *</span>
        <input
          key={turkish ? "tckn" : "passport"}
          name={`guest_${index}_id_number`}
          required
          data-label={`${prefix}: ${nationality ? idLabel : t.idNumber}`}
          autoComplete="off"
          inputMode={turkish ? "numeric" : "text"}
          maxLength={turkish ? 11 : 20}
          placeholder={nationality ? undefined : t.idNumberPickNationality}
          onChange={(e) => {
            const v = e.target.value.replace(/\s/g, "").toUpperCase();
            let message = "";
            if (v && turkish && !isValidTckn(v)) message = t.errors.invalid_tckn;
            if (v && nationality && !turkish && !/^[A-Z0-9]{5,20}$/.test(v)) message = t.errors.invalid_passport;
            e.target.setCustomValidity(message);
          }}
          className="input mt-1 uppercase placeholder:normal-case"
        />
      </label>
      <label className="block">
        <span className="text-xs font-medium">{t.birthDate} *</span>
        <input name={`guest_${index}_birth_date`} type="date" required min="1900-01-01" max={today} data-label={`${prefix}: ${t.birthDate}`} className="input mt-1" />
      </label>
      <label className="block">
        <span className="text-xs font-medium">{t.gender} *</span>
        <select name={`guest_${index}_gender`} required defaultValue="" data-label={`${prefix}: ${t.gender}`} className="input mt-1">
          <option value="" disabled>
            {t.choose}
          </option>
          <option value="F">{t.female}</option>
          <option value="M">{t.male}</option>
        </select>
      </label>
      <label className="block sm:col-span-2">
        <span className="text-xs font-medium">{t.phone}</span>
        <input name={`guest_${index}_phone`} type="tel" autoComplete="off" className="input mt-1" />
      </label>
    </fieldset>
  );
}
