<template>
  <router-view />
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

/* 主框架页面由内容区自行滚动，避免弹层展开时 body 出现滚动条 */
body.app-shell {
  overflow: hidden;
}
</style>
