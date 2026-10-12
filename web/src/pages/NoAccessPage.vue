<script setup lang="ts">
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { api } from "../api";
import { clearAuth, getUser, RESUME_URL } from "../auth";
import { ROLE_LABEL } from "../types";

const router = useRouter();
const user = getUser();

async function logout() {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } catch {
    // 忽略登出接口错误，本地照常清理
  }
  clearAuth();
  ElMessage.success("已退出登录");
  router.push("/login");
}
</script>

<template>
  <div class="wrap">
    <el-result icon="warning" title="没有访问权限">
      <template #sub-title>
        当前账号 {{ user?.username }}（{{ user ? (ROLE_LABEL[user.role] ?? user.role) : "" }}）仅可使用电子简历系统
      </template>
      <template #extra>
        <el-button type="primary" @click="logout">退出登录，切换账号</el-button>
        <el-link :href="RESUME_URL" target="_blank" style="margin-left: 16px">
          前往电子简历系统
        </el-link>
      </template>
    </el-result>
  </div>
</template>

<style scoped>
.wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
