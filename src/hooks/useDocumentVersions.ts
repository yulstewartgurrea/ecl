import useSWR from "swr";

const fetcher = (url: string, token?: string) =>
  fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }).then((res) => {
    if (!res.ok) throw new Error("Failed to fetch document versions");
    return res.json();
  });

export const useDocumentVersions = (
  workflowPath?: string,
  filename?: string,
  authToken?: string | null
) => {
  const shouldFetch = !!workflowPath && !!filename;

  // normalize: null -> undefined
  const safeToken = authToken ?? undefined;

  const { data, error, isLoading, mutate } = useSWR(
    shouldFetch
      ? [
          `http://127.0.0.1:8000/documents/document-versions?filename=${filename}&workflow=${workflowPath}`,
          safeToken,
        ]
      : null,
    ([url, token]) => fetcher(url, token)
  );

  const numberToWord = (num: number): string => {
    const a = [
      "",
      "One",
      "Two",
      "Three",
      "Four",
      "Five",
      "Six",
      "Seven",
      "Eight",
      "Nine",
      "Ten",
      "Eleven",
      "Twelve",
      "Thirteen",
      "Fourteen",
      "Fifteen",
      "Sixteen",
      "Seventeen",
      "Eighteen",
      "Nineteen",
    ];
    const b = [
      "",
      "",
      "Twenty",
      "Thirty",
      "Forty",
      "Fifty",
      "Sixty",
      "Seventy",
      "Eighty",
      "Ninety",
    ];

    if (num < 20) return a[num];
    if (num < 100)
      return (
        b[Math.floor(num / 10)] + (num % 10 !== 0 ? `-${a[num % 10]}` : "")
      );
    if (num < 1000)
      return (
        a[Math.floor(num / 100)] +
        " Hundred" +
        (num % 100 !== 0 ? ` ${numberToWord(num % 100)}` : "")
      );

    return num.toString(); // fallback for larger numbers
  };

  // Usage
  const versions = data
    ? data.map((doc: any) => ({
        id: doc.id,
        label: `${numberToWord(doc.version)} (${doc.version})`,
      }))
    : [];

  return { versions, error, isLoading, mutate };
};
