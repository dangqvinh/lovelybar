import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import QrPanel from "../components/QrPanel";
import { ErrorState, Spinner } from "../components/States";
import type { QRResult } from "../types";
import { useAsync } from "../hooks/useAsync";
import { api } from "../services/api";
import { formatVND } from "../utils/format";

export default function Donation() {
  const settings = useAsync(api.donationSettings);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [qr, setQr] = useState<QRResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (settings.data?.presetAmounts.length) {
      setSelectedAmount(settings.data.presetAmounts[0]);
    }
  }, [settings.data]);

  const amount =
    selectedAmount ?? (customAmount.trim() ? Number(customAmount) : NaN);
  const validAmount = Number.isSafeInteger(amount) && amount > 0;

  async function createDonationQR() {
    if (!validAmount || loading || !settings.data?.isEnabled) return;
    setLoading(true);
    setError(null);
    setQr(null);
    try {
      setQr(await api.generateDonationQR(amount));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không thể tạo mã QR ủng hộ.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (settings.loading) return <Spinner label="Đang tải thông tin ủng hộ" />;
  if (settings.error) {
    return (
      <ErrorState
        message={settings.error}
        onRetry={settings.reload}
      />
    );
  }
  if (!settings.data?.isEnabled) return <Navigate to="/" replace />;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section className="rounded-3xl border border-pink-200 bg-pink-50/60 p-6 sm:p-8">
        <h1 className="text-3xl font-extrabold">Ủng hộ LovelyBar</h1>
        <p className="mt-4 leading-7 text-ink-soft">{settings.data.message}</p>
        <p className="mt-3 rounded-2xl bg-white p-4 text-sm leading-6 text-ink-soft">
          <strong className="text-ink">Lưu ý:</strong> {settings.data.disclaimer}
        </p>

        <fieldset className="mt-6">
          <legend className="text-sm font-bold">Chọn số tiền ủng hộ</legend>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {settings.data.presetAmounts.map((preset) => (
              <button
                key={preset}
                type="button"
                aria-pressed={selectedAmount === preset}
                onClick={() => {
                  setSelectedAmount(preset);
                  setCustomAmount("");
                  setQr(null);
                  setError(null);
                }}
                className={`rounded-2xl border px-3 py-3 text-sm font-bold transition ${
                  selectedAmount === preset
                    ? "border-pink-500 bg-pink-100 text-pink-700"
                    : "border-line bg-white text-ink-soft hover:border-pink-300"
                }`}
              >
                {formatVND(preset)}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-4">
          <label
            htmlFor="donation-amount"
            className="block text-sm font-bold"
          >
            Hoặc nhập số tiền khác (VNĐ)
          </label>
          <input
            id="donation-amount"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={customAmount}
            onChange={(event) => {
              setCustomAmount(event.target.value);
              setSelectedAmount(null);
              setQr(null);
              setError(null);
            }}
            placeholder="Ví dụ: 25000"
            className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 text-ink outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
          />
        </div>

        <button
          type="button"
          onClick={createDonationQR}
          disabled={!validAmount || loading}
          className="btn-primary mt-5 w-full disabled:cursor-not-allowed disabled:opacity-50"
        >
          Tạo mã QR ủng hộ {validAmount ? formatVND(amount) : ""}
        </button>
        {error && (
          <p role="alert" className="mt-3 text-sm font-semibold text-red-600">
            {error}
          </p>
        )}
      </section>

      {loading && <Spinner label="Đang tạo mã QR ủng hộ" />}
      {qr && <QrPanel qr={qr} donation />}
    </div>
  );
}
