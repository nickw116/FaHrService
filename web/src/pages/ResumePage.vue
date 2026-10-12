<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { ElMessage } from "element-plus";
import { api, withBase } from "../api";
import { STATUS_LABEL } from "../status";
import type { CandidateRow } from "../types";

type ResumeData = Omit<CandidateRow, "remark" | "updatedAt"> & {
  store: { name: string; city: { name: string; brand: { name: string } } };
};

const route = useRoute();
const token = String(route.params.token ?? "");

const loading = ref(true);
const notFound = ref(false);
const candidate = ref<ResumeData | null>(null);
const chosenSlotId = ref<number | null>(null);
const submitting = ref(false);

const status = computed(() => candidate.value?.status ?? "");
const acceptedSlot = computed(
  () => candidate.value?.interviewSlots.find((s) => s.id === candidate.value?.acceptedSlotId) ?? null,
);

const stepActive = computed(() => {
  switch (status.value) {
    case "PENDING":
    case "DECLINED":
      return 0;
    case "ACCEPTED":
      return 1;
    case "PASSED":
    case "FAILED":
      return 2;
    default:
      return 3;
  }
});

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function fmtSlot(s: { startAt: string; endAt: string }) {
  return `${fmtDateTime(s.startAt)} ~ ${fmtDateTime(s.endAt).slice(11)}`;
}

async function load() {
  loading.value = true;
  try {
    const d = await api<{ candidate: ResumeData }>(`/api/resume/${token}`);
    candidate.value = d.candidate;
  } catch (e) {
    if (e instanceof Error && e.message.includes("链接无效")) {
      notFound.value = true;
    } else {
      ElMessage.error(e instanceof Error ? e.message : "加载失败");
    }
  } finally {
    loading.value = false;
  }
}

async function respondInterview(accept: boolean) {
  if (accept && !chosenSlotId.value) {
    ElMessage.warning("请先选择一个面试时间");
    return;
  }
  submitting.value = true;
  try {
    await api(`/api/resume/${token}/interview-response`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accept, slotId: accept ? chosenSlotId.value : undefined }),
    });
    ElMessage.success(accept ? "已接受约面，请按时参加" : "已拒绝本次约面");
    await load();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "操作失败");
  } finally {
    submitting.value = false;
  }
}

async function respondOnboard(accept: boolean) {
  submitting.value = true;
  try {
    await api(`/api/resume/${token}/onboard-response`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accept }),
    });
    ElMessage.success(accept ? "已确认入职，欢迎加入！" : "已放弃入职");
    await load();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "操作失败");
  } finally {
    submitting.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="resume-wrap">
    <div v-if="loading" v-loading="true" class="loading-box" />
    <el-result v-else-if="notFound" icon="error" title="链接无效" sub-title="该简历链接不存在或已过期，请联系 HR" />
    <div v-else-if="candidate" class="resume-card">
      <div class="head">
        <el-avatar :size="64" :src="candidate.photo ? withBase(candidate.photo) : undefined">
          {{ candidate.name.slice(0, 1) }}
        </el-avatar>
        <div class="head-info">
          <h1 class="name">{{ candidate.name }}</h1>
          <p class="meta">
            {{ candidate.gender === "MALE" ? "男" : "女" }}
            <template v-if="candidate.age !== null"> · {{ candidate.age }} 岁</template>
            <template v-if="candidate.phone"> · {{ candidate.phone }}</template>
          </p>
          <p class="meta store">
            应聘门店：{{ candidate.store.city.brand.name }} / {{ candidate.store.city.name }} /
            {{ candidate.store.name }}
          </p>
        </div>
        <el-tag class="status-tag" :type="status === 'PASSED' || status === 'ONBOARDED' ? 'success' : 'info'">
          {{ STATUS_LABEL[status] ?? status }}
        </el-tag>
      </div>

      <el-steps :active="stepActive" align-center finish-status="success" class="steps">
        <el-step title="确认约面" />
        <el-step title="参加面试" />
        <el-step title="面试结果" />
        <el-step title="入职确认" />
      </el-steps>

      <div v-if="candidate.workExperiences.length" class="section">
        <h2 class="section-title">工作经历</h2>
        <div v-for="w in candidate.workExperiences" :key="w.id" class="work-item">
          <div class="work-head">
            <span class="company">{{ w.company }}</span>
            <span class="period">{{ w.startDate || "—" }} ~ {{ w.endDate || "至今" }}</span>
          </div>
          <p v-if="w.description" class="desc">{{ w.description }}</p>
        </div>
      </div>

      <div class="section">
        <h2 class="section-title">面试安排</h2>

        <template v-if="status === 'PENDING'">
          <template v-if="candidate.interviewSlots.length">
            <p class="hint">请选择一个方便的面试时间：</p>
            <el-radio-group v-model="chosenSlotId" class="slot-list">
              <el-radio v-for="s in candidate.interviewSlots" :key="s.id" :value="s.id" class="slot-radio">
                {{ fmtSlot(s) }}
              </el-radio>
            </el-radio-group>
            <div class="actions">
              <el-button type="primary" :loading="submitting" @click="respondInterview(true)">
                同意约面
              </el-button>
              <el-button type="danger" plain :loading="submitting" @click="respondInterview(false)">
                拒绝约面
              </el-button>
            </div>
          </template>
          <el-empty v-else description="暂无面试时间安排，请等待 HR 联系" :image-size="80" />
        </template>

        <el-alert v-else-if="status === 'ACCEPTED'" type="success" :closable="false" show-icon
          title="已接受约面"
          :description="`面试时间：${acceptedSlot ? fmtSlot(acceptedSlot) : '—'}，请按时参加，面试结果将在此页更新`" />

        <el-alert v-else-if="status === 'DECLINED'" type="warning" :closable="false" show-icon
          title="已拒绝本次约面" description="如需重新安排，请联系 HR" />

        <template v-else-if="status === 'PASSED'">
          <el-alert type="success" :closable="false" show-icon title="恭喜，面试已通过！"
            description="请确认是否入职" />
          <div class="actions">
            <el-button type="primary" :loading="submitting" @click="respondOnboard(true)">确认入职</el-button>
            <el-button type="danger" plain :loading="submitting" @click="respondOnboard(false)">放弃入职</el-button>
          </div>
        </template>

        <el-alert v-else-if="status === 'FAILED'" type="error" :closable="false" show-icon
          title="很遗憾，本次面试未通过" description="感谢你的参与，期待下次机会" />

        <el-alert v-else-if="status === 'ONBOARDED'" type="success" :closable="false" show-icon
          title="已确认入职，欢迎加入！" />

        <el-alert v-else-if="status === 'ONBOARD_DECLINED'" type="warning" :closable="false" show-icon
          title="已放弃入职" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.resume-wrap {
  min-height: 100vh;
  padding: 24px 12px;
  background: #f5f7fa;
}

.loading-box {
  height: 240px;
}

.resume-card {
  max-width: 640px;
  margin: 0 auto;
  background: #fff;
  border-radius: 8px;
  padding: 24px 20px 32px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.head {
  display: flex;
  align-items: center;
  gap: 16px;
}

.head-info {
  flex: 1;
  min-width: 0;
}

.name {
  margin: 0;
  font-size: 22px;
}

.meta {
  margin: 4px 0 0;
  color: #606266;
  font-size: 14px;
}

.meta.store {
  color: #909399;
  font-size: 13px;
}

.status-tag {
  flex-shrink: 0;
}

.steps {
  margin: 24px 0 8px;
}

.section {
  margin-top: 24px;
}

.section-title {
  margin: 0 0 12px;
  font-size: 16px;
  border-left: 3px solid #409eff;
  padding-left: 8px;
}

.work-item {
  padding: 10px 0;
  border-bottom: 1px dashed #e4e7ed;
}

.work-item:last-child {
  border-bottom: none;
}

.work-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.company {
  font-weight: 600;
}

.period {
  color: #909399;
  font-size: 13px;
}

.desc {
  margin: 6px 0 0;
  color: #606266;
  font-size: 14px;
  white-space: pre-wrap;
}

.hint {
  margin: 0 0 10px;
  color: #606266;
}

.slot-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}

.slot-radio {
  margin-right: 0;
  height: auto;
}

.actions {
  margin-top: 18px;
  display: flex;
  gap: 12px;
}
</style>
