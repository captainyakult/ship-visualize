import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ship Visualizer — Live Maritime Tracking',
  description: 'Real-time interactive map showing ships and vessels near your location using AIS data.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-gray-950 text-white antialiased">{children}</body>
    </html>
  );
}
