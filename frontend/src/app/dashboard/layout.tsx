"use client";
import { API_BASE_URL } from "@/lib/config";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Briefcase, FileText, Send, Mail, Settings, LogOut, UserCircle, Globe, TerminalSquare, Zap, Activity, Users, Sparkles, MessageSquare, HelpCircle, Menu, X } from "lucide-react";
import { toast } from "sonner";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { TutorialOverlay } from "@/components/tutorial-overlay";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

// Safe Clerk hook — returns null when ClerkProvider is absent (SSR / build time)
function useClerkSafe() {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { useClerk } = require("@clerk/nextjs");
        return useClerk();
    } catch {
        return null;
    }
}

const navigation = [
    { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
    { name: "Jobs", href: "/dashboard/jobs", icon: Briefcase },
    { name: "Scraper", href: "/dashboard/scraper", icon: Globe },
    { name: "Applications", href: "/dashboard/applications", icon: Send },
    { name: "Cold Mail", href: "/dashboard/cold-mail", icon: Zap },
    { name: "Templates", href: "/dashboard/templates", icon: Mail },
    { name: "Contacts", href: "/dashboard/contacts", icon: Users },
    { name: "Extractor", href: "/dashboard/extract", icon: Sparkles },
    { name: "Resumes", href: "/dashboard/resumes", icon: FileText },
    { name: "Profile", href: "/dashboard/profile", icon: UserCircle },
    { name: "Settings", href: "/dashboard/settings", icon: Settings },
    { name: "Logs", href: "/dashboard/logs", icon: TerminalSquare },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const clerk = useClerkSafe();
    const pathname = usePathname();
    const [user, setUser] = useState<any>(null);
    const [runningProcesses, setRunningProcesses] = useState<any[]>([]);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const [feedbackOpen, setFeedbackOpen] = useState(false);
    const [feedbackText, setFeedbackText] = useState("");
    const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

    // Close sidebar on navigation
    useEffect(() => {
        setSidebarOpen(false);
    }, [pathname]);

    const handleFeedbackSubmit = async () => {
        if (!feedbackText.trim()) return;
        setIsSubmittingFeedback(true);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/v1/feedbacks/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ message: feedbackText })
            });
            if (res.ok) {
                toast.success("Feedback submitted. Thank you!");
                setFeedbackOpen(false);
                setFeedbackText("");
            } else {
                toast.error("Failed to submit feedback.");
            }
        } catch (err) {
            toast.error("Network error.");
        } finally {
            setIsSubmittingFeedback(false);
        }
    };

    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem("token");
            if (!token) {
                router.push("/login");
                return;
            }

            try {
                const res = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (res.status === 401) {
                    localStorage.removeItem("token");
                    router.push("/login");
                    return;
                }

                if (!res.ok) {
                    console.warn("Auth check returned non-OK status, keeping session:", res.status);
                    return;
                }

                const userData = await res.json();
                setUser(userData);
            } catch (err) {
                console.warn("Auth check failed (network), keeping session:", err);
            }
        };
        checkAuth();

        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === "token") {
                if (!e.newValue) {
                    router.push("/login");
                } else {
                    checkAuth();
                }
            }
        };

        window.addEventListener("storage", handleStorageChange);
        return () => window.removeEventListener("storage", handleStorageChange);
    }, [router]);

    useEffect(() => {
        if (!user) return;

        const fetchRunning = async () => {
            try {
                const token = localStorage.getItem("token");
                const res = await fetch(`${API_BASE_URL}/api/v1/logs/running`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (res.ok) {
                    const data = await res.json();
                    setRunningProcesses(Array.isArray(data.running_tasks) ? data.running_tasks : []);
                }
            } catch { }
        };

        fetchRunning();
        const interval = setInterval(fetchRunning, 3000);
        return () => clearInterval(interval);
    }, [user]);

    const handleLogout = async () => {
        try {
            if (clerk?.signOut) await clerk.signOut();
        } catch (err) {
            console.error("Clerk signout error (non-fatal):", err);
        }
        localStorage.removeItem("token");
        toast.info("Logged out successfully");
        router.push("/login");
    };

    if (!user) return (
        <div className="flex h-screen items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4">
                <TerminalSquare className="h-6 w-6 text-muted-foreground animate-pulse" />
                <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">Loading Workspace</p>
            </div>
        </div>
    );

    const sidebarContent = (
        <>
            <div>
                <div className="flex items-center justify-between px-2 mb-10">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-md bg-secondary flex items-center justify-center border border-border">
                            <Briefcase className="h-4 w-4 text-foreground" />
                        </div>
                        <h1 className="text-xl font-medium tracking-tight text-foreground">JobHunt</h1>
                    </div>
                    <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <nav className="space-y-1">
                    {navigation.map((item) => {
                        const Icon = item.icon;
                        const isActive = item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href);
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
                            >
                                <Icon className="h-4 w-4" />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            <div className="px-3 pb-2 pt-6 border-t border-border mt-8 space-y-2">
                {runningProcesses.length > 0 && (
                    <Link href="/dashboard/logs" className="flex items-center gap-2.5 bg-secondary/80 py-2 px-3 rounded-md border border-border hover:bg-secondary transition-colors mb-2">
                        <Activity className="h-3.5 w-3.5 text-blue-400 animate-pulse" />
                        <span className="text-xs font-medium text-foreground truncate">
                            {runningProcesses.length} process{runningProcesses.length > 1 ? 'es' : ''} running
                        </span>
                    </Link>
                )}
                <button
                    onClick={() => window.dispatchEvent(new Event('trigger-tutorial'))}
                    className="group flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                >
                    <HelpCircle className="h-4 w-4 transition-colors" />
                    Help / Tutorials
                </button>
                <button
                    onClick={() => setFeedbackOpen(true)}
                    className="group flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                >
                    <MessageSquare className="h-4 w-4 transition-colors" />
                    Feedback
                </button>
                <div className="mt-4 pt-4 border-t border-border/50 space-y-2">
                    <div className="text-xs text-muted-foreground truncate font-medium bg-secondary py-2 px-3 rounded-md border border-border">{user.email}</div>
                    <button
                        onClick={handleLogout}
                        className="group flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-destructive transition-colors"
                    >
                        <LogOut className="h-4 w-4 transition-colors" />
                        Log out
                    </button>
                </div>
            </div>
        </>
    );

    return (
        <div className="flex h-screen w-full bg-background text-foreground font-sans selection:bg-secondary overflow-hidden">
            {/* Mobile top bar */}
            <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-14 bg-card border-b border-border lg:hidden">
                <div className="flex items-center gap-3">
                    <div className="h-7 w-7 rounded-md bg-secondary flex items-center justify-center border border-border">
                        <Briefcase className="h-3.5 w-3.5 text-foreground" />
                    </div>
                    <span className="text-base font-medium tracking-tight text-foreground">JobHunt</span>
                </div>
                <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                    <Menu className="h-5 w-5" />
                </button>
            </div>

            {/* Mobile overlay */}
            {sidebarOpen && (
                <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setSidebarOpen(false)}>
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                </div>
            )}

            {/* Sidebar */}
            <div className={`
                fixed lg:static inset-y-0 left-0 z-50
                w-64 h-full bg-card border-r border-border px-4 py-8 flex-shrink-0 flex flex-col justify-between
                transition-transform duration-300 ease-in-out
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
                {sidebarContent}
            </div>

            {/* Main Content */}
            <main className="flex-1 h-full overflow-y-auto w-full pt-14 lg:pt-0 bg-background relative">
                <div className="p-4 sm:p-6 lg:p-10">
                    {user && user.has_completed_onboarding === false && (
                        <OnboardingWizard user={user} onComplete={() => setUser({ ...user, has_completed_onboarding: true })} />
                    )}
                    {user && user.has_completed_onboarding === true && (
                        <TutorialOverlay />
                    )}
                    <div className="max-w-[1400px] mx-auto z-10 relative pt-4 sm:pt-4">
                        {children}
                    </div>
                </div>
            </main>

            <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
                <DialogContent className="sm:max-w-[425px] bg-card border-border/50 rounded-2xl shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-primary" />
                            Submit Feedback
                        </DialogTitle>
                        <DialogDescription>
                            Have an idea, caught a bug, or just want to share your thoughts? We&apos;re listening.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <Textarea
                            placeholder="Type your feedback here..."
                            className="bg-background/50 border-border/50 focus-visible:ring-primary min-h-[120px] rounded-xl"
                            value={feedbackText}
                            onChange={(e) => setFeedbackText(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            onClick={handleFeedbackSubmit}
                            disabled={!feedbackText.trim() || isSubmittingFeedback}
                            className="rounded-xl px-6"
                        >
                            {isSubmittingFeedback ? "Submitting..." : "Send Feedback"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
