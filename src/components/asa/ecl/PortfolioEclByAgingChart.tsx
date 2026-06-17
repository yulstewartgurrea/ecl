// components/asa/ecl/PortfolioEclByAgingChart.tsx
import type { FC } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarController,
  LineController,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import { Chart as ReactChart } from "react-chartjs-2";

import type { AgingPortfolioRow } from "./AgingCategoryPortfolioEclTable";

// IMPORTANT: register BOTH controllers + elements (production build needs this)
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarController,
  LineController,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend
);

type MixedChartType = "bar" | "line";

interface PortfolioEclByAgingChartProps {
  rows: AgingPortfolioRow[];
}

const formatPesoMillions = (valueInMillions: number) => {
  const n = Number(valueInMillions);
  if (!Number.isFinite(n)) return "";
  return `₱${n.toLocaleString("en-PH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })}M`;
};

const PortfolioEclByAgingChart: FC<PortfolioEclByAgingChartProps> = ({ rows }) => {
  // Exclude summary rows from the chart buckets
  const chartRows = rows.filter((r) => {
    const k = String(r.agingCategory ?? "")
      .trim()
      .toLowerCase();
    return k !== "total" && k !== "ecl rate";
  });

  const labels = chartRows.map((r) => r.agingCategory);

  // Scale to millions so the axis auto-adjusts meaningfully for large datasets
  const loanBalancesM = chartRows.map((r) => r.loanBalance / 1_000_000);
  const eclRates = chartRows.map((r) =>
    r.loanBalance > 0 ? (r.weightedEcl / r.loanBalance) * 100 : 0
  );

  // Auto-cap the axis when there’s a huge outlier (prevents flattening everything else).
  const yAxisMax = (() => {
    const vals = loanBalancesM
      .map((v) => Number(v))
      .filter((v) => Number.isFinite(v) && v > 0)
      .sort((a, b) => a - b);

    if (vals.length < 4) return undefined;

    const max = vals[vals.length - 1];
    const p90 = vals[Math.floor(vals.length * 0.9)];
    if (!Number.isFinite(max) || !Number.isFinite(p90) || p90 <= 0) return undefined;

    if (max > p90 * 5) return p90 * 1.25;
    return undefined;
  })();

  const data: ChartData<MixedChartType, number[], string> = {
    labels,
    datasets: [
      {
        type: "bar",
        label: "Loan Balance",
        data: loanBalancesM,
        yAxisID: "y",
        borderWidth: 0,
        backgroundColor: "rgba(251, 191, 36, 0.7)", // amber-400-ish
        hoverBackgroundColor: "rgba(245, 158, 11, 0.9)", // amber-500-ish
        borderRadius: 4,
      },
      {
        type: "line",
        label: "ECL Rate",
        data: eclRates,
        yAxisID: "y1",
        borderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
        borderColor: "rgba(37, 99, 235, 1)", // blue-600
        backgroundColor: "rgba(37, 99, 235, 1)",
        pointBackgroundColor: "rgba(255, 255, 255, 1)",
        pointBorderColor: "rgba(37, 99, 235, 1)",
        pointBorderWidth: 2,
        tension: 0.25,
      },
    ],
  };

  const options: ChartOptions<MixedChartType> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index",
      intersect: false,
    },
    plugins: {
      legend: {
        position: "top",
        labels: {
          font: { size: 11 },
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const raw = ctx.raw as number;

            if (ctx.dataset.label === "Loan Balance") {
              return `Loan Balance: ${formatPesoMillions(raw)}`;
            }
            if (ctx.dataset.label === "ECL Rate") {
              return `ECL Rate: ${raw.toFixed(2)}%`;
            }
            return `${ctx.dataset.label}: ${raw}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 10 } },
      },
      y: {
        type: "linear",
        position: "left",
        max: yAxisMax,
        grace: "5%",
        grid: {
          color: "rgba(148, 163, 184, 0.25)", // slate-400/25
        },
        ticks: {
          font: { size: 10 },
          callback: (value) => formatPesoMillions(Number(value)),
        },
        title: {
          display: true,
          text: "Loan Balance (₱M)",
          font: { size: 11 },
        },
      },
      y1: {
        type: "linear",
        position: "right",
        grid: { drawOnChartArea: false },
        ticks: {
          font: { size: 10 },
          callback: (value) => `${Number(value).toFixed(1)}%`,
        },
        title: {
          display: true,
          text: "ECL Rate (%)",
          font: { size: 11 },
        },
        min: 0,
      },
    },
  };

  return (
    <div className="h-80 w-full lg:h-[380px]">
      <ReactChart type="bar" data={data} options={options} />
    </div>
  );
};

export default PortfolioEclByAgingChart;
