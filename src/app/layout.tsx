import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AFT Planner",
  description: "Personalized US Army Fitness Test training plans.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  );
}
