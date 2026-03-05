"use client";

import { ClerkProvider, useSession, useUser } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { API_BASE_URL, OAUTH_SYNC_SECRET } from "@/lib/config";

/**
 * Invisible component that watches for Clerk sessions globally.
 * If Clerk signs the user in, this automatically forces the backend sync
 * and puts them in the dashboard, avoiding redirect-loop relying pages.
 */
function GlobalClerkSync() {
    const { session, isLoaded: sessionLoaded } = useSession();
    const { user, isLoaded: userLoaded } = useUser();
    const router = useRouter();
    const hasSynced = useRef(false);

    useEffect(() => {
        if (!sessionLoaded || !userLoaded || !session || !user || hasSynced.current) return;

        const token = localStorage.getItem("token");
        if (token) return; // Already fully authenticated locally

        const syncBackend = async () => {
            hasSynced.current = true;
            toast.loading("Securing session...", { id: "clerk-sync" });

            const email = user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress;
            if (!email) {
                toast.error("No email found from provider.", { id: "clerk-sync" });
                return;
            }

            try {
                const res = await fetch(`${API_BASE_URL}/api/v1/auth/oauth-sync`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...(OAUTH_SYNC_SECRET ? { "X-OAuth-Secret": OAUTH_SYNC_SECRET } : {}),
                    },
                    body: JSON.stringify({
                        email: email,
                        full_name: user.fullName || user.firstName || email.split("@")[0] || "User",
                        clerk_id: user.id,
                        provider: "oauth"
                    })
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.detail || "Sync failed.");
                }

                const data = await res.json();
                localStorage.setItem("token", data.access_token);

                toast.success("Welcome back!", { id: "clerk-sync" });
                window.location.href = "/dashboard";
            } catch (err: any) {
                console.error("Global sync error:", err);
                toast.error(err.message || "Failed to secure session.", { id: "clerk-sync" });
            }
        };

        syncBackend();
    }, [sessionLoaded, userLoaded, session, user, router]);

    return null;
}

export function ClerkWrapper({ children }: { children: React.ReactNode }) {
    const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

    if (!publishableKey) {
        return <>{children}</>;
    }

    return (
        <ClerkProvider publishableKey={publishableKey}>
            <GlobalClerkSync />
            {children}
        </ClerkProvider>
    );
}
