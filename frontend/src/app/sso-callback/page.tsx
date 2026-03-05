"use client";
import { API_BASE_URL, OAUTH_SYNC_SECRET } from "@/lib/config";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TerminalSquare } from "lucide-react";
import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

function useUserSafe() {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { useUser } = require("@clerk/nextjs");
        return useUser();
    } catch {
        return { isLoaded: false, isSignedIn: false, user: null };
    }
}

function SyncLogic() {
    const router = useRouter();
    const { isLoaded, isSignedIn, user } = useUserSafe();
    const [status, setStatus] = useState("Finalizing sync...");
    const hasSynced = useRef(false);

    useEffect(() => {
        const syncOAuthUser = async () => {
            if (hasSynced.current) return;

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

    // Fallback timer just in case sync hangs
    useEffect(() => {
        const timer = setTimeout(() => {
            if (!hasSynced.current) {
                const token = localStorage.getItem("token");
                if (token) {
                    window.location.href = "/dashboard";
                } else {
                    toast.error("Sign-in timed out. Please try again.");
                    router.push("/login");
                }
            }
        }, 10000);
        return () => clearTimeout(timer);
    }, [router]);

    return (
        <div className="flex flex-col items-center gap-4">
            <TerminalSquare className="h-6 w-6 text-muted-foreground animate-pulse" />
            <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
                {status}
            </p>
        </div>
    );
}

export default function OAuthCallbackPage() {
    const { isLoaded, isSignedIn } = useUserSafe();

    // If Clerk is still processing the redirect from Google/GitHub, show the AuthenticateWithRedirectCallback
    // This handles the dirty work of exchanging the OAuth token
    if (!isLoaded || (!isSignedIn && typeof window !== "undefined" && window.location.search.includes("redirect_status"))) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <TerminalSquare className="h-6 w-6 text-muted-foreground animate-pulse" />
                    <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
                        Verifying with Clerk...
                    </p>
                    {/* Only render if we're actually in the Clerk flow to avoid Next.js hydration errors */}
                    <div className="hidden">
                        <AuthenticateWithRedirectCallback
                            signInUrl="/login"
                            signUpUrl="/login"
                            signInForceRedirectUrl="/sso-callback"
                            signUpForceRedirectUrl="/sso-callback"
                        />
                    </div>
                </div>
            </div>
        );
    }

    // Once Clerk is done and we are signed in, run our backend sync
    return (
        <div className="flex h-screen items-center justify-center bg-background">
            <SyncLogic />
        </div>
    );
}
