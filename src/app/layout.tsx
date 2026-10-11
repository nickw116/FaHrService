import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FaHrService 人员管理系统",
  description: "品牌-城市-店铺三级架构的 HR 人员录入管理系统",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
