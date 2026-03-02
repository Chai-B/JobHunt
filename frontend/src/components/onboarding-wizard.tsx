"use client";

import { useState } from "react";
import { API_BASE_URL } from "@/lib/config";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Sparkles, User, Settings as SettingsIcon, CheckCircle2, Info, Briefcase } from "lucide-react";

const Tip = ({ text }: { text: string }) => (
    <span className="relative inline-flex items-center ml-1.5 cursor-help group/tip">
        <Info className="w-3.5 h-3.5 text-muted-foreground/60 group-hover/tip:text-foreground transition-colors" />
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 text-xs text-foreground bg-card border border-border rounded-lg shadow-lg opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all duration-200 pointer-events-none z-50 leading-relaxed font-sans normal-case tracking-normal">
            {text}
        </span>
    </span>
);

export function OnboardingWizard({ user, onComplete }: { user: any, onComplete: () => void }) {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Step 1: Profile
    const [fullName, setFullName] = useState(user?.full_name || "");
    const [bio, setBio] = useState(user?.bio || "");
    const [location, setLocation] = useState(user?.location || "");

    // Step 2: Links
    const [linkedin, setLinkedin] = useState(user?.linkedin_url || "");
    const [github, setGithub] = useState(user?.github_url || "");

    const handleComplete = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/v1/users/me`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    full_name: fullName,
                    bio,
                    location,
                    linkedin_url: linkedin,
                    github_url: github,
                    has_completed_onboarding: true
                })
            });

            if (!res.ok) throw new Error("Failed to save profile.");
            toast.success("Welcome to JobHunt!");
            onComplete();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    const nextStep = () => setStep(s => Math.min(3, s + 1));
    const prevStep = () => setStep(s => Math.max(1, s - 1));

    return (
        <Dialog open={true} onOpenChange={() => { }}>
            <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-card border-border">
                {/* Progress Bar */}
                <div className="w-full bg-secondary h-1.5 flex">
                    <div className="bg-foreground h-full transition-all duration-300" style={{ width: `${(step / 3) * 100}%` }} />
                </div>

                <div className="p-6">
                    <DialogHeader className="mb-6">
                        <DialogTitle className="text-2xl font-medium tracking-tight text-foreground flex items-center gap-3">
                            {step === 1 && <><User className="w-6 h-6 text-foreground" /> Complete Profile</>}
                            {step === 2 && <><SettingsIcon className="w-6 h-6 text-foreground" /> Professional Links</>}
                            {step === 3 && <><Sparkles className="w-6 h-6 text-foreground" /> Welcome to JobHunt</>}
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground mt-2">
                            {step === 1 && "Basic information to help the engine tailor your application strategy."}
                            {step === 2 && "Links to your social and professional presence for one-click applications."}
                            {step === 3 && "Your configuration is complete. You can now start using the scraping engine."}
                        </DialogDescription>
                    </DialogHeader>

                    {step === 1 && (
                        <div className="space-y-4 animate-in slide-in-from-right-2">
                            <div className="space-y-4">
                                <div>
                                    <Label className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium mb-1.5 flex items-center">Full Name <Tip text="Display name used in dashboard." /></Label>
                                    <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Doe" className="bg-background border-border h-11" />
                                </div>
                                <div>
                                    <Label className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium mb-1.5 flex items-center">Location <Tip text="Preferred work locations (e.g. Remote, NY)." /></Label>
                                    <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="New York, NY (or Remote)" className="bg-background border-border h-11" />
                                </div>
                                <div>
                                    <Label className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium mb-1.5 flex items-center">Short Pitch <Tip text="Brief elevator pitch for automated outreach." /></Label>
                                    <Textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="I am a Full Stack Developer with 4 years of experience..." className="h-24 bg-background border-border resize-none" />
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4 animate-in slide-in-from-right-2">
                            <div className="space-y-2">
                                <Label>LinkedIn URL</Label>
                                <Input value={linkedin} onChange={e => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/username" className="bg-background" />
                            </div>
                            <div className="space-y-2">
                                <Label>GitHub / Portfolio</Label>
                                <Input value={github} onChange={e => setGithub(e.target.value)} placeholder="https://github.com/username" className="bg-background" />
                            </div>
                            <div className="p-4 bg-secondary/30 rounded-xl border border-border mt-4">
                                <p className="text-xs text-muted-foreground flex items-start gap-3 leading-relaxed">
                                    <Info className="w-4 h-4 text-foreground shrink-0 mt-0.5" />
                                    These links hydrate the {"{{linkedin}}"} and {"{{github}}"} variables in your automated outreach templates.
                                </p>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="py-8 flex flex-col items-center justify-center text-center animate-in zoom-in-95">
                            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
                                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                            </div>
                            <h3 className="text-xl font-medium mb-2">Profile Configured</h3>
                            <p className="text-sm text-muted-foreground max-w-[280px]">
                                Your dashboard is ready. You can always update these details later in Settings.
                            </p>
                        </div>
                    )}

                    <DialogFooter className="mt-8 flex justify-between sm:justify-between items-center pt-6 border-t border-border">
                        <div>
                            {step > 1 && (
                                <Button variant="outline" onClick={prevStep} disabled={loading} className="border-border text-foreground hover:bg-secondary">Back</Button>
                            )}
                        </div>
                        <div>
                            {step < 3 ? (
                                <Button onClick={nextStep} className="bg-foreground text-background hover:opacity-90 font-medium px-8">Continue</Button>
                            ) : (
                                <Button disabled={loading} onClick={handleComplete} className="bg-foreground text-background hover:opacity-90 font-medium px-8 shadow-lg transition-all">
                                    {loading ? "Initializing..." : "Proceed to Dashboard"}
                                </Button>
                            )}
                        </div>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}
