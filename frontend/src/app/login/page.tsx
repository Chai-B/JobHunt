"use client";
import { API_BASE_URL } from "@/lib/config";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowRight, ArrowLeft, Briefcase } from "lucide-react";
import dynamic from "next/dynamic";

// Load OAuthButtons only on client (uses Clerk hooks that crash at build time)
const OAuthButtons = dynamic(() => import("@/components/oauth-buttons").then(m => m.OAuthButtons), { ssr: false });

// Safe Clerk hook — returns null during SSR
function useClerkSafe() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useClerk } = require("@clerk/nextjs");
    return useClerk();
  } catch {
    return null;
  }
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [showVerifyNotice, setShowVerifyNotice] = useState(false);
  const clerk = useClerkSafe();
  const router = useRouter();

  useEffect(() => {
    const localToken = localStorage.getItem("token");
    if (localToken) {
      router.push("/dashboard");
    }
  }, [router]);

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
        toast.success("Account created! Check your email for a verification link.");
        setShowVerifyNotice(true);
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

  const inputClass = "bg-background border-border focus-visible:ring-ring text-foreground h-11 w-full rounded-md shadow-sm transition-colors focus:border-ring placeholder:text-muted-foreground";
  const labelClass = "text-xs uppercase tracking-widest text-muted-foreground font-medium";

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background text-foreground relative overflow-hidden selection:bg-secondary">
      <div className="w-full max-w-[400px] animate-in fade-in zoom-in-95 duration-700 px-6">
        <div className="mb-10 text-center flex flex-col items-center">
          <div className="h-14 w-14 rounded-full bg-secondary flex items-center justify-center border border-border mb-6">
            <Briefcase className="h-6 w-6 text-foreground" />
          </div>
          <h1 className="text-3xl font-medium tracking-tight text-foreground">
            {isRegistering ? "Create an account" : "JobHunt"}
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
            {isRegistering ? "Set up your workspace to automate your job search." : "Sign in to access your automated application dashboard."}
          </p>
        </div>

        {showVerifyNotice && (
          <div className="mb-4 p-4 bg-primary/5 border border-primary/20 rounded-xl text-center animate-in fade-in slide-in-from-top-4 duration-500">
            <p className="text-sm font-medium text-foreground">Check your email</p>
            <p className="text-xs text-muted-foreground mt-1">We sent a verification link to your email. Click it to activate your account.</p>
          </div>
        )}

        <div className="p-8 bg-card border border-border rounded-xl shadow-sm relative overflow-hidden min-h-[400px]">
          <button
            onClick={() => router.push("/")}
            className="absolute top-4 left-4 p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>


          {/* OAuth Buttons — loaded only on client */}
          <OAuthButtons />

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
