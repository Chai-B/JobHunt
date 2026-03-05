"use client";

import { useSession, useUser } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { API_BASE_URL, OAUTH_SYNC_SECRET } from "@/lib/config";

/**
 * Invisible component that watches for Clerk sessions globally.
 * If Clerk signs the user in, this automatically forces the backend sync
 * and puts them in the dashboard, avoiding redirect-loop relying pages.
 */
export function GlobalClerkSync() {
    const { session, isLoaded: sessionLoaded } = useSession();
    const { user, isLoaded: userLoaded } = useUser();
    const pathname = usePathname();
    const router = useRouter();
    const hasSynced = useRef(false);

    useEffect(() => {
        if (!sessionLoaded || !userLoaded) return;

        const token = localStorage.getItem("token");

        // If Clerk is signed in
        if (session && user) {
            // Case A: Token missing -> Sync needed
            if (!token && !hasSynced.current) {
                syncBackend();
            }
            // Case B: Already have token but stuck on login/landing button routes -> Force Dashboard
            else if (token && (pathname === "/login" || pathname === "/verify-email")) {
                console.log("GlobalSync: Valid session + token found on auth page, redirecting to dashboard");
                router.push("/dashboard");
            }
        }
    }, [sessionLoaded, userLoaded, session, user, pathname, router]);

    const syncBackend = async () => {
        if (!user || hasSynced.current) return;

        hasSynced.current = true;
        console.log("GlobalSync: Attempting backend synchronization...");
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
            hasSynced.current = false; // Allow retry on failure
        }
    };

    return null;
}
