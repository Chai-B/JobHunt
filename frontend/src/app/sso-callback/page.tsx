"use client";
import { API_BASE_URL } from "@/lib/config";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TerminalSquare } from "lucide-react";

export default function OAuthCallbackPage() {
    const router = useRouter();
    const [status, setStatus] = useState("Completing sign-in...");

    useEffect(() => {
        const syncOAuthUser = async () => {
            try {
                // Try to get user info from Clerk's client-side session
                const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
                if (!clerkKey) {
                    toast.error("Clerk not configured.");
                    router.push("/");
                    return;
                }

                // Wait for Clerk to process the OAuth callback
                setStatus("Verifying with Clerk...");

                // Dynamic import to avoid SSR issues
                const clerk = await import("@clerk/nextjs");

                // Poll for the Clerk user to be available (max 10 seconds)
                let attempts = 0;
                const maxAttempts = 20;

                const checkClerkUser = async (): Promise<void> => {
                    attempts++;

                    // Access window.__clerk_frontend_api or wait for Clerk to load
                    if (typeof window !== "undefined" && (window as any).__clerk) {
                        const clerkInstance = (window as any).__clerk;
                        if (clerkInstance?.user) {
                            const user = clerkInstance.user;
                            const email = user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress;

                            if (email) {
                                setStatus("Syncing your account...");

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
                                return;
                            }
                        }
                    }

                    if (attempts < maxAttempts) {
                        setTimeout(checkClerkUser, 500);
                    } else {
                        toast.error("OAuth sign-in timed out. Please try again.");
                        router.push("/");
                    }
                };

                checkClerkUser();
            } catch (err: any) {
                toast.error(err.message || "OAuth callback failed.");
                router.push("/");
            }
        };

        syncOAuthUser();
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
