// src/hooks/useDocumentById.ts
import useSWR from "swr";

const fetcher = (url: string, token?: string) =>
  fetch(url, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  }).then((res) => {
    if (!res.ok) throw new Error("Failed to fetch document");
    return res.json();
  });

export const useDocumentById = (
  documentId?: number,
  authToken?: string | null
) => {
  const shouldFetch = !!documentId;

  const { data, error, isLoading, mutate } = useSWR(
    shouldFetch
      ? [
          `http://127.0.0.1:8000/documents/${documentId}`,
          authToken ?? undefined, // ✅ null → undefined
        ]
      : null,
    ([url, token]: [string, string | undefined]) => fetcher(url, token)
  );

  return {
    document: data,
    error,
    isLoading,
    mutate,
  };
};
