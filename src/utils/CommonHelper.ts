interface FileState {
  content: string | null;
  metadata: Partial<File> | null;
}

const formatDate = (createdAt: string): string => {
  const date = new Date(createdAt);
  return date.toLocaleDateString("en-US", { timeZone: "Asia/Manila" });
};

const sortStringsCaseSensitive = (strings: string[]): string[] => {
  return strings.sort((a, b) => {
    if (a.toLowerCase() === b.toLowerCase()) {
      return a < b ? -1 : 1;
    }
    return a.toLowerCase() < b.toLowerCase() ? -1 : 1;
  });
};

const serializeFile = async (file: File): Promise<FileState> => {
  const reader = new FileReader();

  return new Promise((resolve, reject) => {
    reader.onload = () => {
      resolve({
        content: reader.result as string,
        metadata: {
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file); // Converts file to Base64
  });
};

const deserializeFile = (content: string, metadata: Partial<File>): File => {
  const byteString = atob(content.split(",")[1]); // Decode Base64 content
  const arrayBuffer = new Uint8Array(byteString.length);

  for (let i = 0; i < byteString.length; i++) {
    arrayBuffer[i] = byteString.charCodeAt(i);
  }

  return new File([arrayBuffer], metadata.name || "unknown", {
    type: metadata.type || "",
    lastModified: metadata.lastModified || Date.now(),
  });
};

const formatTitleCase = (str: string): string => {
  return str.replace(/\w\S*/g, (txt) => {
    return txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase();
  });
};

const checkHasFileExtension = (stringVar: string): boolean => {
  const regExDetectFileExtPattern = /\.[0-9a-z]+$/i;
  return regExDetectFileExtPattern.test(stringVar);
};

const getTagColor = (option: string) => {
  if (!option) return "";
  const toUpperCaseOption = option.toUpperCase();

  switch (toUpperCaseOption) {
    case "BASELINE INPUT":
      return "bg-green-500";
    case "BASELINE":
      return "bg-green-300";
    case "MODERATE":
      return "bg-yellow-300";
    case "ADVERSE":
      return "bg-orange-300";
    case "EXTREME ADVERSE":
      return "bg-red-300";
    default:
      return "";
  }
};

const formatValueGeneral = (
  value: number | string,
  format: string,
  decimalPlaces: number = 2,
  encloseMoneyInParenthesis: boolean = true,
  addPercentSign: boolean = true
) => {
  if (value === null || value === undefined) {
    return "-";
  }
  if (typeof value !== "number") {
    return value?.toString();
  }
  if (format === "money") {
    const absoluteValue = Math.abs(value);
    const formattedValue = absoluteValue.toLocaleString("en-PH", {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    });
    if (value < 0 && encloseMoneyInParenthesis) {
      return `(${formattedValue})`;
    } else return formattedValue;
  } else if (format === "percentage") {
    // console.log('addPercentSign: ', addPercentSign)
    // console.log('`${(value * 100).toFixed(decimalPlaces)}${addPercentSign ? "%" : ""}`')
    // console.log(`${(value * 100).toFixed(decimalPlaces)}${
    //   addPercentSign ? "%" : ""
    // }`)
    return `${(value * 100).toFixed(decimalPlaces)}${
      addPercentSign ? "%" : ""
    }`;
  } else if (format === "decimal") {
    return value.toFixed(decimalPlaces);
  }
  return value.toFixed(decimalPlaces);
};

const extractUniqueYearsFromObjectKeys = (
  data: object,
  returnAsNumbers: boolean = false
) => {
  if (typeof data !== "object" || Object.keys(data).length === 0) return [];
  const uniqueYears = new Set<number>();
  Object.keys(data).forEach((key) => {
    const yearMatch = key.match(/\b\d{4}\b/);
    if (yearMatch) {
      uniqueYears.add(Number(yearMatch[0]));
    }
  });

  const sortedYears = Array.from(uniqueYears).sort((a, b) => a - b);

  return returnAsNumbers
    ? sortedYears
    : sortedYears.map((year) => year.toString());
};

const getScenarioHighlightColor = (option: string) => {
  if (!option) return "";
  const toUpperCaseOption = option.toUpperCase();

  switch (toUpperCaseOption) {
    case "BASELINE INPUT":
      return "bg-green-100";
    case "BASELINE":
      return "bg-green-50";
    case "MODERATE":
      return "bg-yellow-50";
    case "ADVERSE":
      return "bg-orange-50";
    case "EXTREME ADVERSE":
      return "bg-red-50";
    default:
      return "";
  }
};

const replaceObjectKeyName = (
  obj: any,
  oldKey: string,
  newKey: string
): any => {
  const { [oldKey]: oldValue, ...rest } = obj;
  return { ...rest, [newKey]: oldValue };
};

const isOtherModActiveWorkflow = (modWfActiveStatus:any) => {
  const {isForecastStarted, isWorkflowStarted, isMarketRiskWorkflowStarted, isStrategicRiskWorkflowStarted,
    isOperationalRiskWorkflowStarted,isComplianceRiskWorkflowStarted, isIrrbbWorkflowStarted, isCarWorkflowStarted,
    isLcrWorkflowStarted, isNsfrWorkflowStarted, isIstReportsWorkflowStarted
  } = modWfActiveStatus
  let response: any = {
    isOtherModActive: null,
    message: "",
  };

  const workflows = [
    { started: isForecastStarted, name: "Forecasting" },
    { started: isWorkflowStarted, name: "Credit Risk" },
    { started: isMarketRiskWorkflowStarted, name: "Market Risk" },
    { started: isStrategicRiskWorkflowStarted, name: "Strategic Risk" },
    { started: isOperationalRiskWorkflowStarted, name: "Operational Risk" },
    { started: isComplianceRiskWorkflowStarted, name: "Compliance Risk" },
    { started: isIrrbbWorkflowStarted, name: "IRRBB" },
    { started: isCarWorkflowStarted, name: "Capital Adequacy Ratio" },
    { started: isLcrWorkflowStarted, name: "Liquidiy Coverage Ratio" },
    { started: isNsfrWorkflowStarted, name: "Net Stable Fund Ratio" },
    { started: isIstReportsWorkflowStarted, name: "IST Report" },
  ];

  const activeWorkflows = workflows
    .filter((workflow) => workflow.started)
    .map((workflow) => workflow.name);
  if (activeWorkflows.length === 0) {
    response.isOtherModActive = false;
  } else {
    const workflowMessage =
      activeWorkflows.length === 1
        ? activeWorkflows[0]
        : `${activeWorkflows.slice(0, -1).join(", ")} and ${
            activeWorkflows[activeWorkflows.length - 1]
          }`;
    response.isOtherModActive = true;
    response.message = `Cannot start a workflow while having an ongoing workflow in module: ${workflowMessage}.`
  }
  return response;
};

const getMainTabFromRoute = (route: string) => {
  if (route.startsWith("/financial_forecasting/forecasting")) return "Forecasting";
  if (route.startsWith("/financial_forecasting/enterprise_risk_stress_testing")) return "Integrated Risk Stress Testing";
  if (route.startsWith("/financial_forecasting/integrated_stress_testing")) return "IST Results";
  if (route.startsWith("/financial_forecasting/fs_analysis")) return "FS Analysis";
  if (route.startsWith("/financial_forecasting/historical_data")) return "Historical Data";
  if (route.startsWith("/financial_forecasting/documents")) return "Documents";
  if (route.startsWith("/settings")) return "Settings";
  return "";
};

const getExpandedTabFromRoute = (route: string) => {
  if (route.includes("/credit_risk")) return "Credit Risk";
  if (route.includes("/market_risk")) return "Market Risk";
  if (route.includes("/operational_risk")) return "Operational Risk";
  if (route.includes("/compliance_risk")) return "Compliance Risk";
  if (route.includes("/strategic_risk")) return "Strategic Risk";
  if (route.includes("/compliance_risk")) return "Compliance Risk";
  if (route.includes("/interest_rate_risk_in_banking_book")) return "IRRBB";  
  return "";
};

const generateDummyTableData = (rowCount = 100) => {
  const randomDate = (start: Date, end: Date) =>
    new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
      .toISOString()
      .split("T")[0];

  const segments = ["Retail", "Corporate", "SME", "Mortgage"];

  const data = [];

  for (let i = 0; i < rowCount; i++) {
    const bookingDate = randomDate(new Date(2015, 0, 1), new Date(2022, 11, 31));
    const maturityDate = randomDate(new Date(2023, 0, 1), new Date(2030, 11, 31));

    data.push({
      report_date: randomDate(new Date(2023, 0, 1), new Date()),
      load_segment: segments[Math.floor(Math.random() * segments.length)],
      cis_number: String(Math.floor(1000000000 + Math.random() * 9000000000)),
      pn_number: String(Math.floor(10000000 + Math.random() * 90000000)),
      loan_amount: parseFloat((Math.random() * 1000000 + 5000).toFixed(2)),
      outstanding_balance: parseFloat((Math.random() * 900000).toFixed(2)),
      amortization: parseFloat((Math.random() * 20000).toFixed(2)),
      booking_date: bookingDate,
      maturity_date: maturityDate,
    });
  }

  return data;
};

const generatePivotedDummyData = (n: number, multipler?: number): Array<{ [key: string]: any }> => {
  const data = [];
  const segments = ["Retail", "Corporate", "SME", "Government"];

  // Generate all monthly date strings from Jan 2020 to Dec 2025
  const months = [];
  const start = new Date("2020-01-01");
  const end = new Date("2025-12-01");

  for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const year = d.getFullYear();
    const lastDay = new Date(year, d.getMonth() + 1, 0).getDate();
    months.push(`${month}/${lastDay.toString().padStart(2, "0")}/${year}`);
  }

  for (let i = 0; i < n; i++) {
    const row: { [key: string]: any } = {
      pn_number: `PN${(i + 1).toString().padStart(5, "0")}`,
      segment: segments[Math.floor(Math.random() * segments.length)],
    };

    months.forEach((dateStr) => {
      const randomChoice = Math.random();
      if (randomChoice < 0.1) {
        row[dateStr] = "NA"; 
      } else if (randomChoice < 0.2) {
        row[dateStr] = 0;
      } else {
        row[dateStr] = parseFloat((Math.random() * (multipler?? 100)).toFixed(2)); // 80% chance
      }
    });

    data.push(row);
  }

  return data;
};

const generateDefaultRateDummyData = (n: number): Array<{ [key: string]: any }> => {
  const data = [];

  const randomDate = (start: Date, end: Date): Date => {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  };

  for (let i = 0; i < n; i++) {
    const observationPoint = randomDate(new Date("2020-01-01"), new Date("2025-12-31"));
    
    const startWindow = randomDate(
      new Date(observationPoint.getFullYear() - 1, observationPoint.getMonth(), 1),
      new Date(observationPoint.getFullYear(), observationPoint.getMonth(), 1)
    );

    const endWindow = randomDate(
      new Date(startWindow.getFullYear(), startWindow.getMonth(), startWindow.getDate() + 1),
      new Date(observationPoint.getFullYear() + 1, 11, 31)
    );

    data.push({
      "Observation point": observationPoint.toISOString().split("T")[0], // YYYY-MM-DD
      "Start of performance window": startWindow.toISOString().split("T")[0],
      "End of performance window": endWindow.toISOString().split("T")[0],
      "Number of Good": Math.floor(Math.random() * 1000),
      "ODR": parseFloat((Math.random() * 100).toFixed(2)), // 0.00 to 100.00
    });
  }

  return data;
};

const generateTransitionMatrixDummyData = (): Array<{ [key: string]: any }> => {
  const data: Array<{ [key: string]: any }> = [];

  const startDate = new Date("2020-01-01");
  const baseMonth = startDate.getMonth();
  const baseYear = startDate.getFullYear();

  // Calculate the first and second key names
  const firstDate = new Date(baseYear, baseMonth + 1, 0); // Last day of Jan
  const secondDate = new Date(baseYear, baseMonth + 2, 0); // Last day of Feb

  const firstKey = `${String(firstDate.getMonth() + 1).padStart(2, "0")}/${firstDate.getDate()}/${firstDate.getFullYear()}`;
  const secondKey = `${String(secondDate.getMonth() + 1).padStart(2, "0")}/${secondDate.getDate()}/${secondDate.getFullYear()}_Bucket`;

  const buckets = [
    { key: "0 DPD_0", min: 60, max: 100 },
    { key: "1-30 DPD_1", min: 0, max: 30 },
    { key: "31-60 DPD_2", min: 0, max: 15 },
    { key: "61-90 DPD_3", min: 0, max: 10 },
    { key: "91+ DPD_4", min: 0, max: 5 },
    { key: "Indeterminate_NA", min: 0, max: 3 },
  ];

  for (let i = 0; i < 5; i++) {
    const row: { [key: string]: any } = {};

    row[firstKey] = firstKey;              // Column 1: fixed date
    row[secondKey] = i;                    // Column 2: Bucket value 0 to 4

    let totalAccounted = 0;

    for (const bucket of buckets) {
      const value =
        Math.floor(Math.random() * (bucket.max - bucket.min + 1)) + bucket.min;
      row[bucket.key] = value;
      if (!bucket.key.includes("NA")) totalAccounted += value;
    }

    row["Total Accounted Evaluated"] = totalAccounted;

    data.push(row);
  }

  return data;
};


const generateODRDummyData = (n: number): Array<{ Time: string; ODR: number }> => {
  const data: Array<{ Time: string; ODR: number }> = [];
  const startDate = new Date("2021-01-01");

  for (let i = 0; i < n; i++) {
    const currentDate = new Date(startDate);
    currentDate.setMonth(currentDate.getMonth() + i);

    const month = String(currentDate.getMonth() + 1).padStart(2, "0");
    const year = currentDate.getFullYear();
    const lastDay = new Date(year, currentDate.getMonth() + 1, 0).getDate();

    const timeStr = `${month}/${lastDay}/${year}`;
    const odr = parseFloat((Math.random() * 1).toFixed(4)); // Random ODR between 0 and 1, 4 decimal places

    data.push({
      Time: timeStr,
      ODR: odr,
    });
  }

  return data;
};


export {
  formatDate,
  sortStringsCaseSensitive,
  serializeFile,
  deserializeFile,
  formatTitleCase,
  checkHasFileExtension,
  getTagColor,
  extractUniqueYearsFromObjectKeys,
  formatValueGeneral,
  getScenarioHighlightColor,
  replaceObjectKeyName,
  isOtherModActiveWorkflow,
  getMainTabFromRoute,
  getExpandedTabFromRoute,
  generateDummyTableData,
  generatePivotedDummyData,
  generateDefaultRateDummyData,
  generateTransitionMatrixDummyData,
  generateODRDummyData
};
