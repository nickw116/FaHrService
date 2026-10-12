import { createRouter, createWebHistory } from "vue-router";
import { getToken, getUser, isResumeOnlyRole, RESUME_URL } from "./auth";
import LoginPage from "./pages/LoginPage.vue";
import ResumePage from "./pages/ResumePage.vue";
import MainLayout from "./components/MainLayout.vue";
import CandidateManager from "./components/CandidateManager.vue";
import OrgManager from "./components/OrgManager.vue";
import UserManager from "./pages/UserManager.vue";

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: "/login", component: LoginPage, meta: { public: true, title: "登录" } },
    { path: "/r/:token", component: ResumePage, meta: { public: true, title: "电子简历" } },
    {
      path: "/",
      component: MainLayout,
      children: [
        { path: "", redirect: "/personnel" },
        { path: "personnel", component: CandidateManager, meta: { title: "人员管理" } },
        { path: "org", component: OrgManager, meta: { title: "品牌管理" } },
        { path: "users", component: UserManager, meta: { title: "用户管理", admin: true } },
      ],
    },
    { path: "/:pathMatch(.*)*", redirect: "/personnel" },
  ],
});

router.beforeEach((to) => {
  const token = getToken();
  if (to.meta.public) {
    if (to.path === "/login" && token && isResumeOnlyRole(getUser()?.role)) {
      window.location.assign(RESUME_URL);
      return false;
    }
    return to.path === "/login" && token ? "/" : true;
  }
  if (!token) {
    return { path: "/login", query: to.fullPath !== "/" ? { redirect: to.fullPath } : {} };
  }
  if (isResumeOnlyRole(getUser()?.role)) {
    window.location.assign(RESUME_URL);
    return false;
  }
  if (to.meta.admin && getUser()?.role !== "admin") {
    return "/personnel";
  }
  return true;
});
