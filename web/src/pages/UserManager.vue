<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch, nextTick } from "vue";
import { ElMessage, ElTree } from "element-plus";
import { api } from "../api";
import { getUser } from "../auth";
import { ROLE_LABEL, ROLE_TAG, type BrandNode, type Role, type UserInfo } from "../types";

const me = getUser();

const users = ref<UserInfo[]>([]);
const loading = ref(false);
const brands = ref<BrandNode[]>([]);

const scopeVisible = ref(false);
const scopeTarget = ref<UserInfo | null>(null);
const scopeTreeRef = ref<InstanceType<typeof ElTree>>();
const scopeSaving = ref(false);

const scopeTree = computed(() =>
  brands.value.map((b) => ({
    key: `brand-${b.id}`,
    label: b.name,
    children: b.cities.map((c) => ({
      key: `city-${c.id}`,
      label: c.name,
      children: c.stores.map((s) => ({ key: `store-${s.id}`, label: s.name })),
    })),
  })),
);

const nodeNames = computed(() => {
  const m = new Map<string, string>();
  for (const b of brands.value) {
    m.set(`brand-${b.id}`, b.name);
    for (const c of b.cities) {
      m.set(`city-${c.id}`, c.name);
      for (const s of c.stores) m.set(`store-${s.id}`, s.name);
    }
  }
  return m;
});

function scopeLabel(u: UserInfo): string {
  if (u.role === "admin") return "全部";
  if (!u.scopes?.length) return "未分配";
  return u.scopes.map((s) => nodeNames.value.get(`${s.level}-${s.nodeId}`) ?? `#${s.nodeId}`).join("、");
}

function openScope(u: UserInfo) {
  scopeTarget.value = u;
  scopeVisible.value = true;
}

watch(scopeVisible, async (v) => {
  if (!v) return;
  await nextTick();
  const u = scopeTarget.value;
  scopeTreeRef.value?.setCheckedKeys(u?.scopes?.map((s) => `${s.level}-${s.nodeId}`) ?? []);
});

async function saveScope() {
  const t = scopeTarget.value;
  if (!t) return;
  const keys = (scopeTreeRef.value?.getCheckedKeys(false) ?? []) as string[];
  const scopes = keys.map((k) => {
    const [level, id] = k.split("-");
    return { level, nodeId: Number(id) };
  });
  scopeSaving.value = true;
  try {
    await api(`/api/users/${t.id}/scope`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scopes }),
    });
    ElMessage.success("权限范围已保存");
    scopeVisible.value = false;
    await load();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "保存失败");
  } finally {
    scopeSaving.value = false;
  }
}

async function loadOrg() {
  try {
    const d = await api<{ brands: BrandNode[] }>("/api/org");
    brands.value = d.brands;
  } catch {
    ElMessage.error("组织架构加载失败");
  }
}

const createVisible = ref(false);
const createForm = reactive({ username: "", password: "", role: "fahr" as Role });
const creating = ref(false);

const editVisible = ref(false);
const editTarget = ref<UserInfo | null>(null);
const editForm = reactive({ role: "fahr" as Role, password: "" });
const saving = ref(false);

const roleOptions: Role[] = ["admin", "fahr", "manager", "hr"];

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("zh-CN", { hour12: false });
}

async function load() {
  loading.value = true;
  try {
    const d = await api<{ users: UserInfo[] }>("/api/users");
    users.value = d.users;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
  } finally {
    loading.value = false;
  }
}

async function createUser() {
  if (!createForm.username.trim() || createForm.password.length < 6) {
    ElMessage.warning("用户名必填，密码至少 6 位");
    return;
  }
  creating.value = true;
  try {
    await api("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: createForm.username.trim(),
        password: createForm.password,
        role: createForm.role,
      }),
    });
    ElMessage.success("用户已创建");
    createVisible.value = false;
    createForm.username = "";
    createForm.password = "";
    createForm.role = "fahr";
    await load();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "创建失败");
  } finally {
    creating.value = false;
  }
}

function openEdit(u: UserInfo) {
  editTarget.value = u;
  editForm.role = u.role;
  editForm.password = "";
  editVisible.value = true;
}

async function saveEdit() {
  const target = editTarget.value;
  if (!target) return;
  if (editForm.password && editForm.password.length < 6) {
    ElMessage.warning("密码至少 6 位");
    return;
  }
  saving.value = true;
  try {
    await api(`/api/users/${target.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: editForm.role,
        ...(editForm.password ? { password: editForm.password } : {}),
      }),
    });
    ElMessage.success("已保存");
    editVisible.value = false;
    await load();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "保存失败");
  } finally {
    saving.value = false;
  }
}

async function removeUser(u: UserInfo) {
  try {
    await api(`/api/users/${u.id}`, { method: "DELETE" });
    ElMessage.success(`已删除用户 ${u.username}`);
    await load();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "删除失败");
  }
}

onMounted(() => {
  load();
  loadOrg();
});
</script>

<template>
  <div class="page">
    <div class="bar">
      <h2 class="title">用户管理</h2>
      <el-button type="primary" @click="createVisible = true">新建用户</el-button>
    </div>

    <el-table v-loading="loading" :data="users" border>
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="username" label="用户名" min-width="140" />
      <el-table-column label="角色" width="110">
        <template #default="{ row }">
          <el-tag :type="ROLE_TAG[row.role as Role] ?? 'info'">
            {{ ROLE_LABEL[row.role as Role] ?? row.role }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="权限范围" min-width="180">
        <template #default="{ row }">
          <span class="scope-text">{{ scopeLabel(row) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="180">
        <template #default="{ row }">{{ fmtTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="240">
        <template #default="{ row }">
          <el-button size="small" @click="openEdit(row)">编辑</el-button>
          <el-button v-if="row.role !== 'admin'" size="small" type="primary" plain @click="openScope(row)">
            分配权限
          </el-button>
          <el-popconfirm
            :title="`确定删除用户 ${row.username}？`"
            confirm-button-text="删除"
            confirm-button-type="danger"
            cancel-button-text="取消"
            @confirm="removeUser(row)"
          >
            <template #reference>
              <el-button size="small" type="danger" :disabled="row.id === me?.id">删除</el-button>
            </template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="createVisible" title="新建用户" width="420px">
      <el-form label-width="80px">
        <el-form-item label="用户名" required>
          <el-input v-model="createForm.username" autocomplete="off" />
        </el-form-item>
        <el-form-item label="密码" required>
          <el-input v-model="createForm.password" type="password" autocomplete="new-password" show-password />
        </el-form-item>
        <el-form-item label="角色">
          <el-radio-group v-model="createForm.role">
            <el-radio v-for="r in roleOptions" :key="r" :value="r">{{ ROLE_LABEL[r] }}</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="createUser">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="editVisible" :title="`编辑用户 ${editTarget?.username ?? ''}`" width="420px">
      <el-form label-width="80px">
        <el-form-item label="角色">
          <el-radio-group v-model="editForm.role">
            <el-radio v-for="r in roleOptions" :key="r" :value="r">{{ ROLE_LABEL[r] }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="重置密码">
          <el-input
            v-model="editForm.password"
            type="password"
            autocomplete="new-password"
            placeholder="留空则不修改密码"
            show-password
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>
    <el-dialog v-model="scopeVisible" :title="`分配权限 · ${scopeTarget?.username ?? ''}`" width="440px">
      <p class="scope-tip">勾选该用户可查看和操作的品牌 / 城市 / 店铺，不勾选则无任何数据权限：</p>
      <el-tree
        ref="scopeTreeRef"
        :data="scopeTree"
        :props="{ label: 'label', children: 'children' }"
        node-key="key"
        show-checkbox
        default-expand-all
      />
      <template #footer>
        <el-button @click="scopeVisible = false">取消</el-button>
        <el-button type="primary" :loading="scopeSaving" @click="saveScope">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page {
  max-width: 960px;
  margin: 0 auto;
}

.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.title {
  margin: 0;
  font-size: 18px;
}

.scope-text {
  font-size: 13px;
  color: #606266;
}

.scope-tip {
  margin: 0 0 12px;
  font-size: 13px;
  color: #909399;
}
</style>
