// components/asa/ecl/PortfolioEclByAgingChart.tsx
import type { FC } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
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

// register chart.js pieces once
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
);

type MixedChartType = "bar" | "line";

interface PortfolioEclByAgingChartProps {
  rows: AgingPortfolioRow[];
}

const formatShortPeso = (value: number) => {
  if (value >= 1_000_000_000) return `₱${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `₱${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `₱${(value / 1_000).toFixed(0)}k`;
  return `₱${value.toFixed(0)}`;
};

const PortfolioEclByAgingChart: FC<PortfolioEclByAgingChartProps> = ({
  rows,
}) => {
  const labels = rows.map((r) => r.agingCategory);

  const loanBalances = rows.map((r) => r.loanBalance);
  const eclRates = rows.map((r) =>
    r.loanBalance > 0 ? (r.weightedEcl / r.loanBalance) * 100 : 0,
  );

  const data: ChartData<MixedChartType, number[], string> = {
    labels,
    datasets: [
      {
        type: "bar",
        label: "Loan Balance",
        data: loanBalances,
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
        pointRadius: 3,
        pointHoverRadius: 4,
        borderColor: "rgba(37, 99, 235, 1)", // blue-600
        backgroundColor: "rgba(37, 99, 235, 1)",
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
              return `Loan Balance: ${raw.toLocaleString("en-PH", {
                style: "currency",
                currency: "PHP",
                maximumFractionDigits: 2,
              })}`;
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
        grid: {
          display: false,
        },
        ticks: {
          font: { size: 10 },
        },
      },
      y: {
        type: "linear",
        position: "left",
        grid: {
          color: "rgba(148, 163, 184, 0.25)", // slate-400/25
        },
        ticks: {
          font: { size: 10 },
          callback: (value) => formatShortPeso(Number(value)),
        },
        title: {
          display: true,
          text: "Loan Balance (PHP)",
          font: { size: 11 },
        },
      },
      y1: {
        type: "linear",
        position: "right",
        grid: {
          drawOnChartArea: false,
        },
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
