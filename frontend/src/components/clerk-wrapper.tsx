"use client";

import { ClerkProvider } from "@clerk/nextjs";

/**
 * Conditional Clerk wrapper.
 * If NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is set, wraps children with ClerkProvider.
 * Otherwise, renders children directly — the app works fully standalone.
 */
export function ClerkWrapper({ children }: { children: React.ReactNode }) {
    const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

    if (!publishableKey) {
        return <>{children}</>;
    }

    return (
        <ClerkProvider publishableKey={publishableKey}>
            {children}
        </ClerkProvider>
    );
}
