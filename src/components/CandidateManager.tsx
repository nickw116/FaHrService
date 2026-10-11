"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GENDERS, GENDER_LABELS, type Gender } from "@/lib/constants";

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

interface WorkExperience {
  id: number;
  company: string;
  startDate: string;
  endDate: string;
  description: string;
}
interface InterviewSlot {
  id: number;
  startAt: string;
  endAt: string;
}

interface CandidateRow {
  id: number;
  name: string;
  gender: Gender;
  age: number | null;
  phone: string;
  photo: string;
  remark: string;
  updatedAt: string;
  store: {
    id: number;
    name: string;
    city: { id: number; name: string; brand: { id: number; name: string } };
  };
  workExperiences: WorkExperience[];
  interviewSlots: InterviewSlot[];
}

interface WorkExpForm {
  company: string;
  startDate: string;
  endDate: string;
  description: string;
}
interface SlotForm {
  startAt: string;
  endAt: string;
}

interface FormState {
  name: string;
  gender: Gender;
  age: string;
  phone: string;
  photo: string;
  brandId: number | "";
  cityId: number | "";
  storeId: number | "";
  remark: string;
  workExperiences: WorkExpForm[];
  interviewSlots: SlotForm[];
}

const EMPTY_FORM: FormState = {
  name: "",
  gender: "MALE",
  age: "",
  phone: "",
  photo: "",
  brandId: "",
  cityId: "",
  storeId: "",
  remark: "",
  workExperiences: [],
  interviewSlots: [],
};

type ModalState = { mode: "create" } | { mode: "edit"; candidate: CandidateRow } | null;

function pageNumbers(page: number, totalPages: number): (number | "…")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages: (number | "…")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  if (start > 2) pages.push("…");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < totalPages - 1) pages.push("…");
  pages.push(totalPages);
  return pages;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function fmtSlot(s: { startAt: string; endAt: string }): string {
  const a = new Date(s.startAt);
  const b = new Date(s.endAt);
  return `${a.getMonth() + 1}/${a.getDate()} ${pad2(a.getHours())}:${pad2(a.getMinutes())}~${pad2(b.getHours())}:${pad2(b.getMinutes())}`;
}

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
  const [brandId, setBrandId] = useState<number | "">("");
  const [cityId, setCityId] = useState<number | "">("");
  const [storeId, setStoreId] = useState<number | "">("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const [modal, setModal] = useState<ModalState>(null);

  function handleSearch() {
    setPage(1);
    setKeyword(keywordInput.trim());
  }

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
    if (brandId) params.set("brandId", String(brandId));
    if (cityId) params.set("cityId", String(cityId));
    if (storeId) params.set("storeId", String(storeId));
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    try {
      const r = await fetch(`/api/candidates?${params.toString()}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "加载失败");
      setCandidates(d.candidates ?? []);
      setTotal(d.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [keyword, brandId, cityId, storeId, page, pageSize]);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  const totalPages = Math.ceil(total / pageSize);

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
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSearch();
          }}
          placeholder="搜索人员姓名…"
          className={`${inputClass} w-52`}
        />
        <select
          value={brandId}
          onChange={(e) => {
            setPage(1);
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
            setPage(1);
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
          onChange={(e) => {
            setPage(1);
            setStoreId(e.target.value ? Number(e.target.value) : "");
          }}
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
        <button
          onClick={handleSearch}
          className="ml-auto rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          搜索
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-3">照片</th>
              <th className="px-4 py-3">姓名</th>
              <th className="px-4 py-3">性别</th>
              <th className="px-4 py-3">年龄</th>
              <th className="px-4 py-3">品牌</th>
              <th className="px-4 py-3">城市</th>
              <th className="px-4 py-3">店铺</th>
              <th className="px-4 py-3">可面试时间</th>
              <th className="px-4 py-3">备注</th>
              <th className="px-4 py-3">更新时间</th>
              <th className="px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-gray-400">
                  加载中…
                </td>
              </tr>
            ) : candidates.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-gray-400">
                  暂无数据
                </td>
              </tr>
            ) : (
              candidates.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {c.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.photo}
                        alt={c.name}
                        className="h-9 w-9 rounded-full border border-gray-200 object-cover"
                      />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-200 text-xs text-gray-500">
                        {c.name.slice(0, 1)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-gray-600">{GENDER_LABELS[c.gender] ?? c.gender}</td>
                  <td className="px-4 py-3 text-gray-600">{c.age ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{c.store.city.brand.name}</td>
                  <td className="px-4 py-3 text-gray-600">{c.store.city.name}</td>
                  <td className="px-4 py-3 text-gray-600">{c.store.name}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {c.interviewSlots.length === 0 ? (
                      "—"
                    ) : (
                      <div className="flex flex-col gap-0.5 text-xs">
                        {c.interviewSlots.slice(0, 2).map((s) => (
                          <span key={s.id}>{fmtSlot(s)}</span>
                        ))}
                        {c.interviewSlots.length > 2 && (
                          <span className="text-gray-400">+{c.interviewSlots.length - 2} 个</span>
                        )}
                      </div>
                    )}
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-4 py-3 text-sm">
          <span className="text-gray-500">
            共 {total} 条记录，第 {totalPages === 0 ? 0 : page} / {totalPages} 页
          </span>
          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(e) => {
                setPage(1);
                setPageSize(Number(e.target.value));
              }}
              className={selectClass}
            >
              {[10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n} 条/页
                </option>
              ))}
            </select>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-gray-300 px-3 py-2 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              上一页
            </button>
            {pageNumbers(page, totalPages).map((p, i) =>
              p === "…" ? (
                <span key={`ellipsis-${i}`} className="px-1 text-gray-400">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`min-w-9 rounded-lg border px-3 py-2 ${
                    p === page
                      ? "border-blue-600 bg-blue-600 font-medium text-white"
                      : "border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {p}
                </button>
              ),
            )}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-gray-300 px-3 py-2 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              下一页
            </button>
          </div>
        </div>
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>(() => {
    if (!editing) return EMPTY_FORM;
    return {
      name: editing.name,
      gender: editing.gender,
      age: editing.age != null ? String(editing.age) : "",
      phone: editing.phone,
      photo: editing.photo,
      brandId: editing.store.city.brand.id,
      cityId: editing.store.city.id,
      storeId: editing.store.id,
      remark: editing.remark,
      workExperiences: editing.workExperiences.map((w) => ({
        company: w.company,
        startDate: w.startDate,
        endDate: w.endDate,
        description: w.description,
      })),
      interviewSlots: editing.interviewSlots.map((s) => ({
        startAt: toLocalInput(s.startAt),
        endAt: toLocalInput(s.endAt),
      })),
    };
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
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

  function patchWork(i: number, p: Partial<WorkExpForm>) {
    setForm((f) => ({
      ...f,
      workExperiences: f.workExperiences.map((w, idx) => (idx === i ? { ...w, ...p } : w)),
    }));
  }

  function patchSlot(i: number, p: Partial<SlotForm>) {
    setForm((f) => ({
      ...f,
      interviewSlots: f.interviewSlots.map((s, idx) => (idx === i ? { ...s, ...p } : s)),
    }));
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setFormError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "上传失败");
      patch({ photo: d.url });
    } catch (err) {
      setFormError(
        err instanceof TypeError
          ? "网络连接失败（Failed to fetch），请刷新页面后重试"
          : err instanceof Error
            ? err.message
            : "上传失败",
      );
    } finally {
      setUploading(false);
    }
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
    const keptSlots = form.interviewSlots.filter((s) => s.startAt && s.endAt);
    for (const s of keptSlots) {
      if (new Date(s.startAt) >= new Date(s.endAt)) {
        setFormError("可面试时间的开始时间必须早于结束时间");
        return;
      }
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      gender: form.gender,
      age: form.age ? Number(form.age) : null,
      phone: form.phone.trim(),
      photo: form.photo,
      remark: form.remark.trim(),
      storeId: form.storeId,
      workExperiences: form.workExperiences
        .filter((w) => w.company.trim())
        .map((w) => ({
          company: w.company.trim(),
          startDate: w.startDate,
          endDate: w.endDate,
          description: w.description.trim(),
        })),
      interviewSlots: keptSlots.map((s) => ({
        startAt: new Date(s.startAt).toISOString(),
        endAt: new Date(s.endAt).toISOString(),
      })),
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
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold">
          {editing ? `编辑人员：${editing.name}` : "新增人员"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="shrink-0">
              <span className="mb-1 block text-sm text-gray-600">照片</span>
              <div className="flex items-center gap-3">
                {form.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={form.photo}
                    alt="照片"
                    className="h-16 w-16 rounded-full border border-gray-200 object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                    <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {uploading ? "上传中…" : form.photo ? "更换照片" : "上传照片"}
                  </button>
                  {form.photo && (
                    <button
                      type="button"
                      onClick={() => patch({ photo: "" })}
                      className="text-left text-xs text-red-600 hover:text-red-800"
                    >
                      移除照片
                    </button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-gray-600">姓名 *</span>
              <input
                value={form.name}
                onChange={(e) => patch({ name: e.target.value })}
                className={`${inputClass} w-full`}
                placeholder="请输入姓名"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-gray-600">性别</span>
              <select
                value={form.gender}
                onChange={(e) => patch({ gender: e.target.value as Gender })}
                className={`${selectClass} w-full`}
              >
                {GENDERS.map((g) => (
                  <option key={g} value={g}>
                    {GENDER_LABELS[g]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-gray-600">年龄</span>
              <input
                type="number"
                min={1}
                max={150}
                value={form.age}
                onChange={(e) => patch({ age: e.target.value })}
                className={`${inputClass} w-full`}
                placeholder="岁"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <label className="block text-sm sm:col-span-1">
              <span className="mb-1 block text-gray-600">电话</span>
              <input
                value={form.phone}
                onChange={(e) => patch({ phone: e.target.value })}
                className={`${inputClass} w-full`}
                placeholder="联系电话"
              />
            </label>
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

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-gray-600">工作经历</span>
              <button
                type="button"
                onClick={() =>
                  patch({
                    workExperiences: [
                      ...form.workExperiences,
                      { company: "", startDate: "", endDate: "", description: "" },
                    ],
                  })
                }
                className="text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                + 添加工作经历
              </button>
            </div>
            {form.workExperiences.length === 0 ? (
              <p className="rounded-lg border border-dashed border-gray-300 px-3 py-3 text-center text-xs text-gray-400">
                暂无工作经历，点击右上角添加
              </p>
            ) : (
              <div className="space-y-2">
                {form.workExperiences.map((w, i) => (
                  <div key={i} className="space-y-2 rounded-lg border border-gray-200 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={w.company}
                        onChange={(e) => patchWork(i, { company: e.target.value })}
                        placeholder="公司名称"
                        className={`${inputClass} min-w-32 flex-1`}
                      />
                      <input
                        type="month"
                        value={w.startDate}
                        onChange={(e) => patchWork(i, { startDate: e.target.value })}
                        title="开始时间"
                        className={inputClass}
                      />
                      <span className="text-xs text-gray-400">至</span>
                      <input
                        type="month"
                        value={w.endDate}
                        onChange={(e) => patchWork(i, { endDate: e.target.value })}
                        title="结束时间（留空为至今）"
                        className={inputClass}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          patch({ workExperiences: form.workExperiences.filter((_, idx) => idx !== i) })
                        }
                        className="text-sm text-red-600 hover:text-red-800"
                      >
                        删除
                      </button>
                    </div>
                    <textarea
                      value={w.description}
                      onChange={(e) => patchWork(i, { description: e.target.value })}
                      rows={2}
                      placeholder="工作内容"
                      className={`${inputClass} w-full resize-none`}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-gray-600">可面试时间</span>
              <button
                type="button"
                onClick={() =>
                  patch({ interviewSlots: [...form.interviewSlots, { startAt: "", endAt: "" }] })
                }
                className="text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                + 添加时间段
              </button>
            </div>
            {form.interviewSlots.length === 0 ? (
              <p className="rounded-lg border border-dashed border-gray-300 px-3 py-3 text-center text-xs text-gray-400">
                暂无可面试时间，点击右上角添加
              </p>
            ) : (
              <div className="space-y-2">
                {form.interviewSlots.map((s, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <input
                      type="datetime-local"
                      value={s.startAt}
                      onChange={(e) => patchSlot(i, { startAt: e.target.value })}
                      className={inputClass}
                    />
                    <span className="text-xs text-gray-400">至</span>
                    <input
                      type="datetime-local"
                      value={s.endAt}
                      onChange={(e) => patchSlot(i, { endAt: e.target.value })}
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        patch({ interviewSlots: form.interviewSlots.filter((_, idx) => idx !== i) })
                      }
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      删除
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

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
              disabled={saving || uploading}
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
