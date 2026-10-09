import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { ErrorState, Spinner } from "../../components/States";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../services/api";
import type { DonationSettings } from "../../types";
import { formatVND } from "../../utils/format";

const MAX_PRESETS = 8;

export default function AdminDonation() {
  const { data, loading, error, reload } = useAsync(api.admin.donationSettings);
  const [settings, setSettings] = useState<DonationSettings | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) setSettings(data);
  }, [data]);

  if (loading) return <Spinner label="Đang tải cấu hình ủng hộ" />;
  if (error) {
    return (
      <ErrorState message={error} onRetry={reload} />
    );
  }
  if (!settings) {
    return <ErrorState message="Không tìm thấy cấu hình ủng hộ." onRetry={reload} />;
  }

  function updatePreset(index: number, value: string) {
    if (!settings) return;
    const presetAmounts = [...settings.presetAmounts];
    presetAmounts[index] = value === "" ? 0 : Number(value);
    setSettings({ ...settings, presetAmounts });
  }

  function addPreset() {
    if (!settings || settings.presetAmounts.length >= MAX_PRESETS) return;
    setSettings({ ...settings, presetAmounts: [...settings.presetAmounts, 0] });
  }

  function removePreset(index: number) {
    if (!settings || settings.presetAmounts.length <= 1) return;
    setSettings({
      ...settings,
      presetAmounts: settings.presetAmounts.filter((_, i) => i !== index),
    });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const currentSettings = settings;
    if (!currentSettings) return;
    if (
      !currentSettings.message.trim() ||
      !currentSettings.disclaimer.trim() ||
      currentSettings.presetAmounts.length < 1 ||
      currentSettings.presetAmounts.length > MAX_PRESETS ||
      currentSettings.presetAmounts.some(
        (amount) => !Number.isSafeInteger(amount) || amount <= 0,
      ) ||
      new Set(currentSettings.presetAmounts).size !== currentSettings.presetAmounts.length
    ) {
      toast.error("Nhập nội dung hợp lệ và các mức tiền nguyên dương, không trùng nhau.");
      return;
    }

    setBusy(true);
    try {
      const saved = await api.admin.updateDonationSettings(currentSettings);
      setSettings(saved);
      toast.success(
        saved.isEnabled
          ? "Đã lưu và công khai mục ủng hộ"
          : "Đã lưu cấu hình; mục ủng hộ đang ẩn",
      );
      reload();
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Không thể lưu cấu hình ủng hộ.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">Cấu hình ủng hộ</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Chỉnh nội dung và các mức tiền trước. Chỉ bật công khai khi bạn đã duyệt xong.
        </p>
      </div>

      <form onSubmit={save} className="card space-y-5 p-5 sm:p-7">
        <label className="flex items-center gap-3 rounded-2xl bg-pink-50 p-4">
          <input
            type="checkbox"
            checked={settings.isEnabled}
            onChange={(event) =>
              setSettings({ ...settings, isEnabled: event.target.checked })
            }
            className="h-5 w-5 accent-pink-500"
          />
          <span>
            <span className="block font-bold">Công khai mục ủng hộ</span>
            <span className="mt-1 block text-sm text-ink-soft">
              {settings.isEnabled
                ? "Người dùng có thể xem và tạo mã QR."
                : "Đang ẩn khỏi người dùng; chỉ admin xem được cấu hình."}
            </span>
          </span>
        </label>

        <div>
          <label htmlFor="donation-message" className="label">
            Nội dung giới thiệu
          </label>
          <textarea
            id="donation-message"
            required
            maxLength={2000}
            rows={4}
            value={settings.message}
            onChange={(event) =>
              setSettings({ ...settings, message: event.target.value })
            }
            className="input resize-y"
          />
          <p className="mt-1 text-right text-xs text-ink-soft">
            {settings.message.length}/2000
          </p>
        </div>

        <div>
          <label htmlFor="donation-disclaimer" className="label">
            Lưu ý về việc sử dụng tiền ủng hộ
          </label>
          <textarea
            id="donation-disclaimer"
            required
            maxLength={2000}
            rows={3}
            value={settings.disclaimer}
            onChange={(event) =>
              setSettings({ ...settings, disclaimer: event.target.value })
            }
            className="input resize-y"
          />
          <p className="mt-1 text-right text-xs text-ink-soft">
            {settings.disclaimer.length}/2000
          </p>
        </div>

        <fieldset>
          <legend className="label">Các mức tiền gợi ý (VNĐ)</legend>
          <div className="space-y-2">
            {settings.presetAmounts.map((amount, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  aria-label={`Mức tiền gợi ý ${index + 1}`}
                  value={amount || ""}
                  onChange={(event) => updatePreset(index, event.target.value)}
                  className="input"
                />
                <span className="shrink-0 text-sm text-ink-soft">₫</span>
                <button
                  type="button"
                  onClick={() => removePreset(index)}
                  disabled={settings.presetAmounts.length <= 1}
                  className="btn-danger !px-3"
                  aria-label={`Xóa mức tiền ${index + 1}`}
                >
                  Xóa
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addPreset}
            disabled={settings.presetAmounts.length >= MAX_PRESETS}
            className="btn-soft mt-3"
          >
            Thêm mức tiền
          </button>
          <p className="mt-2 text-xs text-ink-soft">
            Tối đa {MAX_PRESETS} mức; giá trị phải là số nguyên dương và không trùng nhau.
          </p>
        </fieldset>

        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? "Đang lưu..." : "Lưu cấu hình"}
        </button>
      </form>

      <section className="rounded-3xl border border-pink-200 bg-pink-50/60 p-5 sm:p-7">
        <p className="text-xs font-bold uppercase tracking-wide text-pink-700">
          Xem trước
        </p>
        <h2 className="mt-2 text-2xl font-extrabold">Ủng hộ LovelyBar</h2>
        <p className="mt-3 whitespace-pre-line leading-7 text-ink-soft">
          {settings.message || "Nội dung giới thiệu sẽ hiển thị tại đây."}
        </p>
        <p className="mt-3 whitespace-pre-line rounded-2xl bg-white p-4 text-sm leading-6 text-ink-soft">
          <strong className="text-ink">Lưu ý:</strong>{" "}
          {settings.disclaimer || "Lưu ý sẽ hiển thị tại đây."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {settings.presetAmounts.map((amount, index) => (
            <span
              key={`${amount}-${index}`}
              className="rounded-full border border-pink-200 bg-white px-4 py-2 text-sm font-bold text-pink-700"
            >
              {amount > 0 ? formatVND(amount) : "Chưa nhập số tiền"}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
