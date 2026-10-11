<script setup lang="ts">
import CandidateManager from "./components/CandidateManager.vue";
</script>

<template>
  <CandidateManager />
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
</style>
