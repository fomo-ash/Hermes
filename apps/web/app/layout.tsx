import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fullstack Workspace",
  description: "Turborepo custom Google OAuth application",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 0,
          fontFamily: "sans-serif",
          backgroundColor: "white",
        }}
      >
        {children}
      </body>
    </html>
  );
}
