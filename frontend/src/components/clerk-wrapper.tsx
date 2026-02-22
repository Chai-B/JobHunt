"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { usePathname } from "next/navigation";

/**
 * Conditional Clerk wrapper.
 * Only wraps with ClerkProvider on pages that actually use Clerk (login, SSO callback).
 * Dashboard pages use custom JWT auth and don't need Clerk's session management.
 */
export function ClerkWrapper({ children }: { children: React.ReactNode }) {
    const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    const pathname = usePathname();

    if (!publishableKey) {
        return <>{children}</>;
    }

    return (
        <ClerkProvider publishableKey={publishableKey}>
            {children}
        </ClerkProvider>
    );
}
