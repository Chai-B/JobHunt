"use client";
import { API_BASE_URL, OAUTH_SYNC_SECRET } from "@/lib/config";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TerminalSquare } from "lucide-react";

// Safe Clerk hooks — return null during SSR/build
function useClerkSafe() {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { useClerk } = require("@clerk/nextjs");
        return useClerk();
    } catch {
        return null;
    }
}

function useUserSafe() {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { useUser } = require("@clerk/nextjs");
        return useUser();
    } catch {
        return { isLoaded: false, isSignedIn: false, user: null };
    }
}

export default function OAuthCallbackPage() {
    const router = useRouter();
    const clerk = useClerkSafe();
    const [status, setStatus] = useState("Verifying with Clerk...");
    const { isLoaded, isSignedIn, user } = useUserSafe();
    const hasSynced = useRef(false);

    // Step 1: Process Clerk redirect callback
    useEffect(() => {
        if (clerk && !hasSynced.current) {
            clerk.handleRedirectCallback?.({
                signInForceRedirectUrl: "/sso-callback",
                signUpForceRedirectUrl: "/sso-callback",
            }).catch((err: any) => {
                console.error("Clerk redirect error:", err);
                setStatus("Retrying...");
            });
        }
    }, [clerk]);

    // Step 2: Once Clerk confirms user → sync with backend
    useEffect(() => {
        const syncOAuthUser = async () => {
            if (hasSynced.current) return;

            if (isLoaded && isSignedIn && user) {
                hasSynced.current = true;
                setStatus("Finalizing sync...");
                const email = user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress;

                if (!email) {
                    toast.error("No email found.");
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
                            full_name: user.fullName || user.firstName || email.split("@")[0],
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

    // Step 3: Fallback — if nothing happens in 10s, redirect
    useEffect(() => {
        const timer = setTimeout(() => {
            if (!hasSynced.current) {
                // If user is signed in with Clerk but sync didn't fire, try dashboard
                const token = localStorage.getItem("token");
                if (token) {
                    window.location.href = "/dashboard";
                    return;
                }
                // Otherwise send back to login
                toast.error("Sign-in timed out. Please try again.");
                router.push("/login");
            }
        }, 10000);

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
