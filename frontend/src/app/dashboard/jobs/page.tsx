"use client";

import { Briefcase, Wrench } from "lucide-react";

export default function JobsPage() {
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div>
                <h1 className="text-3xl font-medium tracking-tight text-foreground flex items-center gap-3">
                    <Briefcase className="h-6 w-6" />
                    Jobs
                </h1>
                <p className="text-muted-foreground mt-1 text-sm">Auto-scraped and manually added jobs from the global pool.</p>
            </div>

            <div className="flex flex-col items-center justify-center py-32 text-center">
                <div className="h-20 w-20 bg-secondary/50 rounded-full flex items-center justify-center mb-6 border border-border">
                    <Wrench className="w-8 h-8 text-muted-foreground/60" />
                </div>
                <h2 className="text-2xl font-medium text-foreground mb-2">Coming Soon</h2>
                <p className="text-muted-foreground text-sm max-w-md leading-relaxed">
                    The Jobs board is currently in development. Once the scraper is perfected, discovered jobs will appear here with AI-powered matching and one-click applications.
                </p>
                <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground/50 uppercase tracking-widest font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                    In Development
                </div>
            </div>
        </div>
    );
}
