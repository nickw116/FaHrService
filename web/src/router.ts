import { createRouter, createWebHistory } from "vue-router";
import CandidateManager from "./components/CandidateManager.vue";
import OrgManager from "./components/OrgManager.vue";

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: "/", redirect: "/personnel" },
    { path: "/personnel", component: CandidateManager, meta: { title: "人员管理" } },
    { path: "/org", component: OrgManager, meta: { title: "品牌管理" } },
  ],
});
