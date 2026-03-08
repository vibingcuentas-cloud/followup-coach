import "./globals.css";

export const metadata = {
  title: "Forge",
  description: "Forge | Intimacy OS for Strategic Accounts",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <div className="app">{children}</div>
        </div>
      </body>
    </html>
  );
}
