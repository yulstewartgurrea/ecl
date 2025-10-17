import { useEffect, useState } from "react";
import ConsolidatedReport from "../../../components/asa/reports/ConsolidatedReport";
import {
  getStep2Consolidation,
  type SummaryRow,
  type ConsolidatedRow,
} from "../../../lib/asaApi";
import { useAppSelector } from "../../../redux_toolkit/hooks";

export default function Step2() {
  const reduxToken = useAppSelector((s) => s.auth.token);         // string | null
  const token = reduxToken ?? undefined;                           // string | undefined ✅

  const [summaryRows, setSummaryRows] = useState<SummaryRow[]>([]);
  const [consolidatedRows, setConsolidatedRows] = useState<ConsolidatedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    if (!token) {
      setLoading(false);
      setErr("No auth token found. Please sign in.");
      return;
    }

    setLoading(true);
    getStep2Consolidation(1, { token, scheme: "Bearer" })          // ← pass string | undefined
      .then(({ summaryRows, consolidatedRows }) => {
        if (!alive) return;
        setSummaryRows(summaryRows);
        setConsolidatedRows(consolidatedRows);
        setErr(null);
      })
      .catch((e) => alive && setErr(e?.body?.detail || e.message))
      .finally(() => alive && setLoading(false));

    return () => { alive = false; };
  }, [token]);

  if (loading) return <div className="p-4 text-sm">Loading…</div>;
  if (err) return <div className="p-4 text-sm text-red-600">Error: {err}</div>;

  return (
    <div className="min-h-dvh">
      <div className="mx-auto max-w-[1600px] p-6">
        <ConsolidatedReport summaryRows={summaryRows} consolidatedRows={consolidatedRows} />
      </div>
    </div>
  );
}
