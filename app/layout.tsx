import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: "I've Seen Things",
  description: "Every wallet holds one coin that's seen things. We find it and it tells you everything.",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Libre+Baskerville:ital,wght@0,400;1,400;1,700&display=swap" rel="stylesheet" />
      </head>
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
