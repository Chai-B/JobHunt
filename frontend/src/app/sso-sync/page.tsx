"use client";
import { API_BASE_URL, OAUTH_SYNC_SECRET } from "@/lib/config";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TerminalSquare } from "lucide-react";

function useUserSafe() {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { useUser } = require("@clerk/nextjs");
        return useUser();
    } catch {
        return { isLoaded: false, isSignedIn: false, user: null };
    }
}

export default function SsoSyncPage() {
    const router = useRouter();
    const { isLoaded, isSignedIn, user } = useUserSafe();
    const [status, setStatus] = useState("Finalizing sync...");
    const hasSynced = useRef(false);

    useEffect(() => {
        const syncOAuthUser = async () => {
            if (hasSynced.current) return;

            // Wait until Clerk is fully loaded. If loaded but not signed in, they shouldn't be here.
            if (isLoaded && !isSignedIn) {
                toast.error("Authentication failed or expired. Please try again.");
                router.push("/login");
                return;
            }

            if (isLoaded && isSignedIn && user) {
                hasSynced.current = true;
                const email = user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress;

                if (!email) {
                    toast.error("No email found from auth provider.");
                    router.push("/login");
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

                    toast.success("Welcome back!");
                    window.location.href = "/dashboard";
                } catch (err: any) {
                    console.error("Sync error:", err);
                    toast.error(err.message || "Callback failed.");
                    router.push("/login");
                }
            }
        };

        syncOAuthUser();
    }, [isLoaded, isSignedIn, user, router]);

    // Fallback timer just in case of network freeze
    useEffect(() => {
        const timer = setTimeout(() => {
            if (!hasSynced.current) {
                const token = localStorage.getItem("token");
                if (token) {
                    window.location.href = "/dashboard";
                } else {
                    toast.error("Database sync timed out. Please try sorting your network and login again.");
                    router.push("/login");
                }
            }
        }, 15000); // 15s to be safe
        return () => clearTimeout(timer);
    }, [router]);

    return (
        <div className="flex h-screen items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4">
                <TerminalSquare className="h-6 w-6 text-muted-foreground animate-pulse" />
                <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
                    {status}
                </p>
            </div>
        </div>
    );
}
