import type { Metadata, Viewport } from "next";
import "./globals.css";
import { readFlash } from "@/lib/flash";
import { FlashToast } from "./flash-toast";
import { ServiceWorkerRegister } from "./sw-register";

export const metadata: Metadata = {
  title: "AFT Planner",
  description: "Personalized US Army Fitness Test training plans with offline calendar access.",
  manifest: "/manifest.webmanifest",
  applicationName: "AFT Planner",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: "/icon.svg",
  },
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

// Pre-paint theme application to avoid FOUC. Runs before React hydrates.
const THEME_INIT_SCRIPT = `
(function(){try{
  var s=localStorage.getItem("aft-theme");
  if(s==="dark"||s==="light"){document.documentElement.classList.add(s);}
}catch(e){}})();
`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const flash = await readFlash();
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen">
        {children}
        <ServiceWorkerRegister />
        {flash && <FlashToast type={flash.type} message={flash.message} />}
      </body>
    </html>
  );
}
