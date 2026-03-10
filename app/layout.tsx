import "./globals.css";
import DensityBoot from "../components/DensityBoot";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Forge",
  description: "Forge | Intimacy OS for Strategic Accounts",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <DensityBoot />
        <div className="app-shell">
          <div className="app">{children}</div>
        </div>
      </body>
    </html>
  );
}
