import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme-provider";
import { PostHogProvider } from "@/components/PostHogProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "CodeCollab",
  description: "Collaborative DSA practice",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Theme script to prevent flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  // Apply the saved theme immediately to prevent flash
                  const savedTheme = localStorage.getItem('theme');
                  const systemPreference = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  const initialTheme = savedTheme || systemPreference;
                  
                  if (initialTheme === 'dark') {
                    document.documentElement.classList.add('dark');
                    document.body.classList.add('dark');
                  }

                  // Handle theme changes during client-side navigation
                  const applyTheme = () => {
                    const currentTheme = localStorage.getItem('theme') || 
                      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                    
                    if (currentTheme === 'dark') {
                      document.documentElement.classList.add('dark');
                      document.body.classList.add('dark');
                    } else {
                      document.documentElement.classList.remove('dark');
                      document.body.classList.remove('dark');
                    }
                  };

                  // Listen for Next.js route changes
                  window.addEventListener('beforeunload', applyTheme);
                  document.addEventListener('visibilitychange', applyTheme);
                  
                  // Also reapply on any navigation events
                  if (window.next) {
                    window.next.router.events.on('routeChangeStart', applyTheme);
                    window.next.router.events.on('routeChangeComplete', applyTheme);
                  }
                } catch (e) {
                  // Fallback if localStorage is not available
                  console.error('Error accessing localStorage:', e);
                }
              })();
            `,
          }}
        />
        {/* Add CSS to prevent flash during page transitions */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              /* Prevent flash during page transitions */
              html.dark {
                color-scheme: dark;
              }
              html.dark body {
                background-color: #1a1c1f;
                color: #e5e7eb;
              }
              /* Ensure immediate application of dark mode */
              .dark {
                transition: none !important;
              }
            `,
          }}
        />
        {/* Add Pyodide script directly in the head */}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <PostHogProvider>
          <ThemeProvider>
            <div className="min-h-screen">{children}</div>
          </ThemeProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
