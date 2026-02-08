// pages/workflows/Workflows.tsx
import { useEffect, useState, useCallback } from "react";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UserGroupIcon,
  FolderIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { searchWorkflows, type Workflow } from "../../services/workflow";
import { useAppSelector } from "../../redux_toolkit/hooks";

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

const ITEMS_PER_PAGE = 20;

const Workflows = () => {
  const token = useAppSelector((state) => state.auth.token);
  const [loading, setLoading] = useState(false);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  
  // Pagination state
  const [skip, setSkip] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // Create workflow form state
  const [entity, setEntity] = useState("");
  const [loanProduct, setLoanProduct] = useState("");
  const [reportingPeriod, setReportingPeriod] = useState("Monthly");
  const [reportDateStart, setReportDateStart] = useState("");
  const [workflowName, setWorkflowName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState(false);

  // Redux selectors for entities and loan products
  const entities = useAppSelector(
    (state: any) => state.eclEntitiesReducer?.items || []
  );
  const loanProducts = useAppSelector(
    (state: any) => state.eclLoanProductsReducer?.items || []
  );

  // Load workflows with search and pagination
  const loadWorkflows = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      const res = await searchWorkflows({
        apiBase: API_BASE,
        token,
        skip,
        limit: ITEMS_PER_PAGE,
        search_query: searchQuery || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      
      setWorkflows(res.data || []);
      setTotalCount(res.pagination?.total || 0);
      setHasMore(res.pagination?.has_more || false);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load workflows");
    } finally {
      setLoading(false);
    }
  }, [token, skip, searchQuery, startDate, endDate]);

  // Load workflows on mount and when search/pagination changes
  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  // Reset to first page when search changes
  useEffect(() => {
    setSkip(0);
  }, [searchQuery, startDate, endDate]);

  const handlePreviousPage = () => {
    if (skip > 0) {
      setSkip(Math.max(0, skip - ITEMS_PER_PAGE));
    }
  };

  const handleNextPage = () => {
    if (hasMore) {
      setSkip(skip + ITEMS_PER_PAGE);
    }
  };

  const handleCreateWorkflow = () => {
    setCreateModalOpen(true);
    // Reset form state
    setEntity("");
    setLoanProduct("");
    setReportingPeriod("Monthly");
    setReportDateStart("");
    setWorkflowName("");
    setCreateError(null);
    setCreateSuccess(false);
  };

  const handleCloseModal = () => {
    setCreateModalOpen(false);
    setCreateError(null);
    setCreateSuccess(false);
  };

  const handleSubmitCreateWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!workflowName.trim() || !entity || !reportingPeriod || !loanProduct) {
      setCreateError("Please fill in all required fields.");
      return;
    }

    setCreating(true);
    setCreateError(null);
    setCreateSuccess(false);

    try {
      const payload = {
        entity: entity,
        workflow_name: workflowName.trim(),
        reporting_period: reportingPeriod,
        baseline_year: "2023",
        loan_product: loanProduct || undefined,
        report_date_start: reportDateStart || undefined,
        workflow_type: "asa",
      };

      const workflowResponse = await fetch(`${API_BASE}/workflows/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!workflowResponse.ok) {
        const errorData = await workflowResponse.json();
        throw new Error(errorData.msg || errorData.detail || "Failed to create workflow");
      }

      const workflowResponseData = await workflowResponse.json();
      const workflowData = workflowResponseData?.data || workflowResponseData;

      if (workflowData && workflowData.id) {
        console.log(
          `WORKFLOW CREATED: ID=${workflowData.id}, Name='${workflowData.workflow_name}', Entity='${workflowData.entity}', Period='${workflowData.reporting_period}'`
        );
        
        setCreateSuccess(true);
        
        // Refresh workflow list
        await loadWorkflows();
        
        // Close modal after a short delay
        setTimeout(() => {
          handleCloseModal();
        }, 1500);
      } else {
        throw new Error("No workflow ID in response");
      }
    } catch (error: any) {
      console.error("Failed to create workflow:", error);
      setCreateError(error?.message || "Something went wrong");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Workflows</h1>
            <p className="text-sm text-gray-600 mt-1">
              Manage and search through your workflows
            </p>
          </div>
          <button
            onClick={handleCreateWorkflow}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-500 text-gray-900 font-medium shadow-sm disabled:opacity-60 transition"
          >
            <PlusIcon className="w-5 h-5" />
            Create Workflow
          </button>
        </div>
      </header>

      {/* Main Content Card */}
      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Card Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-gray-800">
              Workflow List
            </h2>
            <p className="text-xs sm:text-[13px] text-gray-500">
              Search and filter workflows by name and date range
            </p>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-5 sm:p-6">
          {/* Search Section */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {/* Search by Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search by Name
              </label>
              <div className="relative">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by workflow name"
                  className="w-full rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 px-3 pl-10 py-2 text-sm text-gray-900 placeholder:text-gray-400"
                />
              </div>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <div className="relative">
                <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 px-3 pl-10 py-2 text-sm text-gray-900"
                />
              </div>
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <div className="relative">
                <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 px-3 pl-10 py-2 text-sm text-gray-900"
                />
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 mb-6 text-sm text-gray-600 pb-4 border-b border-gray-100">
            <span className="rounded-full bg-gray-50 px-3 py-1 border border-gray-200">
              Total:{" "}
              <span className="font-semibold text-gray-900">{totalCount}</span>
            </span>
            <span className="rounded-full bg-emerald-50 px-3 py-1 border border-emerald-200">
              Showing:{" "}
              <span className="font-semibold text-emerald-800">
                {workflows.length} of {totalCount}
              </span>
            </span>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="space-y-3">
              <div className="h-4 w-40 rounded bg-gray-100 animate-pulse" />
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50/80">
                    <tr className="text-left text-gray-700">
                      <th className="px-4 py-3 font-medium">Workflow Name</th>
                      <th className="px-4 py-3 font-medium">Entity</th>
                      <th className="px-4 py-3 font-medium">Reporting Period</th>
                      <th className="px-4 py-3 font-medium">Baseline Year</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3].map((i) => (
                      <tr key={i} className="border-t border-gray-100 animate-pulse">
                        <td className="px-4 py-3">
                          <div className="h-4 w-48 rounded bg-gray-200" />
                        </td>
                        <td className="px-4 py-3">
                          <div className="h-4 w-24 rounded bg-gray-200" />
                        </td>
                        <td className="px-4 py-3">
                          <div className="h-4 w-20 rounded bg-gray-200" />
                        </td>
                        <td className="px-4 py-3">
                          <div className="h-4 w-16 rounded bg-gray-200" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && workflows.length === 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50/80">
                  <tr className="text-left text-gray-700">
                    <th className="px-4 py-3 font-medium">Workflow Name</th>
                    <th className="px-4 py-3 font-medium">Entity</th>
                    <th className="px-4 py-3 font-medium">Reporting Period</th>
                    <th className="px-4 py-3 font-medium">Baseline Year</th>
                    <th className="px-4 py-3 font-medium w-32">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-4 py-6 text-gray-500" colSpan={4}>
                      {totalCount === 0
                        ? "No workflows found."
                        : "No workflows match your search."}
                      <p className="mt-1 text-xs text-gray-400">
                        {totalCount === 0
                          ? "Create your first workflow to get started."
                          : "Try adjusting your search keywords or date range."}
                      </p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Workflows List */}
          {!loading && !error && workflows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50/80">
                  <tr className="text-left text-gray-700">
                    <th className="px-4 py-3 font-medium">Workflow Name</th>
                    <th className="px-4 py-3 font-medium">Entity</th>
                    <th className="px-4 py-3 font-medium">Reporting Period</th>
                    <th className="px-4 py-3 font-medium">Baseline Year</th>
                    <th className="px-4 py-3 font-medium w-32">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {workflows.map((workflow) => {
                    const entity = workflow.entity ?? "";
                    const period =
                      workflow.reporting_period ?? (workflow as any).reportingPeriod ?? "";
                    const wfName = workflow.workflow_name ?? (workflow as any).name ?? "";
                    const label = `/${entity}/${period}/${wfName}`
                      .replace(/\/+/g, "/")
                      .replace(/\/$/, "");
                    const path =
                      workflow.directory_path ??
                      workflow.workflow_path ??
                      (workflow as any).path ??
                      label;

                    return (
                      <tr key={workflow.id} className="border-t border-gray-100">
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-gray-900 font-medium">
                              {wfName || "(Unnamed workflow)"}
                            </p>
                            <p className="text-xs text-gray-500 truncate max-w-md">{path}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-gray-900">{entity || "-"}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-gray-900">{period || "-"}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-gray-900">
                            {workflow.baseline_year || "-"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {!loading && !error && workflows.length > 0 && (
            <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                Showing {skip + 1} to {Math.min(skip + ITEMS_PER_PAGE, totalCount)} of {totalCount} workflows
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePreviousPage}
                  disabled={skip === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                  Previous
                </button>
                <button
                  onClick={handleNextPage}
                  disabled={!hasMore}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition"
                >
                  Next
                  <ChevronRightIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Create Workflow Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl ring-1 ring-gray-200 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Create New Workflow</h2>
              <button
                onClick={handleCloseModal}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition"
                title="Close"
              >
                <XMarkIcon className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Error Message - at the top */}
            {createError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {createError}
              </div>
            )}

            {/* Success Message */}
            {createSuccess && (
              <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                Workflow created successfully!
              </div>
            )}

            <form onSubmit={handleSubmitCreateWorkflow} className="space-y-4">
              {/* Entity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Business Unit <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-row border border-gray-300 rounded-lg bg-white focus-within:ring-2 focus-within:ring-amber-500">
                  <div className="h-11 w-12 border-r border-gray-200 flex items-center justify-center">
                    <UserGroupIcon className="w-5 h-5 text-gray-500" />
                  </div>
                  <select
                    id="entity"
                    value={entity}
                    onChange={(e) => setEntity(e.target.value)}
                    className="flex-1 text-gray-800 py-2.5 pl-2 pr-3 focus:outline-none bg-white rounded-r-lg"
                    required
                  >
                    <option value="">Select An Entity</option>
                    {Array.isArray(entities) &&
                      entities.map((row: any) => (
                        <option key={row.id} value={row.name}>
                          {row.name}
                          {row.code ? ` (${row.code})` : ""}
                        </option>
                      ))}
                  </select>
                </div>
                {(!entities || entities.length === 0) && (
                  <p className="text-xs text-amber-600 mt-2">
                    No entities found. Go to <b>Configuration {"->"} Entities</b> to add one.
                  </p>
                )}
              </div>

              {/* Loan Product */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Loan Product <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-row border border-gray-300 rounded-lg bg-white focus-within:ring-2 focus-within:ring-amber-500">
                  <div className="h-11 w-12 border-r border-gray-200 flex items-center justify-center">
                    <FolderIcon className="w-5 h-5 text-gray-500" />
                  </div>
                  <select
                    id="loanProduct"
                    value={loanProduct}
                    onChange={(e) => setLoanProduct(e.target.value)}
                    className="flex-1 text-gray-800 py-2.5 pl-2 pr-3 focus:outline-none bg-white rounded-r-lg"
                    required
                  >
                    <option value="">Select Loan Product</option>
                    {Array.isArray(loanProducts) &&
                      loanProducts.map((lp: any) => (
                        <option key={lp.id} value={lp.name}>
                          {lp.name}
                          {lp.code ? ` (${lp.code})` : ""}
                        </option>
                      ))}
                  </select>
                </div>
                {(!loanProducts || loanProducts.length === 0) && (
                  <p className="text-xs text-amber-600 mt-2">
                    No loan products found. Go to <b>Configuration {"->"} Loan Products</b> to add one.
                  </p>
                )}
              </div>

              {/* Reporting Period */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reporting Frequency
                </label>
                <div className="flex flex-row border border-gray-300 rounded-lg bg-gray-100">
                  <div className="h-11 w-12 border-r border-gray-200 flex items-center justify-center">
                    <CalendarIcon className="w-5 h-5 text-gray-500" />
                  </div>
                  <input
                    type="text"
                    value={reportingPeriod}
                    disabled
                    className="flex-1 text-gray-500 py-2.5 pl-2 pr-3 bg-gray-100 rounded-r-lg cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Report Date Start */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reporting Date (Month-end)
                </label>
                <div className="flex flex-row border border-gray-300 rounded-lg bg-white focus-within:ring-2 focus-within:ring-amber-500">
                  <div className="h-11 w-12 border-r border-gray-200 flex items-center justify-center">
                    <CalendarIcon className="w-5 h-5 text-gray-500" />
                  </div>
                  <input
                    id="reportDateStart"
                    type="date"
                    value={reportDateStart}
                    onChange={(e) => setReportDateStart(e.target.value)}
                    className="flex-1 text-gray-800 py-2.5 pl-2 pr-3 focus:outline-none bg-white rounded-r-lg"
                  />
                </div>
              </div>

              {/* Workflow Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Workflow Name <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-row border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-amber-500 rounded-lg">
                  <div className="h-11 w-12 border-r border-gray-200 flex items-center justify-center">
                    <FolderIcon className="w-5 h-5 text-gray-500" />
                  </div>
                  <input
                    id="workflowName"
                    type="text"
                    value={workflowName}
                    onChange={(e) => setWorkflowName(e.target.value)}
                    placeholder="Enter workflow name"
                    className="flex-1 text-gray-800 py-2.5 pl-2 pr-3 focus:outline-none bg-white rounded-r-lg"
                    required
                  />
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-50 transition"
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-500 text-gray-900 font-medium shadow-sm disabled:opacity-60 transition"
                  disabled={creating}
                >
                  {creating ? "Creating..." : "Create Workflow"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Workflows;
