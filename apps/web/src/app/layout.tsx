import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rally — quadras de areia",
  description: "Do agendamento ao replay nas quadras de areia.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="font-body antialiased">{children}</body>
    </html>
  );
}
