import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KAWLA | Living Manuscript",
  description: "A demonstration of a thoughtful, conversational encounter with a manuscript.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
