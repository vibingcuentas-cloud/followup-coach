import "./globals.css";
import DensityBoot from "../components/DensityBoot";

export const metadata = {
  title: "Forge",
  description: "Forge | Intimacy OS for Strategic Accounts",
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
