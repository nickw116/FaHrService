# FaHRService 人员管理系统

基于「品牌 → 城市 → 店铺」三级架构的 HR 人员信息录入与管理系统。

## 功能

- **登录认证**：账号密码登录（scrypt 哈希），会话 token 有效期 7 天，未登录访问 API 一律 401
- **用户管理**：管理员可新建用户、改角色、重置密码、删除用户（不能删自己和最后一个管理员）；所有用户可自行修改密码
- **角色权限**：`admin`（管理员，可进用户管理）/ `user`（普通用户，仅 HR 功能）
- **电子简历**：人员列表每行「简历」按钮生成公开链接（`/r/<token>`），候选人无需登录即可打开，查看个人详情、选择面试时间并同意/拒绝约面、查看面试结果、确认是否入职；HR 在弹窗内标记面试通过/未通过、重置流程
- **品牌管理**：侧边栏独立页面，树形维护品牌/城市/店铺（增删改）
- **三级组织架构**：品牌（Brand）→ 城市（City）→ 店铺（Store），人员归属到店铺
- **人员录入**：照片上传、姓名、性别、年龄、电话、所属店铺、备注
- **工作经历**：支持多条，每条包含公司名称、起止时间（结束留空为至今）、工作内容
- **可面试时间**：支持多个时间区间（开始 ~ 结束）
- **列表查询**：姓名搜索、品牌/城市/店铺级联筛选（可只选到品牌或城市）、分页（10/20/50 条每页）
- **编辑与删除**：列表每行「编辑」按钮打开回填好的编辑弹窗，删除有确认提示

## 默认账号

首次启动时若数据库无任何用户，自动创建 `admin / admin123`（控制台会有警告提示），**部署后请立即登录修改密码**。

前端路由：`/login`（登录页）、`/personnel`（人员管理）、`/org`（品牌管理）、`/users`（用户管理，仅管理员）。

## 技术栈

- 前端：Vue 3 + Vite + Element Plus（`web/`）
- 后端：Express + Prisma ORM + SQLite（`server/`，npm workspaces 管理）

## 快速开始

```bash
# 安装依赖（根目录一次安装，含 web 工作区）
npm install

# 初始化数据库（在项目根目录生成 prisma/dev.db）
npm run db:push

# 导入示例数据（品牌/城市/店铺 + 25 条人员数据）
npm run db:seed
```

开发模式（前后端同时启动，前端 3000 端口，API 3001 端口，自动代理）：

```bash
npm run dev
# 打开 http://localhost:3000
```

生产模式（构建前端后由 Express 托管，单端口 3000）：

```bash
npm run build
npm start
# 打开 http://localhost:3000
```

## 目录结构

```
├── prisma/            # Prisma schema、种子数据、SQLite 数据库文件
├── server/            # Express API 服务（tsx 运行 TypeScript）
├── web/               # Vue 3 + Element Plus 前端
└── uploads/           # 上传的照片（已加入 .gitignore）
```

## 数据模型

| 模型 | 说明 |
| --- | --- |
| `Brand` | 品牌，包含多个城市 |
| `City` | 城市，归属一个品牌，包含多个店铺 |
| `Store` | 店铺，归属一个城市 |
| `Candidate` | 人员：照片、姓名、性别、年龄、电话、备注，归属一个店铺 |
| `WorkExperience` | 工作经历（多条）：公司名称、起止时间、工作内容 |
| `InterviewSlot` | 可面试时间（多个）：开始时间、结束时间 |
| `User` | 登录用户：用户名（唯一）、scrypt 密码哈希、角色（admin/user） |
| `Session` | 登录会话：token、归属用户、过期时间（7 天） |

人员状态不在本系统维护，由后续流程系统驱动更新。

## API

除 `/api/auth/login` 和 `/api/uploads/*`（照片，文件名 UUID 不可枚举）外，所有接口都需要请求头 `Authorization: Bearer <token>`。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/auth/login` | 登录，返回 `{ token, user }` |
| GET | `/api/auth/me` | 当前登录用户信息 |
| POST | `/api/auth/logout` | 退出登录（删除当前会话） |
| POST | `/api/auth/change-password` | 修改自己的密码（原密码 + 新密码） |
| GET | `/api/users` | 用户列表（仅管理员） |
| POST | `/api/users` | 新建用户（仅管理员） |
| PUT | `/api/users/:id` | 改角色 / 重置密码（仅管理员） |
| DELETE | `/api/users/:id` | 删除用户（仅管理员；不能删自己和最后一个管理员） |

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/org` | 获取品牌-城市-店铺组织树 |
| POST | `/api/org/:level` | 新建组织节点（level 为 brands/cities/stores） |
| PUT | `/api/org/:level/:id` | 重命名组织节点 |
| DELETE | `/api/org/:level/:id` | 删除组织节点（有子节点时拒绝） |
| GET | `/api/candidates?keyword=&brandId=&cityId=&storeId=&page=&pageSize=` | 人员列表（搜索、级联筛选、分页，返回 total） |
| POST | `/api/candidates` | 新增人员（含工作经历与可面试时间数组） |
| PUT | `/api/candidates/:id` | 编辑人员（子表整体替换） |
| DELETE | `/api/candidates/:id` | 删除人员 |
| POST | `/api/candidates/:id/resume-link` | 获取/生成电子简历公开链接 |
| POST | `/api/candidates/:id/interview-result` | 标记面试结果（`action`: pass/fail/reset） |
| GET | `/api/resume/:token` | 电子简历公开信息（无需登录，不含内部备注） |
| POST | `/api/resume/:token/interview-response` | 候选人同意/拒绝约面（无需登录） |
| POST | `/api/resume/:token/onboard-response` | 候选人确认/放弃入职（无需登录） |
| POST | `/api/upload` | 上传照片（multipart，字段名 `file`，返回 `{ url }`） |
| GET | `/api/uploads/:name` | 读取已上传的照片 |
