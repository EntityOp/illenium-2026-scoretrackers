import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'ILLENIUM 2026 — Footvolley Live',description:'Live Footvolley scores, fixtures and results for ILLENIUM 2026, 29 November.',icons:{icon:'/favicon.svg'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
