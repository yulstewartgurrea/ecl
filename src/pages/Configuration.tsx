// pages/Configuration.tsx
// Redesigned ECL Configuration (Tabbed UI, consistent cards, inline-create rows, subtle animations)
import { useMemo, useState, type FormEvent } from "react";
// window.confirm() is a silent "Cancel" in the macOS webview, so ask through the dialog plugin
import { ask } from "@tauri-apps/plugin-dialog";
import { useAppSelector } from "../redux_toolkit/hooks";
import { useEntities, useLoanProducts } from "../hooks/useEclConfig";
import {
  createEntity,
  updateEntity,
  deleteEntity,
  createLoanProduct,
  updateLoanProduct,
  deleteLoanProduct,
  type Entity,
  type LoanProduct,
} from "../services/eclConfig";

/* ================================= Icons ================================== */
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  FunnelIcon,
} from "@heroicons/react/24/outline";

/* ============================== UI Primitives ============================== */

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick(): void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "px-3 py-1.5 rounded-lg text-sm font-medium transition",
        active
          ? "bg-amber-400 text-gray-900 shadow-sm"
          : "bg-gray-100 hover:bg-gray-200 text-gray-700",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function SectionCard({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 sm:px-6 py-4  border-gray-100">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-gray-800">
            {title}
          </h2>
          {subtitle ? (
            <p className="text-xs sm:text-[13px] text-gray-500">{subtitle}</p>
          ) : null}
        </div>
        {right}
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

function Toolbar({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function InlineTextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        "w-full rounded-lg border border-gray-300 bg-white",
        "focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500",
        "px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400",
        props.className || "",
      ].join(" ")}
    />
  );
}

function InlineSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={[
        "w-full rounded-lg border border-gray-300 bg-white",
        "focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500",
        "px-3 py-2 text-sm text-gray-900",
        props.className || "",
      ].join(" ")}
    />
  );
}

function PrimaryBtn({
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={[
        "inline-flex items-center gap-2 px-4 py-2 rounded-lg",
        "bg-amber-400 hover:bg-amber-500 text-gray-900 font-medium shadow-sm disabled:opacity-60",
        rest.className || "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function QuietBtn({
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={[
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm",
        "bg-gray-100 hover:bg-gray-200 text-gray-700",
        rest.className || "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function IconButton({
  tone = "gray",
  title,
  onClick,
  children,
}: {
  tone?: "yellow" | "red" | "green" | "gray";
  title: string;
  onClick(): void;
  children: React.ReactNode;
}) {
  const toneMap: Record<string, string> = {
    yellow: "bg-yellow-100 hover:bg-yellow-200 text-yellow-800",
    red: "bg-red-100 hover:bg-red-200 text-red-800",
    green: "bg-green-100 hover:bg-green-200 text-green-800",
    gray: "bg-gray-100 hover:bg-gray-200 text-gray-800",
  };
  return (
    <button
      title={title}
      onClick={onClick}
      className={[
        "p-1.5 rounded-md transition",
        "focus:outline-none focus:ring-2 focus:ring-amber-500/40",
        toneMap[tone],
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/* ============================== Page Component ============================= */

export default function EclConfigurationPage() {
  const [tab, setTab] = useState<"entities" | "loanProducts">("entities");

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-gray-900">
          ECL Configuration
        </h1>
        <p className="text-sm text-gray-600">
          Manage your <strong>Entities</strong>, 
          <strong> Loan Products</strong>
        </p>

        <div className="flex flex-wrap items-center gap-2 pt-2">
          <TabButton
            active={tab === "entities"}
            onClick={() => setTab("entities")}
          >
            Entities
          </TabButton>
          <TabButton
            active={tab === "loanProducts"}
            onClick={() => setTab("loanProducts")}
          >
            Loan Products
          </TabButton>
        </div>
      </header>

      {/* Tabs */}
      {tab === "entities" && <EntitiesSection />}
      {tab === "loanProducts" && <LoanProductsSection />}
    </div>
  );
}

/* ================================ ENTITIES ================================ */

/**
 * Runs a create/update/delete call, then reloads the list. Failures go into `actionError`
 * and are shown on the page (alert() boxes don't reliably appear in the app window).
 */
function useSaveAction(reload: () => Promise<unknown>) {
  const token = useAppSelector((s) => s.auth.token);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const run = async (action: (token: string) => Promise<unknown>) => {
    if (!token) {
      setActionError("Your session has expired. Please log in again.");
      return false;
    }
    setBusy(true);
    setActionError(null);
    try {
      await action(token);
      await reload();
      return true;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { busy, run, actionError, setActionError };
}

function ActionError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="text-sm text-red-600 mb-4">{message}</p>;
}

function EntitiesSection() {
  const { entities: items, error, isLoading, reload } = useEntities();
  const { busy, run, actionError, setActionError } = useSaveAction(reload);

  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.name.toLowerCase().includes(q));
  }, [items, query]);

  const onAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setActionError("Entity name is required.");
    if (await run((token) => createEntity(token, name.trim()))) setName("");
  };

  const beginEdit = (row: Entity) => {
    setEditingId(row.id);
    setEditName(row.name);
  };

  const saveEdit = async () => {
    if (editingId === null) return;
    if (!editName.trim()) return setActionError("Entity name is required.");
    if (await run((token) => updateEntity(token, editingId, editName.trim()))) {
      setEditingId(null);
    }
  };

  const cancelEdit = () => setEditingId(null);

  const remove = async (id: number) => {
    if (await ask("Delete this entity?", { title: "Delete entity", kind: "warning" })) {
      await run((token) => deleteEntity(token, id));
    }
  };

  const emptyMessage = isLoading
    ? "Loading entities..."
    : error
      ? `Couldn't load entities: ${error.message}`
      : items.length === 0
        ? "No entities yet."
        : "No results match your filter.";

  return (
    <SectionCard
      title="Entities"
      subtitle="Examples: Corporate Loans, Retail, SME."
      right={
        <QuietBtn onClick={() => setQuery("")}>
          <FunnelIcon className="w-4 h-4" />
          Clear filter
        </QuietBtn>
      }
    >
      <Toolbar>
        <form onSubmit={onAdd} className="flex flex-1 items-center gap-3">
          <div className="flex-1">
            <label className="sr-only">Entity name</label>
            <InlineTextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Add new entity (e.g., Corporate Loans)"
            />
          </div>
          <PrimaryBtn type="submit" disabled={busy}>
            <PlusIcon className="w-5 h-5" />
            Add
          </PrimaryBtn>
        </form>

        <div className="w-full sm:w-64">
          <InlineTextInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter entities"
          />
        </div>
      </Toolbar>

      <ActionError message={actionError} />

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50/80">
            <tr className="text-left text-gray-700">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium w-32">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-gray-500" colSpan={2}>
                  {emptyMessage}
                </td>
              </tr>
            )}

            {filtered.map((row) => {
              const isEditing = editingId === row.id;
              return (
                <tr key={row.id} className="border-t border-gray-100">
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <InlineTextInput
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    ) : (
                      <span className="text-gray-900">{row.name}</span>
                    )}
                  </td>

                  <td className="px-4 py-2">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <IconButton
                          tone="green"
                          title="Save"
                          onClick={saveEdit}
                        >
                          <CheckIcon className="w-5 h-5" />
                        </IconButton>
                        <IconButton title="Cancel" onClick={cancelEdit}>
                          <XMarkIcon className="w-5 h-5" />
                        </IconButton>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <IconButton
                          tone="yellow"
                          title="Edit"
                          onClick={() => beginEdit(row)}
                        >
                          <PencilSquareIcon className="w-5 h-5" />
                        </IconButton>
                        <IconButton
                          tone="red"
                          title="Delete"
                          onClick={() => remove(row.id)}
                        >
                          <TrashIcon className="w-5 h-5" />
                        </IconButton>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

/* ============================= LOAN PRODUCTS ============================== */

function LoanProductsSection() {
  const { loanProducts: items, error, isLoading, reload } = useLoanProducts();
  const { entities } = useEntities();
  const { busy, run, actionError, setActionError } = useSaveAction(reload);

  const entityNames = useMemo(
    () => new Map(entities.map((e) => [e.id, e.name])),
    [entities]
  );

  const [entityId, setEntityId] = useState("");
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editEntityId, setEditEntityId] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (entityNames.get(i.entity_id) ?? "").toLowerCase().includes(q)
    );
  }, [items, query, entityNames]);

  const onAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!entityId) return setActionError("Choose the entity this loan product belongs to.");
    if (!name.trim()) return setActionError("Loan product name is required.");
    const created = await run((token) =>
      createLoanProduct(token, { name: name.trim(), entity_id: Number(entityId) })
    );
    // keep the entity selected so several products can be added in a row
    if (created) setName("");
  };

  const beginEdit = (row: LoanProduct) => {
    setEditingId(row.id);
    setEditName(row.name);
    setEditEntityId(String(row.entity_id));
  };

  const saveEdit = async () => {
    if (editingId === null) return;
    if (!editName.trim()) return setActionError("Loan product name is required.");
    const saved = await run((token) =>
      updateLoanProduct(token, editingId, {
        name: editName.trim(),
        entity_id: Number(editEntityId),
      })
    );
    if (saved) setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  const remove = async (id: number) => {
    if (await ask("Delete this loan product?", { title: "Delete loan product", kind: "warning" })) {
      await run((token) => deleteLoanProduct(token, id));
    }
  };

  const emptyMessage = isLoading
    ? "Loading loan products..."
    : error
      ? `Couldn't load loan products: ${error.message}`
      : items.length === 0
        ? "No loan products yet."
        : "No results match your filter.";

  const entityOptions = entities.map((e) => (
    <option key={e.id} value={e.id}>
      {e.name}
    </option>
  ));

  return (
    <SectionCard
      title="Loan Products"
      subtitle="Each loan product belongs to an entity. New workflows list the products of the entity you pick."
      right={
        <QuietBtn onClick={() => setQuery("")}>
          <FunnelIcon className="w-4 h-4" />
          Clear filter
        </QuietBtn>
      }
    >
      <Toolbar>
        <form
          onSubmit={onAdd}
          className="grid grid-cols-1 sm:grid-cols-6 gap-3 flex-1"
        >
          <div className="sm:col-span-2">
            <InlineSelect
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
            >
              <option value="">Select entity</option>
              {entityOptions}
            </InlineSelect>
          </div>
          <div className="sm:col-span-3">
            <InlineTextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name (e.g., Auto)"
            />
          </div>
          <div className="sm:col-span-1 flex">
            <PrimaryBtn type="submit" className="w-full" disabled={busy}>
              <PlusIcon className="w-5 h-5" />
              Add
            </PrimaryBtn>
          </div>
        </form>

        <div className="w-full sm:w-64">
          <InlineTextInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter loan products"
          />
        </div>
      </Toolbar>

      <ActionError message={actionError} />

      {entities.length === 0 && !isLoading && (
        <p className="text-xs text-amber-600 mb-4">
          Add an entity first under the <b>Entities</b> tab.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50/80">
            <tr className="text-left text-gray-700">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Entity</th>
              <th className="px-4 py-3 font-medium w-32">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-gray-500" colSpan={3}>
                  {emptyMessage}
                </td>
              </tr>
            )}

            {filtered.map((row) => {
              const isEditing = editingId === row.id;
              return (
                <tr key={row.id} className="border-t border-gray-100">
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <InlineTextInput
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    ) : (
                      <span className="text-gray-900">{row.name}</span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    {isEditing ? (
                      <InlineSelect
                        value={editEntityId}
                        onChange={(e) => setEditEntityId(e.target.value)}
                      >
                        {entityOptions}
                      </InlineSelect>
                    ) : (
                      <span className="text-gray-900">
                        {entityNames.get(row.entity_id) ?? ""}
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-2">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <IconButton
                          tone="green"
                          title="Save"
                          onClick={saveEdit}
                        >
                          <CheckIcon className="w-5 h-5" />
                        </IconButton>
                        <IconButton title="Cancel" onClick={cancelEdit}>
                          <XMarkIcon className="w-5 h-5" />
                        </IconButton>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <IconButton
                          tone="yellow"
                          title="Edit"
                          onClick={() => beginEdit(row)}
                        >
                          <PencilSquareIcon className="w-5 h-5" />
                        </IconButton>
                        <IconButton
                          tone="red"
                          title="Delete"
                          onClick={() => remove(row.id)}
                        >
                          <TrashIcon className="w-5 h-5" />
                        </IconButton>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
