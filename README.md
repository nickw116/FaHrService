# FaHrService 人员管理系统

基于「品牌 → 城市 → 店铺」三级架构的 HR 人员信息录入与管理系统。

## 功能

- **三级组织架构**：品牌（Brand）→ 城市（City）→ 店铺（Store），人员归属到店铺
- **人员录入**：照片上传、姓名、性别、年龄、电话、所属店铺、备注
- **工作经历**：支持多条，每条包含公司名称、起止时间（结束留空为至今）、工作内容
- **可面试时间**：支持多个时间区间（开始 ~ 结束）
- **列表查询**：姓名搜索（搜索按钮 / 回车触发）、品牌/城市/店铺级联筛选、分页（10/20/50 条每页）
- **编辑与删除**：列表每行「编辑」按钮打开回填好的编辑弹窗

## 技术栈

- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS v4
- Prisma ORM + SQLite

## 快速开始

```bash
# 安装依赖
npm install

# 初始化数据库（在项目根目录生成 prisma/dev.db）
npm run db:push

# 导入示例数据（品牌/城市/店铺 + 25 条人员数据）
npm run db:seed

# 启动开发服务器
npm run dev
```

访问 http://localhost:3000 即可打开管理界面。

## 数据模型

| 模型 | 说明 |
| --- | --- |
| `Brand` | 品牌，包含多个城市 |
| `City` | 城市，归属一个品牌，包含多个店铺 |
| `Store` | 店铺，归属一个城市 |
| `Candidate` | 人员：照片、姓名、性别、年龄、电话、备注，归属一个店铺 |
| `WorkExperience` | 工作经历（多条）：公司名称、起止时间、工作内容 |
| `InterviewSlot` | 可面试时间（多个）：开始时间、结束时间 |

人员状态不在本系统维护，由后续流程系统驱动更新。

上传的照片保存在项目根目录 `uploads/`（已加入 .gitignore），通过 `/api/uploads/<文件名>` 访问。

## API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/org` | 获取品牌-城市-店铺组织树 |
| GET | `/api/candidates?keyword=&brandId=&cityId=&storeId=&page=&pageSize=` | 人员列表（搜索、级联筛选、分页，返回 total） |
| POST | `/api/candidates` | 新增人员（含工作经历与可面试时间数组） |
| PUT | `/api/candidates/:id` | 编辑人员（子表整体替换） |
| DELETE | `/api/candidates/:id` | 删除人员 |
| POST | `/api/upload` | 上传照片（multipart，字段名 `file`，返回 `{ url }`） |
| GET | `/api/uploads/:name` | 读取已上传的照片 |
