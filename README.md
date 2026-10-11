# FaHrService 人员管理系统

基于「品牌 → 城市 → 店铺」三级架构的 HR 人员信息录入与管理系统。

## 功能

- **三级组织架构**：品牌（Brand）→ 城市（City）→ 店铺（Store），人员归属到店铺
- **人员管理**：新增、编辑、删除人员信息（姓名、电话、所属店铺、状态、备注）
- **姓名搜索**：支持按人员姓名模糊搜索
- **状态流转**：待确认 / 待面试 / 未通过初筛 / 已通过 / 未通过面试 / 已入职
- **级联筛选**：列表页支持按品牌、城市、店铺逐级筛选

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

# 导入示例数据（品牌/城市/店铺 + 10 条人员数据）
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
| `Candidate` | 人员，归属一个店铺，带状态字段 |

人员状态枚举（存储于 `Candidate.status`）：

| 值 | 中文 |
| --- | --- |
| `PENDING_CONFIRMATION` | 待确认 |
| `PENDING_INTERVIEW` | 待面试 |
| `FAILED_SCREENING` | 未通过初筛 |
| `PASSED` | 已通过 |
| `FAILED_INTERVIEW` | 未通过面试 |
| `ONBOARDED` | 已入职 |

## API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/org` | 获取品牌-城市-店铺组织树 |
| GET | `/api/candidates?keyword=&status=&brandId=&cityId=&storeId=` | 人员列表（支持搜索与筛选） |
| POST | `/api/candidates` | 新增人员 |
| PUT | `/api/candidates/:id` | 编辑人员 |
| DELETE | `/api/candidates/:id` | 删除人员 |
