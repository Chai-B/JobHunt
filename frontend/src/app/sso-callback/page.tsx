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

    // Handle the Clerk OAuth redirect parameters manually
    useEffect(() => {
        if (clerk && !hasSynced.current) {
            clerk.handleRedirectCallback({
                signInForceRedirectUrl: "/sso-callback",
                signUpForceRedirectUrl: "/sso-callback",
            }).catch((err) => {
                console.error("Clerk redirect error:", err);
            });
        }
    }, [clerk]);

    useEffect(() => {
        const syncOAuthUser = async () => {
            if (hasSynced.current) return;

            // Even if isSignedIn is false, we might have enough info if the session is transferable
            // but for simplicity, we wait for isSignedIn as it's more stable.
            if (isLoaded && isSignedIn && user) {
                hasSynced.current = true;
                setStatus("Syncing with JobHunt...");
                const email = user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress;

                if (!email) {
                    toast.error("No email address found.");
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
                    toast.success("Welcome back!");
                    router.push("/dashboard");
                } catch (err: any) {
                    console.error("Sync error:", err);
                    toast.error(err.message || "Callback failed.");
                    router.push("/");
                }
            }
        };

        syncOAuthUser();
    }, [isLoaded, isSignedIn, user, router]);

    // Cleanup timeout
    useEffect(() => {
        const timer = setTimeout(() => {
            if (isLoaded && !isSignedIn && !hasSynced.current) {
                // If we are signed in to Clerk but just lingering here, push to dashboard
                const token = localStorage.getItem("token");
                if (token) {
                    router.push("/dashboard");
                } else {
                    toast.error("Sign-in timed out.");
                    router.push("/");
                }
            }
        }, 10000);

        return () => clearTimeout(timer);
    }, [isLoaded, isSignedIn, router]);

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
