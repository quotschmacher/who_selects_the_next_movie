import "./globals.css";
import type { ReactNode } from "react";
import Link from "next/link";
import { ReactQueryClientProvider } from "@/lib/query-client";

export const metadata = { title: "Movie Night (local)" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-screen">
        <nav className="bg-white border-b sticky top-0 z-10">
          <div className="max-w-5xl mx-auto flex items-center gap-4 p-4">
            <Link className="font-semibold" href="/">Movie Night</Link>
            <div className="flex gap-4 text-sm">
              <Link href="/search">Suche</Link>
              <Link href="/watchlog">Watchlog</Link>
              <Link href="/users">Nutzer</Link>
            </div>
          </div>
        </nav>
        <ReactQueryClientProvider>
          <main className="max-w-5xl mx-auto p-4">{children}</main>
        </ReactQueryClientProvider>
      </body>
    </html>
  );
}

