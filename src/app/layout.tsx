import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Code Documentation Generator",
    description: "Generate documentation for your GitHub repositories using generative AI.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body>
                {children}
            </body>
        </html>
    );
}
