import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'ILLENIUM™ — Spin & Swing Live',description:'Live cricket scores, fixtures and results for Spin & Swing, 28 November 2026.',icons:{icon:'/favicon.svg'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
