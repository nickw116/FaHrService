<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { api } from "../api";
import { clearAuth } from "../auth";

const visible = defineModel<boolean>({ required: true });

const router = useRouter();
const form = reactive({ oldPassword: "", newPassword: "", confirm: "" });
const saving = ref(false);

async function submit() {
  if (!form.oldPassword || form.newPassword.length < 6) {
    ElMessage.warning("请填写原密码，新密码至少 6 位");
    return;
  }
  if (form.newPassword !== form.confirm) {
    ElMessage.warning("两次输入的新密码不一致");
    return;
  }
  saving.value = true;
  try {
    await api("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldPassword: form.oldPassword, newPassword: form.newPassword }),
    });
    visible.value = false;
    clearAuth();
    ElMessage.success("密码已修改，请重新登录");
    router.push("/login");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "修改失败");
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <el-dialog v-model="visible" title="修改密码" width="420px">
    <el-form label-width="80px">
      <el-form-item label="原密码" required>
        <el-input v-model="form.oldPassword" type="password" autocomplete="current-password" show-password />
      </el-form-item>
      <el-form-item label="新密码" required>
        <el-input v-model="form.newPassword" type="password" autocomplete="new-password" show-password />
      </el-form-item>
      <el-form-item label="确认新密码" required>
        <el-input v-model="form.confirm" type="password" autocomplete="new-password" show-password />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">确认修改</el-button>
    </template>
  </el-dialog>
</template>
