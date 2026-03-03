"use client";
import { API_BASE_URL } from "@/lib/config";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Briefcase, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Suspense } from "react";

function VerifyEmailContent() {
    const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
    const [message, setMessage] = useState("");
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get("token");

    useEffect(() => {
        if (!token) {
            setStatus("error");
            setMessage("Invalid verification link. No token provided.");
            return;
        }
        (async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/v1/auth/verify-email`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token }),
                });
                const data = await res.json();
                if (res.ok) {
                    setStatus("success");
                    setMessage(data.message || "Email verified successfully.");
                    setTimeout(() => router.push("/login"), 3000);
                } else {
                    setStatus("error");
                    setMessage(data.detail || "Verification failed.");
                }
            } catch {
                setStatus("error");
                setMessage("Network error. Please try again.");
            }
        })();
    }, [token, router]);

    return (
        <div className="flex h-screen w-screen items-center justify-center bg-background text-foreground">
            <div className="w-full max-w-[400px] animate-in fade-in zoom-in-95 duration-700 px-6 text-center">
                <div className="mb-8 flex flex-col items-center">
                    <div className="h-14 w-14 rounded-full bg-secondary flex items-center justify-center border border-border mb-6">
                        <Briefcase className="h-6 w-6 text-foreground" />
                    </div>
                    <h1 className="text-3xl font-medium tracking-tight text-foreground">Email Verification</h1>
                </div>

                <div className="p-8 bg-card border border-border rounded-xl shadow-sm flex flex-col items-center gap-4">
                    {status === "loading" && (
                        <>
                            <Loader2 className="h-10 w-10 text-muted-foreground animate-spin" />
                            <p className="text-sm text-muted-foreground">Verifying your email...</p>
                        </>
                    )}
                    {status === "success" && (
                        <>
                            <CheckCircle className="h-10 w-10 text-green-500" />
                            <p className="text-sm text-foreground font-medium">{message}</p>
                            <p className="text-xs text-muted-foreground">Redirecting to login...</p>
                        </>
                    )}
                    {status === "error" && (
                        <>
                            <XCircle className="h-10 w-10 text-destructive" />
                            <p className="text-sm text-foreground font-medium">{message}</p>
                            <button
                                onClick={() => router.push("/login")}
                                className="mt-2 text-sm text-muted-foreground hover:text-foreground transition-colors underline"
                            >
                                Back to login
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        }>
            <VerifyEmailContent />
        </Suspense>
    );
}
