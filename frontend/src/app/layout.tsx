import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { ClerkWrapper } from "@/components/clerk-wrapper";

export const metadata: Metadata = {
  title: "JobHunt Autonomous AI",
  description: "Automated Application and Web Scraping Engine",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <head>
        <link href="https://api.fontshare.com/v2/css?f[]=clash-display@200,300,400,500,600,700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans antialiased bg-background text-foreground min-h-screen selection:bg-zinc-800">
        <ClerkWrapper>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem={false}
            disableTransitionOnChange
          >
            {children}
            <Toaster toastOptions={{ className: 'dark:bg-[#050505] dark:border-[#27272a] dark:text-white' }} />
          </ThemeProvider>
        </ClerkWrapper>
      </body>
    </html>
  );
}
