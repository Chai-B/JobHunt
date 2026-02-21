"use client";
import { API_BASE_URL } from "@/lib/config";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowRight, Briefcase } from "lucide-react";

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const router = useRouter();

  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isRegistering) {
        const res = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email,
            password: password,
            full_name: email.split("@")[0],
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || "Registration failed. Please try again.");
        }
        toast.success("Account created successfully. Please sign in.");
        setIsRegistering(false);
      } else {
        const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            username: email,
            password: password,
          }),
        });

        if (!res.ok) throw new Error("Invalid username or password.");

        const data = await res.json();
        localStorage.setItem("token", data.access_token);
        toast.success("Logged in successfully. Redirecting...");
        router.push("/dashboard");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred during authentication.");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: "google" | "github") => {
    if (!clerkKey) {
      toast.error("OAuth not configured. Add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to .env.local");
      return;
    }

    setOauthLoading(provider);
    try {
      // Dynamic import to avoid SSR issues with Clerk hooks
      const { useClerk } = await import("@clerk/nextjs");
      // Use Clerk's frontend API to redirect to OAuth
      const clerkFrontendApi = clerkKey.replace("pk_", "");

      // Build the Clerk OAuth redirect URL
      const strategy = provider === "google" ? "oauth_google" : "oauth_github";
      const redirectUrl = `${window.location.origin}/sso-callback`;

      // Use Clerk's redirect-based OAuth (no hooks needed)
      const clerkDomain = clerkKey.includes("pk_test_")
        ? clerkKey.replace("pk_test_", "").replace(/=$/, "")
        : clerkKey.replace("pk_live_", "").replace(/=$/, "");

      // Decode the base64-encoded domain from the publishable key
      let frontendApi = "";
      try {
        frontendApi = atob(clerkDomain);
      } catch {
        frontendApi = `${clerkDomain}.clerk.accounts.dev`;
      }

      const oauthUrl = `https://${frontendApi}/v1/client/sign_ins?strategy=${strategy}&redirect_url=${encodeURIComponent(redirectUrl)}&action_complete_redirect_url=${encodeURIComponent(redirectUrl)}`;

      window.location.href = oauthUrl;
    } catch (err: any) {
      toast.error(`OAuth failed: ${err.message}`);
      setOauthLoading(null);
    }
  };

  const inputClass = "bg-background border-border focus-visible:ring-ring text-foreground h-11 w-full rounded-md shadow-sm transition-colors focus:border-ring placeholder:text-muted-foreground";
  const labelClass = "text-xs uppercase tracking-widest text-muted-foreground font-medium";

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background text-foreground relative overflow-hidden selection:bg-secondary">
      <div className="w-full max-w-[400px] animate-in fade-in zoom-in-95 duration-700 px-6">
        <div className="mb-10 text-center flex flex-col items-center">
          <div className="h-14 w-14 rounded-full bg-secondary flex items-center justify-center border border-border mb-6">
            <Briefcase className="h-6 w-6 text-foreground" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {isRegistering ? "Create an account" : "JobHunt"}
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
            {isRegistering ? "Set up your workspace to automate your job search." : "Sign in to access your automated application dashboard."}
          </p>
        </div>

        <div className="p-8 bg-card border border-border rounded-xl shadow-sm relative overflow-hidden">
          {/* OAuth Buttons */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOAuth("google")}
              disabled={!!oauthLoading}
              className="h-11 border-border text-foreground hover:bg-secondary transition-colors gap-2.5 font-medium"
            >
              {oauthLoading === "google" ? (
                <div className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
              ) : (
                <GoogleIcon className="w-4 h-4" />
              )}
              Google
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOAuth("github")}
              disabled={!!oauthLoading}
              className="h-11 border-border text-foreground hover:bg-secondary transition-colors gap-2.5 font-medium"
            >
              {oauthLoading === "github" ? (
                <div className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
              ) : (
                <GitHubIcon className="w-4 h-4" />
              )}
              GitHub
            </Button>
          </div>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-3 text-muted-foreground font-medium">or continue with email</span>
            </div>
          </div>

          <form onSubmit={handleAuth} className="relative z-10 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className={labelClass}>Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className={labelClass}>Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••••••"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="pt-4">
              <Button
                className="w-full h-11 bg-foreground text-background hover:opacity-90 font-medium rounded-md shadow-sm transition-opacity flex items-center justify-center gap-2 group"
                type="submit"
                disabled={loading}
              >
                {loading ? (isRegistering ? "Creating account..." : "Signing in...") : (isRegistering ? "Create account" : "Sign in")}
                {!loading && <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />}
              </Button>
            </div>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setIsRegistering(!isRegistering)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
              >
                {isRegistering ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
