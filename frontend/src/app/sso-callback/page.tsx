import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { TerminalSquare } from "lucide-react";

export default function OAuthCallbackPage() {
    return (
        <div className="flex h-screen items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4">
                <TerminalSquare className="h-6 w-6 text-muted-foreground animate-pulse" />
                <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
                    Verifying with Clerk...
                </p>
                {/* 
                  Clerk handles the OAuth token exchange and automatically 
                  redirects to /sso-sync when complete.
                */}
                <AuthenticateWithRedirectCallback
                    signInForceRedirectUrl="/sso-sync"
                    signUpForceRedirectUrl="/sso-sync"
                />
            </div>
        </div>
    );
}
