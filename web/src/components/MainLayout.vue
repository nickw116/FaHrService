<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { ArrowDown, OfficeBuilding, User, UserFilled } from "@element-plus/icons-vue";
import ChangePasswordDialog from "./ChangePasswordDialog.vue";
import { api } from "../api";
import { clearAuth, getUser } from "../auth";
import { ROLE_LABEL, ROLE_TAG } from "../types";

const route = useRoute();
const router = useRouter();
const user = getUser();
const pwdDialogVisible = ref(false);

const activeMenu = computed(() => route.path);
const pageTitle = computed(() => String(route.meta.title ?? ""));

async function onCommand(command: string) {
  if (command === "password") {
    pwdDialogVisible.value = true;
  } else if (command === "logout") {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      // 忽略登出接口错误，本地照常清理
    }
    clearAuth();
    ElMessage.success("已退出登录");
    router.push("/login");
  }
}
</script>

<template>
  <el-container class="layout">
    <el-aside width="220px" class="aside">
      <div class="logo">FaHRService</div>
      <el-menu
        :default-active="activeMenu"
        router
        class="menu"
        background-color="#0f172a"
        text-color="#94a3b8"
        active-text-color="#ffffff"
      >
        <el-menu-item index="/personnel">
          <el-icon><User /></el-icon>
          <span>人员管理</span>
        </el-menu-item>
        <el-menu-item index="/org">
          <el-icon><OfficeBuilding /></el-icon>
          <span>品牌管理</span>
        </el-menu-item>
        <el-menu-item v-if="user?.role === 'admin'" index="/users">
          <el-icon><UserFilled /></el-icon>
          <span>用户管理</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <span class="page-title">{{ pageTitle }}</span>
        <el-dropdown trigger="click" @command="onCommand">
          <span class="user-entry">
            {{ user?.username }}
            <el-tag v-if="user" size="small" :type="ROLE_TAG[user.role]">{{ ROLE_LABEL[user.role] }}</el-tag>
            <el-icon><ArrowDown /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="password">修改密码</el-dropdown-item>
              <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </el-header>
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
    <ChangePasswordDialog v-model="pwdDialogVisible" />
  </el-container>
</template>

<style scoped>
.layout {
  min-height: 100vh;
}

.aside {
  background-color: #0f172a;
}

.logo {
  display: flex;
  align-items: center;
  height: 60px;
  padding: 0 20px;
  color: #ffffff;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.menu {
  border-right: none;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #ffffff;
  border-bottom: 1px solid #e4e7ed;
}

.page-title {
  font-size: 16px;
  font-weight: 600;
}

.user-entry {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  color: #303133;
  outline: none;
}

.main {
  background: #f5f7fa;
  padding: 16px;
}
</style>
