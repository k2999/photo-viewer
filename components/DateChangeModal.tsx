"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { parsePastedLocalDateTime } from "@/lib/localDateTimePaste";

type DateFields = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
};

function fieldsFromValue(value: string): DateFields {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/
  );
  if (!match) {
    return { year: "", month: "", day: "", hour: "", minute: "", second: "" };
  }
  return {
    year: match[1],
    month: match[2],
    day: match[3],
    hour: match[4],
    minute: match[5],
    second: match[6] ?? "00",
  };
}

function normalizePart(value: string) {
  return value.padStart(2, "0");
}

const fieldDefinitions = [
  { key: "year", label: "年", maxLength: 4, placeholder: "YYYY", min: 1, max: 9999 },
  { key: "month", label: "月", maxLength: 2, placeholder: "MM", min: 1, max: 12 },
  { key: "day", label: "日", maxLength: 2, placeholder: "DD", min: 1, max: 31 },
  { key: "hour", label: "時", maxLength: 2, placeholder: "hh", min: 0, max: 23 },
  { key: "minute", label: "分", maxLength: 2, placeholder: "mm", min: 0, max: 59 },
  { key: "second", label: "秒", maxLength: 2, placeholder: "ss", min: 0, max: 59 },
] as const;

type FieldKey = (typeof fieldDefinitions)[number]["key"];

function validateFields(fields: DateFields) {
  if (fields.year.length !== 4) return "年は4桁で入力してください";
  if (Object.values(fields).some((value) => value === "")) return "日時をすべて入力してください";
  const year = Number(fields.year);
  const month = Number(fields.month);
  const day = Number(fields.day);
  const hour = Number(fields.hour);
  const minute = Number(fields.minute);
  const second = Number(fields.second);
  const date = new Date(year, month - 1, day, hour, minute, second);
  if (
    year < 1 ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute ||
    date.getSeconds() !== second
  ) {
    return "存在しない日時です";
  }
  return null;
}

export type DateChangeModalProps = {
  open: boolean;
  count: number;
  initialValue: string;
  busy: boolean;
  error: string | null;
  onSubmit: (localDateTime: string) => void;
  onCancel: () => void;
};

export function DateChangeModal({
  open,
  count,
  initialValue,
  busy,
  error,
  onSubmit,
  onCancel,
}: DateChangeModalProps) {
  const [fields, setFields] = useState<DateFields>(() => fieldsFromValue(initialValue));
  const inputRefs = useRef<Partial<Record<FieldKey, HTMLInputElement | null>>>({});
  const validationError = useMemo(() => validateFields(fields), [fields]);

  useEffect(() => {
    if (open) setFields(fieldsFromValue(initialValue));
  }, [open, initialValue]);

  if (!open) return null;

  const focusField = (index: number) => {
    const definition = fieldDefinitions[index];
    if (!definition) return;
    const input = inputRefs.current[definition.key];
    input?.focus();
    input?.select();
  };

  const updateField = (key: FieldKey, value: string) => {
    setFields((current) => ({ ...current, [key]: value }));
  };

  const applyPastedDate = (text: string) => {
    const parsed = parsePastedLocalDateTime(text);
    if (!parsed) return false;
    setFields(parsed);
    return true;
  };

  return (
    <div className="date-change-backdrop" onClick={busy ? undefined : onCancel}>
      <form
        className="date-change-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="date-change-title"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !busy) onCancel();
        }}
        onSubmit={(event) => {
          event.preventDefault();
          if (busy || validationError) return;
          const value = `${fields.year}-${normalizePart(fields.month)}-${normalizePart(fields.day)}T${normalizePart(fields.hour)}:${normalizePart(fields.minute)}:${normalizePart(fields.second)}`;
          onSubmit(value);
        }}
      >
        <h2 id="date-change-title">日時を変更</h2>
        <p>{count}件のメディアの日時とファイル名を変更します。</p>
        <fieldset className="date-change-fields">
          <legend>ローカル日時</legend>
          <div className="date-change-input-group" data-invalid={validationError ? "true" : "false"}>
            {fieldDefinitions.map((definition, index) => (
              <div className="date-change-input-part" key={definition.key}>
                {index === 3 && <span className="date-change-date-time-gap" aria-hidden="true" />}
                <label>
                  <span>{definition.label}</span>
                  <input
                    ref={(node) => {
                      inputRefs.current[definition.key] = node;
                    }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={definition.maxLength}
                    required
                    autoFocus={index === 0}
                    aria-label={definition.label}
                    placeholder={definition.placeholder}
                    value={fields[definition.key]}
                    onFocus={(event) => event.currentTarget.select()}
                    onPaste={(event) => {
                      if (applyPastedDate(event.clipboardData.getData("text"))) {
                        event.preventDefault();
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Backspace" && fields[definition.key] === "" && index > 0) {
                        event.preventDefault();
                        focusField(index - 1);
                        return;
                      }
                      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
                      event.preventDefault();
                      const current = Number(fields[definition.key] || definition.min);
                      const delta = event.key === "ArrowUp" ? 1 : -1;
                      const range = definition.max - definition.min + 1;
                      const next = ((current - definition.min + delta + range) % range) + definition.min;
                      updateField(
                        definition.key,
                        definition.key === "year" ? String(next).padStart(4, "0") : normalizePart(String(next))
                      );
                    }}
                    onChange={(event) => {
                      const next = event.target.value
                        .replace(/\D/g, "")
                        .slice(0, definition.maxLength);
                      updateField(definition.key, next);
                      if (next.length === definition.maxLength && index < fieldDefinitions.length - 1) {
                        focusField(index + 1);
                      }
                    }}
                    disabled={busy}
                  />
                </label>
                {index < fieldDefinitions.length - 1 && index !== 2 && (
                  <span className="date-change-separator" aria-hidden="true">
                    {index < 2 ? "/" : ":"}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="date-change-field-footer">
            <span className="date-change-validation" data-valid={validationError ? "false" : "true"}>
              {validationError ?? "有効な日時です"}
            </span>
          </div>
        </fieldset>
        {error && <div className="date-change-error">{error}</div>}
        <div className="date-change-actions">
          <button type="button" onClick={onCancel} disabled={busy}>
            キャンセル
          </button>
          <button type="submit" disabled={busy || !!validationError}>
            {busy ? "変更中…" : "変更"}
          </button>
        </div>
      </form>
    </div>
  );
}
