import "./globals.css";

export const metadata = {
  title: "Followup Coach",
  description: "Intimacy-first follow-up tracker",
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
