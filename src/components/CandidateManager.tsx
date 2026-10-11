"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CANDIDATE_STATUSES,
  STATUS_BADGE_CLASS,
  STATUS_LABELS,
  type CandidateStatus,
} from "@/lib/constants";

interface StoreNode {
  id: number;
  name: string;
}
interface CityNode {
  id: number;
  name: string;
  stores: StoreNode[];
}
interface BrandNode {
  id: number;
  name: string;
  cities: CityNode[];
}

interface CandidateRow {
  id: number;
  name: string;
  phone: string;
  status: CandidateStatus;
  remark: string;
  updatedAt: string;
  store: {
    id: number;
    name: string;
    city: { id: number; name: string; brand: { id: number; name: string } };
  };
}

interface FormState {
  name: string;
  phone: string;
  brandId: number | "";
  cityId: number | "";
  storeId: number | "";
  status: CandidateStatus;
  remark: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  phone: "",
  brandId: "",
  cityId: "",
  storeId: "",
  status: "PENDING_CONFIRMATION",
  remark: "",
};

type ModalState = { mode: "create" } | { mode: "edit"; candidate: CandidateRow } | null;

const selectClass =
  "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100";
const inputClass =
  "rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";

export default function CandidateManager() {
  const [brands, setBrands] = useState<BrandNode[]>([]);
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("");
  const [brandId, setBrandId] = useState<number | "">("");
  const [cityId, setCityId] = useState<number | "">("");
  const [storeId, setStoreId] = useState<number | "">("");

  const [modal, setModal] = useState<ModalState>(null);

  useEffect(() => {
    const timer = setTimeout(() => setKeyword(keywordInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [keywordInput]);

  useEffect(() => {
    fetch("/api/org")
      .then((r) => r.json())
      .then((d) => setBrands(d.brands ?? []))
      .catch(() => setError("组织架构加载失败"));
  }, []);

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (keyword) params.set("keyword", keyword);
    if (status) params.set("status", status);
    if (brandId) params.set("brandId", String(brandId));
    if (cityId) params.set("cityId", String(cityId));
    if (storeId) params.set("storeId", String(storeId));
    try {
      const r = await fetch(`/api/candidates?${params.toString()}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "加载失败");
      setCandidates(d.candidates ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [keyword, status, brandId, cityId, storeId]);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  const filterCities = useMemo(() => {
    const b = brands.find((x) => x.id === brandId);
    return b ? b.cities : [];
  }, [brands, brandId]);

  const filterStores = useMemo(() => {
    const c = filterCities.find((x) => x.id === cityId);
    return c ? c.stores : [];
  }, [filterCities, cityId]);

  async function handleDelete(c: CandidateRow) {
    if (!window.confirm(`确定删除人员「${c.name}」吗？`)) return;
    const r = await fetch(`/api/candidates/${c.id}`, { method: "DELETE" });
    if (r.ok) {
      loadCandidates();
    } else {
      const d = await r.json();
      alert(d.error || "删除失败");
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">人员管理</h1>
          <p className="mt-1 text-sm text-gray-500">品牌 → 城市 → 店铺 三级架构 HR 人员录入系统</p>
        </div>
        <button
          onClick={() => setModal({ mode: "create" })}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + 新增人员
        </button>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <input
          value={keywordInput}
          onChange={(e) => setKeywordInput(e.target.value)}
          placeholder="搜索人员姓名…"
          className={`${inputClass} w-52`}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
          <option value="">全部状态</option>
          {CANDIDATE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          value={brandId}
          onChange={(e) => {
            setBrandId(e.target.value ? Number(e.target.value) : "");
            setCityId("");
            setStoreId("");
          }}
          className={selectClass}
        >
          <option value="">全部品牌</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          value={cityId}
          onChange={(e) => {
            setCityId(e.target.value ? Number(e.target.value) : "");
            setStoreId("");
          }}
          disabled={!brandId}
          className={selectClass}
        >
          <option value="">全部城市</option>
          {filterCities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={storeId}
          onChange={(e) => setStoreId(e.target.value ? Number(e.target.value) : "")}
          disabled={!cityId}
          className={selectClass}
        >
          <option value="">全部店铺</option>
          {filterStores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <span className="ml-auto text-sm text-gray-500">共 {candidates.length} 人</span>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-3">姓名</th>
              <th className="px-4 py-3">电话</th>
              <th className="px-4 py-3">品牌</th>
              <th className="px-4 py-3">城市</th>
              <th className="px-4 py-3">店铺</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3">备注</th>
              <th className="px-4 py-3">更新时间</th>
              <th className="px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-gray-400">
                  加载中…
                </td>
              </tr>
            ) : candidates.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-gray-400">
                  暂无数据
                </td>
              </tr>
            ) : (
              candidates.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-gray-600">{c.phone || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{c.store.city.brand.name}</td>
                  <td className="px-4 py-3 text-gray-600">{c.store.city.name}</td>
                  <td className="px-4 py-3 text-gray-600">{c.store.name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_BADGE_CLASS[c.status] ?? "bg-gray-100 text-gray-700 ring-gray-300"}`}
                    >
                      {STATUS_LABELS[c.status] ?? c.status}
                    </span>
                  </td>
                  <td className="max-w-40 truncate px-4 py-3 text-gray-600" title={c.remark}>
                    {c.remark || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(c.updatedAt).toLocaleString("zh-CN", { hour12: false })}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <button
                      onClick={() => setModal({ mode: "edit", candidate: c })}
                      className="mr-3 font-medium text-blue-600 hover:text-blue-800"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => handleDelete(c)}
                      className="font-medium text-red-600 hover:text-red-800"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <CandidateFormModal
          modal={modal}
          brands={brands}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            loadCandidates();
          }}
        />
      )}
    </div>
  );
}

function CandidateFormModal({
  modal,
  brands,
  onClose,
  onSaved,
}: {
  modal: Exclude<ModalState, null>;
  brands: BrandNode[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = modal.mode === "edit" ? modal.candidate : null;

  const [form, setForm] = useState<FormState>(() => {
    if (!editing) return EMPTY_FORM;
    return {
      name: editing.name,
      phone: editing.phone,
      brandId: editing.store.city.brand.id,
      cityId: editing.store.city.id,
      storeId: editing.store.id,
      status: editing.status,
      remark: editing.remark,
    };
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const formCities = useMemo(() => {
    const b = brands.find((x) => x.id === form.brandId);
    return b ? b.cities : [];
  }, [brands, form.brandId]);

  const formStores = useMemo(() => {
    const c = formCities.find((x) => x.id === form.cityId);
    return c ? c.stores : [];
  }, [formCities, form.cityId]);

  function patch(p: Partial<FormState>) {
    setForm((f) => ({ ...f, ...p }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.name.trim()) {
      setFormError("姓名不能为空");
      return;
    }
    if (!form.storeId) {
      setFormError("请选择所属店铺");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      status: form.status,
      remark: form.remark.trim(),
      storeId: form.storeId,
    };
    try {
      const r = await fetch(editing ? `/api/candidates/${editing.id}` : "/api/candidates", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "保存失败");
      onSaved();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold">
          {editing ? `编辑人员：${editing.name}` : "新增人员"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <label className="block text-sm">
              <span className="mb-1 block text-gray-600">姓名 *</span>
              <input
                value={form.name}
                onChange={(e) => patch({ name: e.target.value })}
                className={`${inputClass} w-full`}
                placeholder="请输入姓名"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-gray-600">电话</span>
              <input
                value={form.phone}
                onChange={(e) => patch({ phone: e.target.value })}
                className={`${inputClass} w-full`}
                placeholder="请输入联系电话"
              />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <label className="block text-sm">
              <span className="mb-1 block text-gray-600">品牌 *</span>
              <select
                value={form.brandId}
                onChange={(e) =>
                  patch({
                    brandId: e.target.value ? Number(e.target.value) : "",
                    cityId: "",
                    storeId: "",
                  })
                }
                className={`${selectClass} w-full`}
              >
                <option value="">请选择</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-gray-600">城市 *</span>
              <select
                value={form.cityId}
                onChange={(e) =>
                  patch({ cityId: e.target.value ? Number(e.target.value) : "", storeId: "" })
                }
                disabled={!form.brandId}
                className={`${selectClass} w-full`}
              >
                <option value="">请选择</option>
                {formCities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-gray-600">店铺 *</span>
              <select
                value={form.storeId}
                onChange={(e) => patch({ storeId: e.target.value ? Number(e.target.value) : "" })}
                disabled={!form.cityId}
                className={`${selectClass} w-full`}
              >
                <option value="">请选择</option>
                {formStores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block text-gray-600">状态</span>
            <select
              value={form.status}
              onChange={(e) => patch({ status: e.target.value as CandidateStatus })}
              className={`${selectClass} w-full`}
            >
              {CANDIDATE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-gray-600">备注</span>
            <textarea
              value={form.remark}
              onChange={(e) => patch({ remark: e.target.value })}
              rows={2}
              className={`${inputClass} w-full resize-none`}
              placeholder="其他补充信息"
            />
          </label>

          {formError && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "保存中…" : "保存"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
