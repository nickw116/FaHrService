<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { api } from "../api";
import type { BrandNode } from "../types";

type OrgType = "brand" | "city" | "store";

interface OrgRow {
  key: string;
  id: number;
  name: string;
  type: OrgType;
  candidateCount: number | null;
  children?: OrgRow[];
}

const TYPE_LABEL: Record<OrgType, string> = {
  brand: "品牌",
  city: "城市",
  store: "店铺",
};

const TYPE_TAG: Record<OrgType, "primary" | "success" | "info"> = {
  brand: "primary",
  city: "success",
  store: "info",
};

const LEVEL_API: Record<OrgType, string> = {
  brand: "brands",
  city: "cities",
  store: "stores",
};

const brands = ref<BrandNode[]>([]);
const loading = ref(false);

const rows = computed<OrgRow[]>(() =>
  brands.value.map((b) => ({
    key: `brand-${b.id}`,
    id: b.id,
    name: b.name,
    type: "brand",
    candidateCount: null,
    children: b.cities.map((c) => ({
      key: `city-${c.id}`,
      id: c.id,
      name: c.name,
      type: "city",
      candidateCount: null,
      children: c.stores.map((s) => ({
        key: `store-${s.id}`,
        id: s.id,
        name: s.name,
        type: "store",
        candidateCount: s._count?.candidates ?? 0,
      })),
    })),
  })),
);

async function load() {
  loading.value = true;
  try {
    const d = await api<{ brands: BrandNode[] }>("/api/org");
    brands.value = d.brands;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
  } finally {
    loading.value = false;
  }
}

onMounted(load);

type DialogState =
  | { mode: "create"; type: OrgType; parentId: number; parentName: string }
  | { mode: "edit"; row: OrgRow }
  | null;

const dialog = ref<DialogState>(null);
const dialogName = ref("");
const saving = ref(false);

const dialogVisible = computed({
  get: () => dialog.value !== null,
  set: (v: boolean) => {
    if (!v) dialog.value = null;
  },
});

const dialogTitle = computed(() => {
  const d = dialog.value;
  if (!d) return "";
  if (d.mode === "create") {
    return d.type === "brand" ? "新增品牌" : `新增${TYPE_LABEL[d.type]}（${d.parentName}）`;
  }
  return `编辑${TYPE_LABEL[d.row.type]}：${d.row.name}`;
});

function openCreate(type: OrgType, parent?: OrgRow) {
  dialogName.value = "";
  dialog.value = {
    mode: "create",
    type,
    parentId: parent?.id ?? 0,
    parentName: parent?.name ?? "",
  };
}

function openEdit(row: OrgRow) {
  dialogName.value = row.name;
  dialog.value = { mode: "edit", row };
}

async function submitDialog() {
  const d = dialog.value;
  const name = dialogName.value.trim();
  if (!d) return;
  if (!name) {
    ElMessage.warning("名称不能为空");
    return;
  }
  saving.value = true;
  try {
    if (d.mode === "create") {
      await api(`/api/org/${LEVEL_API[d.type]}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parentId: d.parentId }),
      });
    } else {
      await api(`/api/org/${LEVEL_API[d.row.type]}/${d.row.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
    }
    ElMessage.success("已保存");
    dialog.value = null;
    load();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "保存失败");
  } finally {
    saving.value = false;
  }
}

async function handleDelete(row: OrgRow) {
  const tips: Record<OrgType, string> = {
    brand: "删除前需先清空其下所有城市",
    city: "删除前需先清空其下所有店铺",
    store: "删除前需先清空其下所有人员",
  };
  try {
    await ElMessageBox.confirm(
      `确定删除${TYPE_LABEL[row.type]}「${row.name}」吗？（${tips[row.type]}）`,
      "提示",
      { type: "warning", confirmButtonText: "删除", cancelButtonText: "取消" },
    );
  } catch {
    return;
  }
  try {
    await api(`/api/org/${LEVEL_API[row.type]}/${row.id}`, { method: "DELETE" });
    ElMessage.success("已删除");
    load();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "删除失败");
  }
}
</script>

<template>
  <div>
    <el-card shadow="never">
      <div class="toolbar">
        <span class="card-title">品牌 / 城市 / 店铺</span>
        <el-button type="primary" @click="openCreate('brand')">+ 新增品牌</el-button>
      </div>
      <el-table
        v-loading="loading"
        :data="rows"
        row-key="key"
        default-expand-all
        :tree-props="{ children: 'children' }"
      >
        <el-table-column prop="name" label="名称" min-width="220" />
        <el-table-column label="类型" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="TYPE_TAG[row.type as OrgType]" size="small">
              {{ TYPE_LABEL[row.type as OrgType] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="人员数" width="90" align="center">
          <template #default="{ row }">
            {{ row.type === "store" ? row.candidateCount : "—" }}
          </template>
        </el-table-column>
        <el-table-column label="操作" min-width="240">
          <template #default="{ row }">
            <el-button
              v-if="row.type === 'brand'"
              link
              type="primary"
              @click="openCreate('city', row)"
            >
              新增城市
            </el-button>
            <el-button
              v-if="row.type === 'city'"
              link
              type="primary"
              @click="openCreate('store', row)"
            >
              新增店铺
            </el-button>
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="420px">
      <el-form label-width="60px" label-position="left" @submit.prevent="submitDialog">
        <el-form-item label="名称" required>
          <el-input v-model="dialogName" placeholder="请输入名称" @keyup.enter="submitDialog" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = null">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitDialog">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
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
</style>
