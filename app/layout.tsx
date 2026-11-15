import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers";
import { AppFrame } from "@/components/shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Veylix — Fleet Operations",
  description: "Connected vehicle intelligence and fleet operations dashboard",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AppFrame>{children}</AppFrame>
        </Providers>
      </body>
    </html>
  );
}
