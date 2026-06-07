import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegister } from "./sw-register";

export const metadata: Metadata = {
  title: "AFT Planner",
  description: "Personalized US Army Fitness Test training plans with offline calendar access.",
  manifest: "/manifest.webmanifest",
  applicationName: "AFT Planner",
  appleWebApp: {
    capable: true,
    title: "AFT",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#3f6d3f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
