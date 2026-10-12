<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { api, withBase } from "../api";
import type { BrandNode, CandidateRow } from "../types";
import { STATUS_LABEL, STATUS_TAG } from "../status";
import CandidateFormDialog from "./CandidateFormDialog.vue";

const brands = ref<BrandNode[]>([]);
const candidates = ref<CandidateRow[]>([]);
const loading = ref(false);

const keywordInput = ref("");
const keyword = ref("");
const filterPath = ref<number[] | undefined>();
const appliedPath = ref<number[] | undefined>();
const page = ref(1);
const pageSize = ref(10);
const total = ref(0);

const dialogVisible = ref(false);
const editingCandidate = ref<CandidateRow | null>(null);
const previewMode = ref(false);

const filterCascaderProps = { value: "id", label: "name", checkStrictly: true };

const cascaderOptions = computed(() =>
  brands.value.map((b) => ({
    id: b.id,
    name: b.name,
    children: b.cities.map((c) => ({
      id: c.id,
      name: c.name,
      children: c.stores.map((s) => ({ id: s.id, name: s.name })),
    })),
  })),
);

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function fmtSlot(s: { startAt: string; endAt: string }) {
  const a = new Date(s.startAt);
  const b = new Date(s.endAt);
  return `${a.getMonth() + 1}/${a.getDate()} ${pad2(a.getHours())}:${pad2(a.getMinutes())} ~ ${pad2(b.getHours())}:${pad2(b.getMinutes())}`;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("zh-CN", { hour12: false });
}

async function loadOrg() {
  try {
    const d = await api<{ brands: BrandNode[] }>("/api/org");
    brands.value = d.brands;
  } catch {
    ElMessage.error("组织架构加载失败");
  }
}

async function load() {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (keyword.value) params.set("keyword", keyword.value);
    const [brandId, cityId, storeId] = appliedPath.value ?? [];
    if (brandId) params.set("brandId", String(brandId));
    if (cityId) params.set("cityId", String(cityId));
    if (storeId) params.set("storeId", String(storeId));
    params.set("page", String(page.value));
    params.set("pageSize", String(pageSize.value));
    const d = await api<{ candidates: CandidateRow[]; total: number }>(
      `/api/candidates?${params.toString()}`,
    );
    candidates.value = d.candidates;
    total.value = d.total;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  page.value = 1;
  keyword.value = keywordInput.value.trim();
  appliedPath.value = filterPath.value;
  load();
}

function handlePageChange(p: number) {
  page.value = p;
  load();
}

function handleSizeChange(s: number) {
  pageSize.value = s;
  page.value = 1;
  load();
}

function openCreate() {
  editingCandidate.value = null;
  previewMode.value = false;
  dialogVisible.value = true;
}

async function handlePublish(row: CandidateRow) {
  try {
    await ElMessageBox.confirm(`发布后「${row.name}」的简历将在电子简历系统中可见，确认发布？`, "发布简历", {
      type: "warning",
      confirmButtonText: "发布",
      cancelButtonText: "取消",
    });
  } catch {
    return;
  }
  try {
    await api(`/api/candidates/${row.id}/resume-link`, { method: "POST" });
    ElMessage.success("已发布");
    load();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "发布失败");
  }
}

function openEdit(row: CandidateRow) {
  editingCandidate.value = row;
  previewMode.value = false;
  dialogVisible.value = true;
}

function openPreview(row: CandidateRow) {
  editingCandidate.value = row;
  previewMode.value = true;
  dialogVisible.value = true;
}

async function handleUnpublish(row: CandidateRow) {
  try {
    await ElMessageBox.confirm(
      `取消发布后「${row.name}」将从电子简历系统下线，确定取消发布？`,
      "取消发布",
      {
        type: "warning",
        confirmButtonText: "取消发布",
        cancelButtonText: "再想想",
      },
    );
  } catch {
    return;
  }
  try {
    await api(`/api/candidates/${row.id}/unpublish`, { method: "POST" });
    ElMessage.success("已取消发布");
    load();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "操作失败");
  }
}

async function handleDelete(row: CandidateRow) {
  try {
    await ElMessageBox.confirm(`确定删除人员「${row.name}」吗？`, "提示", {
      type: "warning",
      confirmButtonText: "删除",
      cancelButtonText: "取消",
    });
  } catch {
    return;
  }
  try {
    await api(`/api/candidates/${row.id}`, { method: "DELETE" });
    ElMessage.success("已删除");
    load();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "删除失败");
  }
}

onMounted(() => {
  loadOrg();
  load();
});
</script>

<template>
  <div>
    <el-card class="filter-card" shadow="never">
      <div class="filter-bar">
        <el-input
          v-model="keywordInput"
          placeholder="搜索人员姓名…"
          clearable
          class="keyword-input"
          @keyup.enter="handleSearch"
        />
        <el-cascader
          v-model="filterPath"
          :options="cascaderOptions"
          :props="filterCascaderProps"
          placeholder="品牌 / 城市 / 店铺"
          clearable
          class="filter-cascader"
        />
        <el-button type="primary" class="search-btn" @click="handleSearch">搜索</el-button>
      </div>
    </el-card>

    <el-card shadow="never">
      <div class="toolbar">
        <span class="card-title">人员列表</span>
        <el-button type="primary" @click="openCreate">+ 新增人员</el-button>
      </div>
      <el-table v-loading="loading" :data="candidates" stripe>
        <el-table-column label="照片" width="70" align="center">
          <template #default="{ row }">
            <el-avatar :size="36" :src="row.photo ? withBase(row.photo) : undefined">{{ row.name.slice(0, 1) }}</el-avatar>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="姓名" width="90" />
        <el-table-column label="性别" width="65" align="center">
          <template #default="{ row }">{{ row.gender === "MALE" ? "男" : "女" }}</template>
        </el-table-column>
        <el-table-column label="年龄" width="65" align="center">
          <template #default="{ row }">{{ row.age ?? "—" }}</template>
        </el-table-column>
        <el-table-column label="品牌" width="90">
          <template #default="{ row }">{{ row.store.city.brand.name }}</template>
        </el-table-column>
        <el-table-column label="城市" width="80">
          <template #default="{ row }">{{ row.store.city.name }}</template>
        </el-table-column>
        <el-table-column label="店铺" min-width="110">
          <template #default="{ row }">{{ row.store.name }}</template>
        </el-table-column>
        <el-table-column label="可面试时间" min-width="150">
          <template #default="{ row }">
            <template v-if="row.interviewSlots.length">
              <div v-for="s in row.interviewSlots.slice(0, 2)" :key="s.id" class="slot">
                {{ fmtSlot(s) }}
              </div>
              <div v-if="row.interviewSlots.length > 2" class="slot slot-more">
                +{{ row.interviewSlots.length - 2 }} 个
              </div>
            </template>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="备注" min-width="100" show-overflow-tooltip>
          <template #default="{ row }">{{ row.remark || "—" }}</template>
        </el-table-column>
        <el-table-column label="状态" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="STATUS_TAG[row.status] ?? 'info'" size="small">
              {{ STATUS_LABEL[row.status] ?? row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" width="160">
          <template #default="{ row }">{{ fmtTime(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <div class="op-btns">
              <el-button v-if="!row.published" link type="success" class="op-btn op-first" @click="handlePublish(row)">发布</el-button>
              <el-button v-else link type="warning" class="op-btn op-first" @click="handleUnpublish(row)">取消发布</el-button>
              <el-button v-if="row.published" link type="primary" class="op-btn" @click="openPreview(row)">预览</el-button>
              <el-button v-else link type="primary" class="op-btn" @click="openEdit(row)">编辑</el-button>
              <el-button link type="danger" class="op-btn" @click="handleDelete(row)">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <div class="pager">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          background
          layout="total, sizes, prev, pager, next"
          :total="total"
          :page-sizes="[10, 20, 50]"
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>

    <CandidateFormDialog
      v-model="dialogVisible"
      :brands="brands"
      :candidate="editingCandidate"
      :readonly="previewMode"
      @saved="load"
    />
  </div>
</template>

<style scoped>
.filter-card {
  margin-bottom: 16px;
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.card-title {
  font-size: 15px;
  font-weight: 600;
}
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
.keyword-input {
  width: 220px;
}
.filter-cascader {
  width: 260px;
}
.search-btn {
  margin-left: auto;
}
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
.slot {
  font-size: 12px;
  color: #606266;
  line-height: 1.6;
}
.slot-more {
  color: #909399;
}
.op-btns {
  display: flex;
  align-items: center;
}
.op-btn {
  margin-left: 0;
  padding: 0;
  justify-content: center;
}
.op-first {
  width: 60px;
  flex-shrink: 0;
}
.op-btn:not(.op-first) {
  width: 44px;
}
</style>
