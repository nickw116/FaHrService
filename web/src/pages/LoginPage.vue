<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { api } from "../api";
import { isResumeOnlyRole, setAuth, RESUME_URL } from "../auth";
import type { UserInfo } from "../types";

const router = useRouter();
const route = useRoute();

const form = reactive({ username: "", password: "" });
const loading = ref(false);

async function submit() {
  if (!form.username.trim() || !form.password) {
    ElMessage.warning("请输入用户名和密码");
    return;
  }
  loading.value = true;
  try {
    const d = await api<{ token: string; user: UserInfo }>("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: form.username.trim(), password: form.password }),
    });
    setAuth(d.token, d.user);
    ElMessage.success(`欢迎，${d.user.username}`);
    if (isResumeOnlyRole(d.user.role)) {
      window.location.assign(RESUME_URL);
      return;
    }
    const redirect = typeof route.query.redirect === "string" ? route.query.redirect : "/";
    router.push(redirect);
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "登录失败");
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-wrap">
    <el-card class="login-card">
      <h2 class="title">FaHrService 管理系统</h2>
      <el-form :model="form" label-position="top" @submit.prevent="submit">
        <el-form-item label="用户名">
          <el-input v-model="form.username" autocomplete="username" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input
            v-model="form.password"
            type="password"
            autocomplete="current-password"
            placeholder="请输入密码"
            show-password
            @keyup.enter="submit"
          />
        </el-form-item>
        <el-button class="submit" type="primary" :loading="loading" @click="submit">
          登 录
        </el-button>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.login-wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-card {
  width: 380px;
  max-width: 92vw;
}

.title {
  margin: 0 0 20px;
  text-align: center;
  font-size: 20px;
}

.submit {
  width: 100%;
}
</style>
