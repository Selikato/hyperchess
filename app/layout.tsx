import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ArenaInviteBanner } from "@/components/arena/ArenaInviteBanner";
import { NotificationInbox } from "@/components/arena/NotificationInbox";
import { ArenaToastProvider } from "@/components/arena/ArenaToastProvider";
import { PresenceTracker } from "@/components/arena/PresenceTracker";
import { ProfileProvider } from "@/components/ProfileProvider";
import { AdSenseScript } from "@/components/ads/AdSenseScript";
import { SupabaseConfigBanner } from "@/components/SupabaseConfigBanner";
import { SupabaseSessionListener } from "@/components/SupabaseSessionListener";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HyperChess",
  description: "Online satranç, bot maçı, bulmaca ve analiz",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <AdSenseScript />
        <SupabaseConfigBanner />
        <SupabaseSessionListener />
        <ProfileProvider>
          <PresenceTracker />
          <ArenaToastProvider>
            <NotificationInbox />
            <ArenaInviteBanner />
            {children}
          </ArenaToastProvider>
        </ProfileProvider>
      </body>
    </html>
  );
}
