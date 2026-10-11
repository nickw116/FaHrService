import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const org = [
    {
      brand: "美味轩",
      cities: [
        { city: "上海", stores: ["南京东路店", "徐家汇店"] },
        { city: "北京", stores: ["三里屯店", "中关村店"] },
      ],
    },
    {
      brand: "香满楼",
      cities: [
        { city: "广州", stores: ["天河店", "越秀店"] },
        { city: "深圳", stores: ["南山店"] },
      ],
    },
  ];

  const storeIds: Record<string, number> = {};

  for (const b of org) {
    const brand = await prisma.brand.upsert({
      where: { name: b.brand },
      update: {},
      create: { name: b.brand },
    });
    for (const c of b.cities) {
      const city = await prisma.city.upsert({
        where: { brandId_name: { brandId: brand.id, name: c.city } },
        update: {},
        create: { name: c.city, brandId: brand.id },
      });
      for (const s of c.stores) {
        const store = await prisma.store.upsert({
          where: { cityId_name: { cityId: city.id, name: s } },
          update: {},
          create: { name: s, cityId: city.id },
        });
        storeIds[`${b.brand}/${c.city}/${s}`] = store.id;
      }
    }
  }

  const candidates = [
    { name: "张伟", phone: "13800001111", status: "PENDING_CONFIRMATION", store: "美味轩/上海/南京东路店", remark: "朋友介绍" },
    { name: "王芳", phone: "13800002222", status: "PENDING_INTERVIEW", store: "美味轩/上海/徐家汇店", remark: "约了下周面试" },
    { name: "李娜", phone: "13800003333", status: "PASSED", store: "美味轩/北京/三里屯店", remark: "" },
    { name: "刘强", phone: "13800004444", status: "FAILED_SCREENING", store: "美味轩/北京/中关村店", remark: "经验不足" },
    { name: "陈静", phone: "13800005555", status: "ONBOARDED", store: "香满楼/广州/天河店", remark: "已签合同" },
    { name: "杨阳", phone: "13800006666", status: "FAILED_INTERVIEW", store: "香满楼/广州/越秀店", remark: "面试迟到两次" },
    { name: "赵磊", phone: "13800007777", status: "PENDING_INTERVIEW", store: "香满楼/深圳/南山店", remark: "" },
    { name: "孙丽", phone: "13800008888", status: "ONBOARDED", store: "美味轩/上海/南京东路店", remark: "前厅主管推荐" },
    { name: "周杰", phone: "13800009999", status: "PENDING_CONFIRMATION", store: "香满楼/深圳/南山店", remark: "" },
    { name: "吴敏", phone: "13800010000", status: "PASSED", store: "美味轩/北京/三里屯店", remark: "复试通过" },
  ];

  for (const c of candidates) {
    const storeId = storeIds[c.store];
    const exists = await prisma.candidate.findFirst({
      where: { name: c.name, storeId },
    });
    if (!exists) {
      await prisma.candidate.create({
        data: { name: c.name, phone: c.phone, status: c.status, remark: c.remark, storeId },
      });
    }
  }

  console.log("Seed completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
