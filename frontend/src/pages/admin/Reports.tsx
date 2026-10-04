import { useMemo, useState } from "react";
import { EmptyState, ErrorState, Spinner } from "../../components/States";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../services/api";
import { formatVND } from "../../utils/format";
import type { ProductSalesReportRow, SalesReportRow } from "../../types";

type Granularity = "day" | "month";

function localDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatPeriod(date: string, granularity: Granularity): string {
  const parsed = new Date(`${date}T12:00:00`);
  return granularity === "day"
    ? parsed.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : parsed.toLocaleDateString("vi-VN", {
        month: "long",
        year: "numeric",
      });
}

function SummaryCard({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-ink-soft">{label}</p>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>
      {note && <p className="mt-1 text-xs text-ink-soft">{note}</p>}
    </div>
  );
}

type ChartSeries = {
  key: keyof Pick<
    SalesReportRow,
    "expectedRevenue" | "confirmedRevenue" | "totalOrders" | "completedOrders"
  >;
  label: string;
  color: string;
  fillColor: string;
};

function ReportColumnChart({
  title,
  rows,
  series,
  valueFormatter,
  granularity,
}: {
  title: string;
  rows: SalesReportRow[];
  series: ChartSeries[];
  valueFormatter: (value: number) => string;
  granularity: Granularity;
}) {
  const width = 900;
  const height = 300;
  const left = 76;
  const right = 20;
  const top = 18;
  const bottom = 80;
  const chartWidth = Math.max(width - left - right, rows.length * 72);
  const chartHeight = height - top - bottom;
  const fullWidth = left + chartWidth + right;
  const maxValue = Math.max(
    ...rows.flatMap((row) => series.map((item) => Number(row[item.key]))),
    1,
  );
  const groupWidth = chartWidth / rows.length;
  const groupPadding = Math.min(12, groupWidth * 0.16);
  const barGap = 4;
  const barWidth = Math.max(
    2,
    (groupWidth - groupPadding * 2 - barGap * (series.length - 1)) / series.length,
  );
  const y = (value: number) => top + chartHeight - (value / maxValue) * chartHeight;
  const labelStep = Math.max(1, Math.ceil(rows.length / 14));

  return (
    <section className="card p-4 sm:p-5" aria-label={title}>
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-soft">
        {series.map((item) => (
          <span key={item.key} className="inline-flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-sm ${item.color}`} aria-hidden="true" />
            {item.label}
          </span>
        ))}
      </div>
      <div className="mt-3 overflow-x-auto">
        <svg
          viewBox={`0 0 ${fullWidth} ${height}`}
          className="h-[320px] min-w-[700px] w-full"
          role="img"
          aria-label={`${title}, biểu đồ cột gồm ${rows.length} kỳ`}
        >
          {[0, 1, 2, 3, 4].map((tick) => {
            const value = (maxValue * tick) / 4;
            const tickY = y(value);
            return (
              <g key={tick}>
                <line
                  x1={left}
                  x2={fullWidth - right}
                  y1={tickY}
                  y2={tickY}
                  className="stroke-line"
                  strokeDasharray={tick === 0 ? undefined : "4 5"}
                />
                <text
                  x={left - 10}
                  y={tickY + 4}
                  textAnchor="end"
                  className="fill-ink-soft"
                  fontSize="11"
                >
                  {valueFormatter(value)}
                </text>
              </g>
            );
          })}
          {rows.map((row, rowIndex) => {
            const groupX = left + rowIndex * groupWidth;
            return (
              <g key={row.periodStart}>
                {series.map((item, seriesIndex) => {
                  const value = Number(row[item.key]);
                  const barHeight = (value / maxValue) * chartHeight;
                  const barX =
                    groupX +
                    groupPadding +
                    seriesIndex * (barWidth + barGap);
                  const barY = top + chartHeight - barHeight;
                  return (
                    <rect
                      key={item.key}
                      x={barX}
                      y={barY}
                      width={barWidth}
                      height={Math.max(0, barHeight)}
                      rx="3"
                      className={item.fillColor}
                    >
                      <title>{`${formatPeriod(row.periodStart, granularity)}: ${item.label} ${valueFormatter(value)}`}</title>
                    </rect>
                  );
                })}
                {rowIndex % labelStep === 0 || rowIndex === rows.length - 1 ? (
                  <text
                    x={groupX + groupWidth / 2}
                    y={height - 12}
                    textAnchor="middle"
                    className="fill-ink-soft"
                    fontSize="11"
                  >
                    {formatPeriod(row.periodStart, granularity)}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}

function BestSellersChart({ rows }: { rows: ProductSalesReportRow[] }) {
  const width = Math.max(760, rows.length * 90 + 100);
  const height = 360;
  const left = 60;
  const right = 20;
  const top = 20;
  const bottom = 112;
  const chartHeight = height - top - bottom;
  const chartWidth = width - left - right;
  const maxValue = Math.max(...rows.map((row) => row.quantitySold), 1);
  const groupWidth = chartWidth / rows.length;
  const barWidth = Math.min(52, groupWidth * 0.56);
  const y = (value: number) => top + chartHeight - (value / maxValue) * chartHeight;

  return (
    <section className="card p-4 sm:p-5" aria-label="Sản phẩm bán chạy">
      <div>
        <h2 className="text-lg font-bold">Sản phẩm bán chạy</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Xếp theo số lượng trong đơn đã hoàn tất và được admin xác nhận.
        </p>
      </div>
      <div className="mt-3 overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-[340px] min-w-[700px] w-full"
          role="img"
          aria-label={`Biểu đồ cột top ${rows.length} sản phẩm bán chạy`}
        >
          {[0, 1, 2, 3, 4].map((tick) => {
            const value = Math.round((maxValue * tick) / 4);
            const tickY = y(value);
            return (
              <g key={tick}>
                <line
                  x1={left}
                  x2={width - right}
                  y1={tickY}
                  y2={tickY}
                  className="stroke-line"
                  strokeDasharray={tick === 0 ? undefined : "4 5"}
                />
                <text
                  x={left - 10}
                  y={tickY + 4}
                  textAnchor="end"
                  className="fill-ink-soft"
                  fontSize="11"
                >
                  {value}
                </text>
              </g>
            );
          })}
          {rows.map((row, index) => {
            const center = left + groupWidth * (index + 0.5);
            const barHeight = (row.quantitySold / maxValue) * chartHeight;
            const label = row.productName.length > 18
              ? `${row.productName.slice(0, 17)}…`
              : row.productName;
            return (
              <g key={`${row.productName}-${index}`}>
                <rect
                  x={center - barWidth / 2}
                  y={top + chartHeight - barHeight}
                  width={barWidth}
                  height={barHeight}
                  rx="4"
                  className="fill-pink-500"
                >
                  <title>{`${row.productName}: ${row.quantitySold} sản phẩm · ${row.orderCount} đơn · ${formatVND(row.confirmedRevenue)}`}</title>
                </rect>
                <text
                  x={center}
                  y={top + chartHeight - barHeight - 7}
                  textAnchor="middle"
                  className="fill-ink"
                  fontSize="11"
                  fontWeight="600"
                >
                  {row.quantitySold}
                </text>
                <text
                  transform={`translate(${center - 4},${height - bottom + 12}) rotate(-38)`}
                  textAnchor="end"
                  className="fill-ink-soft"
                  fontSize="11"
                >
                  <title>{row.productName}</title>
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}

export default function Reports() {
  const now = new Date();
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [fromDate, setFromDate] = useState(
    localDate(new Date(now.getFullYear(), now.getMonth(), 1)),
  );
  const [toDate, setToDate] = useState(localDate(now));
  const { data, loading, error, reload } = useAsync(
    () => api.admin.salesReport(granularity, fromDate, toDate),
    [granularity, fromDate, toDate],
  );
  const {
    data: topProducts,
    loading: productsLoading,
    error: productsError,
    reload: reloadProducts,
  } = useAsync(
    () => api.admin.topProductsReport(fromDate, toDate),
    [fromDate, toDate],
  );

  const summary = useMemo(
    () =>
      (data ?? []).reduce(
        (total, row) => ({
          orders: total.orders + row.totalOrders,
          expectedRevenue: total.expectedRevenue + row.expectedRevenue,
          confirmedRevenue: total.confirmedRevenue + row.confirmedRevenue,
        }),
        { orders: 0, expectedRevenue: 0, confirmedRevenue: 0 },
      ),
    [data],
  );

  function changeGranularity(next: Granularity) {
    if (next === granularity) return;
    const today = new Date();
    setGranularity(next);
    setFromDate(
      localDate(
        next === "day"
          ? new Date(today.getFullYear(), today.getMonth(), 1)
          : new Date(today.getFullYear(), 0, 1),
      ),
    );
    setToDate(localDate(today));
  }

  const invalidRange = fromDate > toDate;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">Báo cáo cửa hàng</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Thống kê số đơn và doanh thu theo ngày hoặc tháng. Doanh thu dự kiến
          không đồng nghĩa với số tiền đã nhận.
        </p>
      </div>

      <section className="card flex flex-wrap items-end gap-4 p-4 sm:p-5" aria-label="Bộ lọc báo cáo">
        <fieldset className="flex gap-2">
          <legend className="label">Gộp theo</legend>
          <button
            type="button"
            aria-pressed={granularity === "day"}
            onClick={() => changeGranularity("day")}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${granularity === "day" ? "bg-pink-500 text-white" : "border border-line text-ink-soft hover:border-pink-300"}`}
          >
            Ngày
          </button>
          <button
            type="button"
            aria-pressed={granularity === "month"}
            onClick={() => changeGranularity("month")}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${granularity === "month" ? "bg-pink-500 text-white" : "border border-line text-ink-soft hover:border-pink-300"}`}
          >
            Tháng
          </button>
        </fieldset>
        <label className="block text-sm font-semibold">
          Từ ngày
          <input
            type="date"
            className="input mt-1"
            value={fromDate}
            max={toDate}
            onChange={(event) => setFromDate(event.target.value)}
          />
        </label>
        <label className="block text-sm font-semibold">
          Đến ngày
          <input
            type="date"
            className="input mt-1"
            value={toDate}
            min={fromDate}
            onChange={(event) => setToDate(event.target.value)}
          />
        </label>
      </section>

      {invalidRange ? (
        <p className="text-sm text-red-600" role="alert">
          Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.
        </p>
      ) : loading ? (
        <Spinner label="Đang tải báo cáo" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-3" aria-label="Tổng hợp trong khoảng thời gian">
            <SummaryCard label="Tổng số đơn" value={summary.orders} />
            <SummaryCard
              label="Doanh thu dự kiến"
              value={formatVND(summary.expectedRevenue)}
              note="Tổng đơn chưa bị hủy."
            />
            <SummaryCard
              label="Đã xác nhận"
              value={formatVND(summary.confirmedRevenue)}
              note="Đơn COMPLETED sau khi admin đối soát ngân hàng."
            />
          </section>

          {!data?.length ? (
            <EmptyState
              title="Chưa có đơn hàng trong khoảng này"
              text="Thử chọn khoảng thời gian khác."
            />
          ) : (
            <>
              <ReportColumnChart
                title="Doanh thu theo thời gian"
                rows={data}
                granularity={granularity}
                valueFormatter={(value) => {
                  if (value === 0) return "0";
                  return new Intl.NumberFormat("vi-VN", {
                    notation: "compact",
                    maximumFractionDigits: 1,
                  }).format(value);
                }}
                series={[
                  {
                    key: "expectedRevenue",
                    label: "Dự kiến",
                    color: "bg-pink-500",
                    fillColor: "fill-pink-500",
                  },
                  {
                    key: "confirmedRevenue",
                    label: "Đã xác nhận",
                    color: "bg-green-600",
                    fillColor: "fill-green-600",
                  },
                ]}
              />
              <ReportColumnChart
                title="Số đơn theo thời gian"
                rows={data}
                granularity={granularity}
                valueFormatter={(value) => String(Math.round(value))}
                series={[
                  {
                    key: "totalOrders",
                    label: "Tổng số đơn",
                    color: "bg-pink-500",
                    fillColor: "fill-pink-500",
                  },
                  {
                    key: "completedOrders",
                    label: "Đã hoàn tất",
                    color: "bg-green-600",
                    fillColor: "fill-green-600",
                  },
                ]}
              />
              {productsLoading ? (
                <Spinner label="Đang tải sản phẩm bán chạy" />
              ) : productsError ? (
                <ErrorState
                  message={productsError}
                  onRetry={reloadProducts}
                />
              ) : topProducts?.length ? (
                <BestSellersChart rows={topProducts} />
              ) : (
                <EmptyState
                  title="Chưa có sản phẩm bán chạy"
                  text="Chưa có đơn hàng hoàn tất trong khoảng thời gian này."
                />
              )}
              <div className="card overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-ink-soft">
                      <th className="p-4 font-semibold">{granularity === "day" ? "Ngày" : "Tháng"}</th>
                      <th className="p-4 text-right font-semibold">Số đơn</th>
                      <th className="p-4 text-right font-semibold">Đang chờ</th>
                      <th className="p-4 text-right font-semibold">Hoàn tất</th>
                      <th className="p-4 text-right font-semibold">Doanh thu dự kiến</th>
                      <th className="p-4 text-right font-semibold">Đã xác nhận</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row) => (
                      <tr key={row.periodStart} className="border-b border-line/60 last:border-0">
                        <td className="p-4 font-semibold">
                          {formatPeriod(row.periodStart, granularity)}
                        </td>
                        <td className="p-4 text-right">{row.totalOrders}</td>
                        <td className="p-4 text-right">{row.pendingOrders}</td>
                        <td className="p-4 text-right">{row.completedOrders}</td>
                        <td className="p-4 text-right font-semibold">
                          {formatVND(row.expectedRevenue)}
                        </td>
                        <td className="p-4 text-right font-semibold text-green-700">
                          {formatVND(row.confirmedRevenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
