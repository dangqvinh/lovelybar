import { useEffect, useState } from "react";
import { clampQty, MAX_QTY } from "../utils/format";

interface Props {
  value: number;
  onChange: (n: number) => void;
  size?: "sm" | "md";
}

export default function QuantityStepper({
  value,
  onChange,
  size = "md",
}: Props) {
  // Local text lets the user clear the field while typing; it is normalised on blur.
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);

  const dim = size === "sm" ? "h-8 w-8 text-base" : "h-10 w-10 text-lg";
  const btn = `${dim} grid place-items-center rounded-full bg-pink-100 font-bold text-pink-700 transition hover:bg-pink-200 disabled:opacity-40`;

  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        type="button"
        className={btn}
        onClick={() => onChange(clampQty(value - 1))}
        disabled={value <= 1}
        aria-label="Giảm số lượng"
      >
        −
      </button>
      <input
        inputMode="numeric"
        aria-label="Số lượng"
        value={text}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
          setText(digits);
          if (digits) onChange(clampQty(Number(digits)));
        }}
        onBlur={() => setText(String(value))}
        className={`${size === "sm" ? "h-8 w-12" : "h-10 w-14"} rounded-full border border-line bg-white text-center text-sm font-semibold focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-200`}
      />
      <button
        type="button"
        className={btn}
        onClick={() => onChange(clampQty(value + 1))}
        disabled={value >= MAX_QTY}
        aria-label="Tăng số lượng"
      >
        +
      </button>
    </div>
  );
}
