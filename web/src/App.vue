<script setup lang="ts">
import { OfficeBuilding, User } from "@element-plus/icons-vue";
</script>

<template>
  <el-container class="layout">
    <el-aside width="220px" class="aside">
      <div class="logo">FaHrService</div>
      <el-menu
        :default-active="$route.path"
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
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <span class="page-title">{{ $route.meta.title }}</span>
      </el-header>
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<style>
*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  background-color: #f5f7fa;
  font-family:
    "Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei",
    "微软雅黑", Arial, sans-serif;
}

.el-dialog {
  max-width: 94vw;
}

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
  background: #ffffff;
  border-bottom: 1px solid #e4e7ed;
}

.page-title {
  font-size: 16px;
  font-weight: 600;
}

.main {
  background: #f5f7fa;
  padding: 16px;
}
</style>
