"use client";
import { API_BASE_URL } from "@/lib/config";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TerminalSquare } from "lucide-react";
import { useUser, AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function OAuthCallbackPage() {
    const router = useRouter();
    const [status, setStatus] = useState("Verifying with Clerk...");
    const { isLoaded, isSignedIn, user } = useUser();
    const hasSynced = useRef(false);

    useEffect(() => {
        const syncOAuthUser = async () => {
            if (hasSynced.current) return;

            if (isLoaded && isSignedIn && user) {
                hasSynced.current = true;
                setStatus("Syncing your account...");
                const email = user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress;

                if (!email) {
                    toast.error("No email address found from OAuth provider.");
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
                        throw new Error(err.detail || "Failed to sync OAuth user.");
                    }

                    const data = await res.json();
                    localStorage.setItem("token", data.access_token);
                    toast.success("Signed in successfully!");
                    router.push("/dashboard");
                } catch (err: any) {
                    toast.error(err.message || "OAuth callback failed.");
                    router.push("/");
                }
            }
        };

        syncOAuthUser();
    }, [isLoaded, isSignedIn, user, router]);

    // Timeout fallback if it hangs on the callback page for too long
    useEffect(() => {
        const timer = setTimeout(() => {
            if (isLoaded && !isSignedIn && !hasSynced.current) {
                toast.error("OAuth sign-in timed out or failed. Please try again.");
                router.push("/");
            }
        }, 15000); // 15 seconds max wait

        return () => clearTimeout(timer);
    }, [isLoaded, isSignedIn, router]);

    return (
        <div className="flex h-screen items-center justify-center bg-background">
            {/* 
              Force the callback component to stay on this page for the background processing 
              instead of letting it auto-redirect to Clerk's hosted paths.
            */}
            <AuthenticateWithRedirectCallback />

            <div className="flex flex-col items-center gap-4">
                <TerminalSquare className="h-6 w-6 text-muted-foreground animate-pulse" />
                <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
                    {status}
                </p>
            </div>
        </div>
    );
}
