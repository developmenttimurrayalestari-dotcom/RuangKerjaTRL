import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'RuangKerja — HR & Purchasing',
  description: 'Satu ruang untuk karyawan, pengajuan cuti, persetujuan, dan pembelian. Kalender Indonesia terintegrasi.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/icon-192.png' },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'RuangKerja' },
};
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return <html lang="id"><head><meta name="theme-color" content="#174b3b" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body>{children}</body></html>;
}
