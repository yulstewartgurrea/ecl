import React, { useState, type FormEvent } from "react";
import { useAppDispatch, useAppSelector } from "../redux_toolkit/hooks";
import {
  addEntity, updateEntity, deleteEntity, type EclEntity
} from "../redux_toolkit/features/ecl/eclConfigSlice";
import {
  addBaseline, updateBaseline, deleteBaseline, type EclBaseline
} from "../redux_toolkit/features/ecl/eclBaselinesSlice";

import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

export default function EclConfigurationPage() {
  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      <header>
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">ECL Configuration</h1>
        <p className="text-sm text-gray-600">
          Manage your <strong>Entities</strong> and <strong>Baselines</strong> separately. These are stored in different tables.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EntitiesSection />
        <BaselinesSection />
      </div>
    </div>
  );
}

/* -------------------------------- ENTITIES -------------------------------- */

function EntitiesSection() {
  const dispatch = useAppDispatch();
  const items = useAppSelector(s => s.eclEntitiesReducer.items);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const onAdd = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return alert("Entity name is required.");
    dispatch(addEntity({ name: name.trim(), code: code.trim() || undefined, description: description.trim() || undefined }));
    setName(""); setCode(""); setDescription("");
  };

  const beginEdit = (row: EclEntity) => {
    setEditingId(row.id);
    setEditName(row.name);
  };

  const saveEdit = () => {
    if (!editingId) return;
    if (!editName.trim()) return alert("Entity name is required.");
    dispatch(updateEntity({
      id: editingId,
      name: editName.trim(),
    }));
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  const remove = (id: string) => {
    if (confirm("Delete this entity?")) dispatch(deleteEntity(id));
  };

  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-4 sm:p-6 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-800">Entities</h2>
        <p className="text-xs text-gray-500">Examples: Corporate Loans, Retail, SME…</p>
      </div>

      <div className="p-4 sm:p-6">
        {/* Create form */}
        <form onSubmit={onAdd} className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g., Corporate Loans"
              className="w-full rounded-lg border-gray-300 focus:border-yellow-500 focus:ring-yellow-500"
            />
          </div>

          <div className="sm:col-span-3 flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#ffbe0b] hover:bg-yellow-500 text-gray-800 font-medium shadow-sm"
            >
              <PlusIcon className="w-5 h-5" />
              Add Entity
            </button>
          </div>
        </form>

        {/* List */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-gray-700">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td className="px-4 py-6 text-gray-500" colSpan={4}>No entities yet.</td></tr>
              )}

              {items.map(row => {
                const isEditing = editingId === row.id;
                return (
                  <tr key={row.id} className="border-t border-gray-100">
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          className="w-full rounded-md border-gray-300 focus:border-yellow-500 focus:ring-yellow-500"
                        />
                      ) : <span className="text-gray-800">{row.name}</span>}
                    </td>

                    <td className="px-4 py-2">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <button onClick={saveEdit} className="p-1 rounded-md bg-green-100 hover:bg-green-200" title="Save">
                            <CheckIcon className="w-5 h-5 text-green-700" />
                          </button>
                          <button onClick={cancelEdit} className="p-1 rounded-md bg-gray-100 hover:bg-gray-200" title="Cancel">
                            <XMarkIcon className="w-5 h-5 text-gray-700" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button onClick={() => beginEdit(row)} className="p-1 rounded-md bg-yellow-100 hover:bg-yellow-200" title="Edit">
                            <PencilSquareIcon className="w-5 h-5 text-yellow-700" />
                          </button>
                          <button onClick={() => remove(row.id)} className="p-1 rounded-md bg-red-100 hover:bg-red-200" title="Delete">
                            <TrashIcon className="w-5 h-5 text-red-700" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------- BASELINES ------------------------------- */

function BaselinesSection() {
  const dispatch = useAppDispatch();
  const items = useAppSelector(s => s.eclBaselinesReducer.items);

  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editValue, setEditValue] = useState("");

  const onAdd = (e: FormEvent) => {
    e.preventDefault();
    const v = parseFloat(value);
    if (!label.trim()) return alert("Label is required.");
    if (isNaN(v)) return alert("Value (%) must be a number.");
    dispatch(addBaseline({ label: label.trim(), value: v }));
    setLabel(""); setValue("");
  };

  const beginEdit = (row: EclBaseline) => {
    setEditingId(row.id);
    setEditLabel(row.label);
    setEditValue(String(row.value));
  };

  const saveEdit = () => {
    if (!editingId) return;
    const v = parseFloat(editValue);
    if (!editLabel.trim()) return alert("Label is required.");
    if (isNaN(v)) return alert("Value (%) must be a number.");
    dispatch(updateBaseline({ id: editingId, label: editLabel.trim(), value: v }));
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);
  const remove = (id: string) => {
    if (confirm("Delete this baseline?")) dispatch(deleteBaseline(id));
  };

  const fmt = (n: number) => `${n.toFixed(2)}%`;

  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-4 sm:p-6 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-800">Baselines</h2>
        <p className="text-xs text-gray-500">Store baseline % values separately (distinct table from Entities).</p>
      </div>

      <div className="p-4 sm:p-6">
        {/* Create form */}
        <form onSubmit={onAdd} className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Label <span className="text-red-500">*</span>
            </label>
            <input
              value={label} onChange={e => setLabel(e.target.value)}
              placeholder="e.g., Default Baseline, Retail Baseline, 2025-Q3"
              className="w-full rounded-lg border-gray-300 focus:border-yellow-500 focus:ring-yellow-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Value (%) <span className="text-red-500">*</span>
            </label>
            <input
              type="number" step="0.01" inputMode="decimal"
              value={value} onChange={e => setValue(e.target.value)}
              placeholder="e.g., 2.50"
              className="w-full rounded-lg border-gray-300 focus:border-yellow-500 focus:ring-yellow-500"
            />
          </div>

          <div className="sm:col-span-3 flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#ffbe0b] hover:bg-yellow-500 text-gray-800 font-medium shadow-sm"
            >
              <PlusIcon className="w-5 h-5" />
              Add Baseline
            </button>
          </div>
        </form>

        {/* List */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-gray-700">
                <th className="px-4 py-3 font-medium">Label</th>
                <th className="px-4 py-3 font-medium">Value (%)</th>
                <th className="px-4 py-3 font-medium w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td className="px-4 py-6 text-gray-500" colSpan={3}>No baselines yet.</td></tr>
              )}

              {items.map(row => {
                const isEditing = editingId === row.id;
                return (
                  <tr key={row.id} className="border-t border-gray-100">
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          value={editLabel}
                          onChange={e => setEditLabel(e.target.value)}
                          className="w-full rounded-md border-gray-300 focus:border-yellow-500 focus:ring-yellow-500"
                        />
                      ) : <span className="text-gray-800">{row.label}</span>}
                    </td>

                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          type="number" step="0.01" inputMode="decimal"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          className="w-full rounded-md border-gray-300 focus:border-yellow-500 focus:ring-yellow-500"
                        />
                      ) : <span className="text-gray-800">{fmt(row.value)}</span>}
                    </td>

                    <td className="px-4 py-2">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <button onClick={saveEdit} className="p-1 rounded-md bg-green-100 hover:bg-green-200" title="Save">
                            <CheckIcon className="w-5 h-5 text-green-700" />
                          </button>
                          <button onClick={cancelEdit} className="p-1 rounded-md bg-gray-100 hover:bg-gray-200" title="Cancel">
                            <XMarkIcon className="w-5 h-5 text-gray-700" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button onClick={() => beginEdit(row)} className="p-1 rounded-md bg-yellow-100 hover:bg-yellow-200" title="Edit">
                            <PencilSquareIcon className="w-5 h-5 text-yellow-700" />
                          </button>
                          <button onClick={() => remove(row.id)} className="p-1 rounded-md bg-red-100 hover:bg-red-200" title="Delete">
                            <TrashIcon className="w-5 h-5 text-red-700" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
