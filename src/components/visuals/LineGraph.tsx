// "use client";
// import { useEffect, useRef } from "react";
// import clsx from "clsx";
// import {
//   Chart,
//   LineController,
//   LineElement,
//   PointElement,
//   LinearScale,
//   Title,
//   CategoryScale,
//   Tooltip,
//   Legend,
// } from "chart.js";
// import { formatValueGeneral } from "../../utils/CommonHelper";

// Chart.register(
//   LineController,
//   LineElement,
//   PointElement,
//   LinearScale,
//   Title,
//   CategoryScale,
//   Tooltip,
//   Legend
// );

// const calculateStepSize = (minValue: number, maxValue: number): number => {
//   const range = maxValue - minValue;
//   const roughStep = range / 10;
//   const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
//   let stepSize = Math.ceil(roughStep / magnitude) * magnitude;

//   if (stepSize <= 5 * magnitude) {
//     stepSize = 5 * magnitude;
//   } else {
//     stepSize = 10 * magnitude;
//   }

//   return stepSize;
// };

// export default function LineGraph({
//   xValues,
//   yValues,
//   dataLabel,
//   xAxisLabel,
//   yAxisLabel,
//   stepSize,
//   title,
//   format = "original",
//   yAxisLabelFormat = "original",
//   decimalPlaces = 2,
//   showGrid = true,
//   showYLabels = false,
//   showPointLabels = false,
//   additional_css
// }: {
//   xValues: string[];
//   yValues: any[];
//   dataLabel?: string;
//   xAxisLabel?: string;
//   yAxisLabel?: string;
//   stepSize?: number;
//   title?: string;
//   format?: "currency" | "percent" | "original";
//   yAxisLabelFormat?: "currency" | "percent" | "original";
//   decimalPlaces?: number;
//   showGrid?: boolean;
//   showYLabels?: boolean;
//   showPointLabels? : boolean
//   additional_css?: any
// }) {
//   const chartRef = useRef<HTMLCanvasElement>(null);
//   const chartInstanceRef = useRef<Chart | null>(null);

//   useEffect(() => {
//     if (!chartRef.current) return;
//     const ctx = chartRef.current.getContext("2d");
//     if (ctx === null) return;

//     if (chartInstanceRef.current) {
//       chartInstanceRef.current.destroy();
//     }

//     let datasets = [];
//     let allYValues = [];

//     if (yValues.length > 0) {
//       if (
//         yValues.every(
//           (item) =>
//             typeof item === "object" && !Array.isArray(item) && item !== null
//         )
//       ) {
//         datasets = yValues;
//         allYValues = yValues.flatMap((dataset) => dataset.data);
//       } else {
//         datasets = [
//           {
//             label: dataLabel || "Data",
//             data: yValues,
//             borderColor: "rgba(75, 192, 192, 1)",
//             backgroundColor: "rgba(75, 192, 192, 0.2)",
//             fill: false,
//             tension: 0.1,
//           },
//         ];
//         allYValues = yValues;
//       }
//     }

//     const minY = Math.min(...allYValues);
//     const maxY = Math.max(...allYValues);
//     const calculatedStepSize = calculateStepSize(minY, maxY);

//     const mapFormat = (val: "currency" | "percent" | "original") => {
//       if (val === "currency") return "money";
//       if (val === "percent") return "percentage";
//       return "decimal";
//     };

//     chartInstanceRef.current = new Chart(ctx, {
//       type: "line",
//       data: {
//         labels: xValues,
//         datasets: datasets,
//       },
//       options: {
//         responsive: true,
//         plugins: {
//           title: {
//             display: true,
//             text: title !== undefined? title : `Line Chart`,
//             color: "#333333",
//           },
//           tooltip: {
//             backgroundColor: "rgba(0, 0, 0, 0.7)",
//             bodyFont: {
//               size: (ctx) => {
//                 const chartWidth = ctx.chart.width;
//                 return chartWidth < 400 ? 10 : 12;
//               },
//             },
//             padding: 10,
//             cornerRadius: 4,
//             callbacks: {
//               label: function (context) {
//                 if (context.parsed.y === null) return "";
//                 return formatValueGeneral(
//                   context.parsed.y,
//                   mapFormat(format),
//                   decimalPlaces
//                 );
//               },
//             },
//           },
//           legend: {
//             display: true,
//             position: "bottom",
//             align: "start",
//             labels: {
//               boxWidth: 10,
//               padding: 10,
//               color: "#333333",
//             },
//           },
//           datalabels: {
//             display: showPointLabels,
//           },
//         },
//         scales: {
//           x: {
//             title: {
//               display: !!xAxisLabel,
//               text: xAxisLabel || "",
//               color: "#333333",
//             },
//             grid: {
//               color: showGrid ? "#cccccc" : "transparent",
//             },
//             ticks: {
//               color: "#333333",
//               maxRotation: 90,
//               minRotation: 90,
//             },
//           },
//           y: {
//             title: {
//               display: yAxisLabel ? showYLabels : false,
//               text: yAxisLabel || "",
//               color: "#333333",
//             },
//             beginAtZero: true,
//             ticks: {
//               stepSize: stepSize || calculatedStepSize,
//               color: "#333333",
//               display: showYLabels,
//               callback: function (value) {
//                 if (!showYLabels) return "";
//                 return formatValueGeneral(
//                   Number(value),
//                   mapFormat(yAxisLabelFormat),
//                   decimalPlaces
//                 );
//               },
//             },
//             grid: {
//               color: showGrid ? "#cccccc" : "transparent",
//             },
//             min: stepSize
//               ? Math.floor(minY / stepSize) * stepSize
//               : Math.floor(minY / calculatedStepSize) * calculatedStepSize,
//             max: stepSize
//               ? Math.ceil(maxY / stepSize) * stepSize
//               : Math.ceil(maxY / calculatedStepSize) * calculatedStepSize,
//           },
//         },
//         maintainAspectRatio: false,
//         elements: {
//           line: {
//             backgroundColor: "#ffffff",
//           },
//           point: {
//             radius: 3,
//             backgroundColor: "#ffffff",
//           },
//         },
//       },
//     });

//     return () => {
//       if (chartInstanceRef.current) {
//         chartInstanceRef.current.destroy();
//       }
//     };
//   }, [
//     xValues,
//     yValues,
//     dataLabel,
//     xAxisLabel,
//     yAxisLabel,
//     stepSize,
//     title,
//     format,
//     yAxisLabelFormat,
//     decimalPlaces,
//     showGrid,
//     showYLabels,
//   ]);

//   return (
//     <div className={clsx("w-full h-full",[
//       additional_css?.outer_div
//     ])}>
//       <canvas ref={chartRef} className="w-full h-full" />
//     </div>
//   );
// }

"use client";
import { useEffect, useRef } from "react";
import clsx from "clsx";
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  Title,
  CategoryScale,
  Tooltip,
  Legend,
} from "chart.js";
import { formatValueGeneral } from "../../utils/CommonHelper";

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  Title,
  CategoryScale,
  Tooltip,
  Legend
);

const calculateStepSize = (minValue: number, maxValue: number): number => {
  const range = maxValue - minValue;
  const roughStep = range / 10;
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  let stepSize = Math.ceil(roughStep / magnitude) * magnitude;

  if (stepSize <= 5 * magnitude) {
    stepSize = 5 * magnitude;
  } else {
    stepSize = 10 * magnitude;
  }

  return stepSize;
};

export default function LineGraph({
  xValues,
  yValues,
  dataLabel,
  xAxisLabel,
  yAxisLabel,
  stepSize,
  title,
  format = "original",
  yAxisLabelFormat = "original",
  decimalPlaces = 2,
  showGrid = true,
  showYLabels = false,
  showPointLabels = false,
  additional_css,
  chartAreaBackgroundColor = "#ffffff", // ✅ Default to white
}: {
  xValues: string[];
  yValues: any[];
  dataLabel?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  stepSize?: number;
  title?: string;
  format?: "currency" | "percent" | "original";
  yAxisLabelFormat?: "currency" | "percent" | "original";
  decimalPlaces?: number;
  showGrid?: boolean;
  showYLabels?: boolean;
  showPointLabels?: boolean;
  additional_css?: any;
  chartAreaBackgroundColor?: string; // ✅ Optional prop
}) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    const ctx = chartRef.current.getContext("2d");
    if (ctx === null) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    let datasets = [];
    let allYValues = [];

    if (yValues.length > 0) {
      if (
        yValues.every(
          (item) =>
            typeof item === "object" && !Array.isArray(item) && item !== null
        )
      ) {
        datasets = yValues;
        allYValues = yValues.flatMap((dataset) => dataset.data);
      } else {
        datasets = [
          {
            label: dataLabel || "Data",
            data: yValues,
            borderColor: "yellow", // ✅ Yellow line
            backgroundColor: "rgba(255, 255, 0, 0.2)",
            fill: false,
            tension: 0.1,
          },
        ];
        allYValues = yValues;
      }
    }

    const minY = Math.min(...allYValues);
    const maxY = Math.max(...allYValues);
    const calculatedStepSize = calculateStepSize(minY, maxY);

    const mapFormat = (val: "currency" | "percent" | "original") => {
      if (val === "currency") return "money";
      if (val === "percent") return "percentage";
      return "decimal";
    };

    chartInstanceRef.current = new Chart(ctx, {
      type: "line",
      data: {
        labels: xValues,
        datasets: datasets,
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: title !== undefined ? title : `Line Chart`,
            color: "#333333",
          },
          tooltip: {
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            bodyFont: {
              size: (ctx) => {
                const chartWidth = ctx.chart.width;
                return chartWidth < 400 ? 10 : 12;
              },
            },
            padding: 10,
            cornerRadius: 4,
            callbacks: {
              label: function (context) {
                if (context.parsed.y === null) return "";
                return formatValueGeneral(
                  context.parsed.y,
                  mapFormat(format),
                  decimalPlaces
                );
              },
            },
          },
          legend: {
            display: true,
            position: "bottom",
            align: "start",
            labels: {
              boxWidth: 10,
              padding: 10,
              color: "#333333",
            },
          },
          datalabels: {
            display: showPointLabels,
          },
        },
        scales: {
          x: {
            title: {
              display: !!xAxisLabel,
              text: xAxisLabel || "",
              color: "#333333",
            },
            grid: {
              color: showGrid ? "#cccccc" : "transparent",
            },
            ticks: {
              color: "#333333",
              maxRotation: 90,
              minRotation: 90,
            },
          },
          y: {
            title: {
              display: yAxisLabel ? showYLabels : false,
              text: yAxisLabel || "",
              color: "#333333",
            },
            beginAtZero: true,
            ticks: {
              stepSize: stepSize || calculatedStepSize,
              color: "#333333",
              display: showYLabels,
              callback: function (value) {
                if (!showYLabels) return "";
                return formatValueGeneral(
                  Number(value),
                  mapFormat(yAxisLabelFormat),
                  decimalPlaces
                );
              },
            },
            grid: {
              color: showGrid ? "#cccccc" : "transparent",
            },
            min: stepSize
              ? Math.floor(minY / stepSize) * stepSize
              : Math.floor(minY / calculatedStepSize) * calculatedStepSize,
            max: stepSize
              ? Math.ceil(maxY / stepSize) * stepSize
              : Math.ceil(maxY / calculatedStepSize) * calculatedStepSize,
          },
        },
        maintainAspectRatio: false,
        elements: {
          line: {
            backgroundColor: "#ffffff",
          },
          point: {
            radius: 3,
            backgroundColor: "#ffffff",
          },
        },
      },
      plugins: [
        {
          id: "custom_canvas_background_color",
          beforeDraw: (chart) => {
            const { ctx, chartArea } = chart;
            ctx.save();
            ctx.fillStyle = chartAreaBackgroundColor; // ✅ Use the prop
            ctx.fillRect(
              chartArea.left,
              chartArea.top,
              chartArea.right - chartArea.left,
              chartArea.bottom - chartArea.top
            );
            ctx.restore();
          },
        },
      ],
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [
    xValues,
    yValues,
    dataLabel,
    xAxisLabel,
    yAxisLabel,
    stepSize,
    title,
    format,
    yAxisLabelFormat,
    decimalPlaces,
    showGrid,
    showYLabels,
    chartAreaBackgroundColor, // ✅ Include as dependency
  ]);

  return (
    <div
      className={clsx("w-full h-full bg-white", [additional_css?.outer_div])}
    >
      <canvas ref={chartRef} className="w-full h-full" />
    </div>
  );
}
