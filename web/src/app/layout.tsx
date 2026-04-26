import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "notMagic Hour",
  description:
    "Match photos to classical paintings with CLIP, color, and composition — same flow as the current2classic notebook.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full font-sans antialiased">
      <body className="min-h-dvh min-h-full flex flex-col overflow-hidden bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
