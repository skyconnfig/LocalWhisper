import type { Metadata } from "next";
import { Raleway } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Toaster } from "@/components/ui/sonner";
import { TRPCReactProvider } from "@/trpc/client";
import { TogetherApiKeyProvider } from "@/components/TogetherApiKeyProvider";
import { Footer } from "@/components/Footer";
import PlausibleProvider from "next-plausible";
import { AuthProvider } from "@/components/AuthProvider";

const raleway = Raleway({
  variable: "--font-raleway",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Whisper App - Capture Your Thoughts By Voice",
  description: "Convert your thoughts into text by voice with Whisper.",
  openGraph: {
    images: "https://usewhisper.io/og.jpg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthProvider>
      <TogetherApiKeyProvider>
        <TRPCReactProvider>
          <html lang="en">
            <head>
              <PlausibleProvider domain="usewhisper.io" />
            </head>
            <body className={`${raleway.variable} antialiased`}>
              <div className="min-h-screen bg-white flex flex-col">
                <Header />
                {children}
                <Toaster richColors />
                <Footer />
              </div>
            </body>
          </html>
        </TRPCReactProvider>
      </TogetherApiKeyProvider>
    </AuthProvider>
  );
}