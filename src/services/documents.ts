import { fetch } from "@tauri-apps/plugin-http";

export const getValidRows = async (workflowPath: string) => {
  const res = await fetch(
    `http://localhost:8000/documents/valid-rows?workflow_path=${workflowPath}`
  );

  if (!res.ok) {
    throw new Error("Failed to fetch valid rows");
  }

  return res.json();
};

export const getConsolidatedRows = async (
  workflowPath: string,
  token: string
) => {
  const res = await fetch(
    `http://localhost:8000/documents/consolidated-rows?workflow_path=${workflowPath}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) {
    throw new Error("Failed to fetch consolidated rows");
  }

  return res.json();
};

export const getPivotedConsolidatedRows = async (
  workflowPath: string,
  token: string
) => {
  // Step 1: GET consolidated rows
  const res1 = await fetch(
    `http://localhost:8000/documents/consolidated-rows?workflow_path=${workflowPath}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res1.ok) {
    throw new Error("Failed to fetch consolidated rows");
  }

  const consolidatedRows = await res1.json();

  // Step 2: POST pivot request
  const res2 = await fetch("http://localhost:8000/documents/pivot-dpd", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      workflow_path: workflowPath,
      row: consolidatedRows,
    }),
  });

  if (!res2.ok) {
    throw new Error("Failed to fetch pivoted data");
  }

  return res2.json();
};

export const getProcessedConsolidatedRows = async (
  workflowPath: string,
  token: string,
  processEndpoint: "pivot-dpd" | "bucket-dpd"
) => {
  // Step 1: GET consolidated rows
  const res1 = await fetch(
    `http://localhost:8000/documents/consolidated-rows?workflow_path=${workflowPath}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res1.ok) {
    throw new Error("Failed to fetch consolidated rows");
  }

  const consolidatedRows = await res1.json();

  // Step 2: POST to the chosen process endpoint
  const res2 = await fetch(
    `http://localhost:8000/documents/${processEndpoint}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        workflow_path: workflowPath,
        row: consolidatedRows,
      }),
    }
  );

  if (!res2.ok) {
    throw new Error(`Failed to process data via ${processEndpoint}`);
  }

  return res2.json();
};

export const getProcessedConsolidatedRowsStep6 = async (
  workflowPath: string,
  token: string,
  processEndpoint?: string // optional - when undefined, skip step 2
) => {
  // Step 1: GET consolidated rows
  const res1 = await fetch(
    `http://localhost:8000/documents/consolidated-rows?workflow_path=${workflowPath}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res1.ok) throw new Error("Failed to fetch consolidated rows");
  const consolidatedRows = await res1.json();

  // Step 2: If processing endpoint exists, POST the data there
  if (processEndpoint) {
    const res2 = await fetch(
      `http://localhost:8000/documents/${processEndpoint}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          workflow_path: workflowPath,
          row: consolidatedRows,
        }),
      }
    );

    if (!res2.ok)
      throw new Error(`Failed to process data via ${processEndpoint}`);
    return res2.json();
  }

  return consolidatedRows; // no second call, just return raw data
};

export const getStep7ProcessedData = async (
  workflowPath: string,
  token: string
) => {
  // Step 1: GET consolidated rows
  const res1 = await fetch(
    `http://localhost:8000/documents/consolidated-rows?workflow_path=${workflowPath}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res1.ok) throw new Error("Failed to fetch consolidated rows");
  const consolidatedRows = await res1.json();

  // Step 2: POST bucket-dpd-everbad
  const res2 = await fetch(
    "http://localhost:8000/documents/bucket-dpd-everbad",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        workflow_path: workflowPath,
        row: consolidatedRows,
      }),
    }
  );
  if (!res2.ok) throw new Error("Failed to fetch bucket-dpd-everbad data");
  const bucketData = await res2.json();

  // Step 3: POST calculate-odr
  const res3 = await fetch("http://localhost:8000/documents/calculate-odr", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ workflow_path: workflowPath, row: bucketData }),
  });
  if (!res3.ok) throw new Error("Failed to fetch calculated ODR data");
  const calculatedOdr = await res3.json();

  return calculatedOdr;
};

export async function fetchWithAuth(url: string, token: string) {
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`GET ${url} failed`);
  return res.json();
}

export async function postDataWithAuth(url: string, token: string, data: any) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`POST ${url} failed`);
  return res.json();
}

export async function getStep8MigrationData(
  workflowPath: string,
  token: string
) {
  const consolidatedRows = await fetchWithAuth(
    `http://localhost:8000/documents/consolidated-rows?workflow_path=${workflowPath}`,
    token
  );

  const payload = { workflow_path: workflowPath, row: consolidatedRows };

  const resultEverbad = await postDataWithAuth(
    "http://localhost:8000/documents/bucket-dpd-everbad",
    token,
    payload
  );

  const migrationMatrixData = await postDataWithAuth(
    "http://localhost:8000/documents/migration-matrix",
    token,
    { workflow_path: workflowPath, row: resultEverbad }
  );

  const migrationMatrixPercentage = await postDataWithAuth(
    "http://localhost:8000/documents/migration-matrix-percentage",
    token,
    { workflow_path: workflowPath, row: resultEverbad }
  );

  const flattenedRows = migrationMatrixPercentage.flat();

  const migrationMatrixAverage = await postDataWithAuth(
    "http://localhost:8000/documents/migration-matrix-average-final",
    token,
    { workflow_path: workflowPath, row: flattenedRows }
  );

  return {
    migrationMatrixData,
    migrationMatrixPercentage,
    migrationMatrixAverage,
  };
}

export async function postData(url: string, data: any, token: string) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`POST ${url} failed`);
  return res.json();
}

export async function getMigrationMatrixAverage(
  workflowPath: string,
  token: string
) {
  const url = `http://localhost:8000/documents/get-migration-matrix-average?workflow_path=${workflowPath}`;
  return fetchWithAuth(url, token);
}

export async function getMigrationMatrix12Months(
  workflowPath: string,
  row: any,
  token: string
) {
  const url = "http://localhost:8000/documents/migration-matrix-12months";
  return postData(url, { workflow_path: workflowPath, row }, token);
}

// services/localStorage.ts
export function getMonth12Bucket4(): number[] | null {
  const raw = localStorage.getItem("month12_bucket4");
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);

    if (
      Array.isArray(parsed) &&
      parsed.length === 5 &&
      parsed.every((n) => typeof n === "number")
    ) {
      return parsed;
    } else if (typeof parsed === "object" && parsed !== null) {
      const keys = [
        "0 DPD_0",
        "1-30 DPD_1",
        "31-60 DPD_2",
        "61-90 DPD_3",
        "91+ DPD_4",
      ];
      return keys.map((k) => Number(parsed[k] ?? 0));
    }
  } catch (e) {
    console.warn("Failed to parse month12_bucket4", e);
  }

  return null;
}

// services/documents.ts

export type OdrCacheEntry = {
  "End of performance window": string;
  ODR: string;
};

export const fetchOdrFromLocalStorage = (): OdrCacheEntry[] | null => {
  const raw = localStorage.getItem("odr_by_point");
  if (!raw) return null;

  try {
    const cache: OdrCacheEntry[] = JSON.parse(raw);
    return cache;
  } catch {
    console.warn("Invalid odr_by_point in localStorage");
    return null;
  }
};

// services/downloadService.ts

export const downloadValidRowsExcel = async (data: any, filename: any) => {
  try {
    const response = await fetch(
      "http://127.0.0.1:8000/documents/download-excel",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data }),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to download Excel");
    }

    const blob = await response.blob();

    // Create a temporary download link
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Error downloading file:", err);
    throw err;
  }
};

export const downloadValidRowsExcelv2 = async (data: any, filename: any) => {
  try {
    const response = await fetch(
      "http://127.0.0.1:8000/documents/download-excel-v2",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data }),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to download Excel");
    }

    const blob = await response.blob();

    // Create a temporary download link
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Error downloading file:", err);
    throw err;
  }
};
