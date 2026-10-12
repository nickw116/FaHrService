<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { ElMessage, type UploadRequestOptions } from "element-plus";
import { api, withBase } from "../api";
import type { BrandNode, CandidateRow } from "../types";

const props = defineProps<{
  modelValue: boolean;
  brands: BrandNode[];
  candidate: CandidateRow | null;
  readonly?: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  saved: [];
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

interface WorkExpForm {
  company: string;
  startDate: string;
  endDate: string;
  description: string;
}

interface FormState {
  name: string;
  gender: "MALE" | "FEMALE";
  age: number | undefined;
  phone: string;
  photo: string;
  path: number[];
  remark: string;
  workExperiences: WorkExpForm[];
  slots: string[][];
}

function emptyForm(): FormState {
  return {
    name: "",
    gender: "MALE",
    age: undefined,
    phone: "",
    photo: "",
    path: [],
    remark: "",
    workExperiences: [],
    slots: [],
  };
}

const form = reactive<FormState>(emptyForm());
const saving = ref(false);
const uploading = ref(false);

const formCascaderProps = { value: "id", label: "name" };

const cascaderOptions = computed(() =>
  props.brands.map((b) => ({
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

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

watch(
  () => props.modelValue,
  (v) => {
    if (!v) return;
    Object.assign(form, emptyForm());
    const c = props.candidate;
    if (!c) return;
    form.name = c.name;
    form.gender = c.gender;
    form.age = c.age ?? undefined;
    form.phone = c.phone;
    form.photo = c.photo;
    form.remark = c.remark;
    form.path = [c.store.city.brand.id, c.store.city.id, c.store.id];
    form.workExperiences = c.workExperiences.map((w) => ({
      company: w.company,
      startDate: w.startDate,
      endDate: w.endDate,
      description: w.description,
    }));
    form.slots = c.interviewSlots.map((s) => [toLocalInput(s.startAt), toLocalInput(s.endAt)]);
  },
);

async function uploadPhoto(options: UploadRequestOptions) {
  uploading.value = true;
  try {
    const fd = new FormData();
    fd.append("file", options.file);
    const d = await api<{ url: string }>("/api/upload", { method: "POST", body: fd });
    form.photo = d.url;
    options.onSuccess(d);
  } catch (e) {
    options.onError(e as unknown as Error);
    ElMessage.error(
      e instanceof TypeError
        ? "网络连接失败（Failed to fetch），请刷新页面后重试"
        : e instanceof Error
          ? e.message
          : "上传失败",
    );
  } finally {
    uploading.value = false;
  }
}

function addWork() {
  form.workExperiences.push({ company: "", startDate: "", endDate: "", description: "" });
}

function removeWork(i: number) {
  form.workExperiences.splice(i, 1);
}

function addSlot() {
  form.slots.push([]);
}

function removeSlot(i: number) {
  form.slots.splice(i, 1);
}

async function submit() {
  if (!form.name.trim()) {
    ElMessage.warning("姓名不能为空");
    return;
  }
  if (form.path.length < 3) {
    ElMessage.warning("请选择所属店铺");
    return;
  }
  const keptSlots = form.slots.filter((s) => Array.isArray(s) && s[0] && s[1]);
  saving.value = true;
  try {
    const payload = {
      name: form.name.trim(),
      gender: form.gender,
      age: form.age ?? null,
      phone: form.phone.trim(),
      photo: form.photo,
      remark: form.remark.trim(),
      storeId: form.path[2],
      workExperiences: form.workExperiences
        .filter((w) => w.company.trim())
        .map((w) => ({
          company: w.company.trim(),
          startDate: w.startDate,
          endDate: w.endDate,
          description: w.description.trim(),
        })),
      interviewSlots: keptSlots.map(([a, b]) => ({
        startAt: new Date(a).toISOString(),
        endAt: new Date(b).toISOString(),
      })),
    };
    await api(props.candidate ? `/api/candidates/${props.candidate.id}` : "/api/candidates", {
      method: props.candidate ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    ElMessage.success("已保存");
    visible.value = false;
    emit("saved");
  } catch (e) {
    ElMessage.error(
      e instanceof TypeError
        ? "网络连接失败（Failed to fetch），请刷新页面后重试"
        : e instanceof Error
          ? e.message
          : "保存失败",
    );
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="readonly ? `人员详情：${candidate?.name ?? ''}` : candidate ? `编辑人员：${candidate.name}` : '新增人员'"
    width="680px"
    top="5vh"
    destroy-on-close
  >
    <el-form label-width="90px" label-position="left" :disabled="readonly">
      <el-form-item label="照片">
        <div class="photo-row">
          <el-avatar v-if="form.photo" :size="64" :src="withBase(form.photo)" />
          <template v-if="!readonly">
            <el-upload
              :show-file-list="false"
              accept="image/jpeg,image/png,image/gif,image/webp"
              :http-request="uploadPhoto"
            >
              <el-button :loading="uploading">
                {{ form.photo ? "更换照片" : "上传照片" }}
              </el-button>
            </el-upload>
            <el-button v-if="form.photo" link type="danger" @click="form.photo = ''">
              移除照片
            </el-button>
          </template>
        </div>
      </el-form-item>

      <el-row :gutter="12">
        <el-col :span="12">
          <el-form-item label="姓名" required>
            <el-input v-model="form.name" placeholder="请输入姓名" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="电话">
            <el-input v-model="form.phone" placeholder="联系电话" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="性别">
            <el-select v-model="form.gender" style="width: 100%">
              <el-option label="男" value="MALE" />
              <el-option label="女" value="FEMALE" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="年龄">
            <el-input-number v-model="form.age" :min="1" :max="150" style="width: 100%" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="所属店铺" required>
        <el-cascader
          v-model="form.path"
          :options="cascaderOptions"
          :props="formCascaderProps"
          placeholder="品牌 / 城市 / 店铺"
          style="width: 100%"
        />
      </el-form-item>

      <el-form-item label="工作经历">
        <div class="list">
          <div v-for="(w, i) in form.workExperiences" :key="i" class="work-item">
            <div class="work-row">
              <el-input v-model="w.company" placeholder="公司名称" class="company-input" />
              <el-button v-if="!readonly" link type="danger" @click="removeWork(i)">删除</el-button>
            </div>
            <div class="work-row">
              <el-date-picker
                v-model="w.startDate"
                type="month"
                value-format="YYYY-MM"
                placeholder="开始月份"
                class="month-picker"
              />
              <span class="sep">至</span>
              <el-date-picker
                v-model="w.endDate"
                type="month"
                value-format="YYYY-MM"
                placeholder="结束（留空至今）"
                class="month-picker"
              />
            </div>
            <el-input
              v-model="w.description"
              type="textarea"
              :rows="2"
              placeholder="工作内容"
              class="work-desc"
            />
          </div>
          <el-button v-if="!readonly" link type="primary" @click="addWork">+ 添加工作经历</el-button>
        </div>
      </el-form-item>

      <el-form-item label="可面试时间">
        <div class="list">
          <div v-for="(_s, i) in form.slots" :key="i" class="slot-row">
            <el-date-picker
              v-model="form.slots[i]"
              type="datetimerange"
              format="YYYY-MM-DD HH:mm"
              value-format="YYYY-MM-DD HH:mm"
              range-separator="至"
              start-placeholder="开始时间"
              end-placeholder="结束时间"
              class="range-picker"
            />
            <el-button v-if="!readonly" link type="danger" @click="removeSlot(i)">删除</el-button>
          </div>
          <el-button v-if="!readonly" link type="primary" @click="addSlot">+ 添加时间段</el-button>
        </div>
      </el-form-item>

      <el-form-item label="备注">
        <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="其他补充信息" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">{{ readonly ? "关闭" : "取消" }}</el-button>
      <el-button v-if="!readonly" type="primary" :loading="saving" :disabled="uploading" @click="submit">
        保存
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.photo-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.list {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.work-item {
  width: 100%;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 10px;
}
.work-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
}
.work-row + .work-row {
  margin-top: 8px;
}
.company-input {
  flex: 1;
  min-width: 0;
}
.month-picker {
  width: 160px;
  flex: none;
}
.sep {
  color: #909399;
  font-size: 12px;
}
.work-desc {
  margin-top: 8px;
}
.slot-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
}
.range-picker {
  flex: 1;
  max-width: 420px;
}
</style>
