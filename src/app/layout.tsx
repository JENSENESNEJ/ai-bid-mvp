import type { Metadata } from "next"; import "./globals.css";
export const metadata:Metadata={title:"标智 · AI标书工作台",description:"招标文件智能审查工作台"};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>}