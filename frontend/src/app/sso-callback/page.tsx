"use client";
import { API_BASE_URL } from "@/lib/config";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TerminalSquare } from "lucide-react";
import { useUser, useClerk } from "@clerk/nextjs";

export default function OAuthCallbackPage() {
    const router = useRouter();
    const clerk = useClerk();
    const [status, setStatus] = useState("Verifying with Clerk...");
    const { isLoaded, isSignedIn, user } = useUser();
    const hasSynced = useRef(false);

    // 1. Manually process the OAuth parameters from the URL
    useEffect(() => {
        if (clerk && !hasSynced.current) {
            // We call this manually to avoid the automatic AuthenticateWithRedirectCallback behavior
            // which often triggers redirects to Hosted Forms if it thinks the session is incomplete.
            clerk.handleRedirectCallback({
                // We keep them on this page to finish our local backend sync
                signInForceRedirectUrl: "/sso-callback",
                signUpForceRedirectUrl: "/sso-callback",
            }).catch((err) => {
                console.error("Clerk redirect error:", err);
            });
        }
    }, [clerk]);

    // 2. Once Clerk confirms sign-in, sync with our backend
    useEffect(() => {
        const syncOAuthUser = async () => {
            if (hasSynced.current) return;

            if (isLoaded && isSignedIn && user) {
                hasSynced.current = true;
                setStatus("Finalizing sync...");
                const email = user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress;

                if (!email) {
                    toast.error("No email found.");
                    router.push("/");
                    return;
                }

                try {
                    const res = await fetch(`${API_BASE_URL}/api/v1/auth/oauth-sync`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
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

                    // Force a direct push to dashboard
                    toast.success("Welcome back!");
                    window.location.href = "/dashboard";
                } catch (err: any) {
                    console.error("Sync error:", err);
                    toast.error(err.message || "Callback failed.");
                    router.push("/");
                }
            }
        };

        syncOAuthUser();
    }, [isLoaded, isSignedIn, user, router]);

    // Fallback if we get stuck
    useEffect(() => {
        const timer = setTimeout(() => {
            if (isLoaded && !hasSynced.current) {
                const token = localStorage.getItem("token");
                if (token && isSignedIn) {
                    window.location.href = "/dashboard";
                }
            }
        }, 8000);

        return () => clearTimeout(timer);
    }, [isLoaded, isSignedIn]);

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
