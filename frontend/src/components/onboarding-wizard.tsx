"use client";

import { useState } from "react";
import { API_BASE_URL } from "@/lib/config";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Sparkles, User, Settings as SettingsIcon, CheckCircle2 } from "lucide-react";

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
                        <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                            {step === 1 && <><User className="w-6 h-6 text-emerald-500" /> Complete Your Profile</>}
                            {step === 2 && <><SettingsIcon className="w-6 h-6 text-blue-500" /> Connect Your Links</>}
                            {step === 3 && <><Sparkles className="w-6 h-6 text-purple-500" /> All Set!</>}
                        </DialogTitle>
                        <DialogDescription>
                            {step === 1 && "Tell us about yourself. This helps the AI generate accurate outreach templates."}
                            {step === 2 && "Add your professional links so they auto-populate in your pitches."}
                            {step === 3 && "You're ready to start using the deep web scrapers and AI agents."}
                        </DialogDescription>
                    </DialogHeader>

                    {step === 1 && (
                        <div className="space-y-4 animate-in slide-in-from-right-2">
                            <div className="space-y-2">
                                <Label>Full Name</Label>
                                <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Doe" className="bg-background" />
                            </div>
                            <div className="space-y-2">
                                <Label>Location</Label>
                                <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="New York, NY (or Remote)" className="bg-background" />
                            </div>
                            <div className="space-y-2">
                                <Label>Short Pitch / Bio</Label>
                                <Textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="I am a Full Stack Developer with 4 years of experience..." className="h-24 bg-background resize-none" />
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
                            <div className="p-4 bg-secondary/50 rounded-md border border-border mt-4">
                                <p className="text-xs text-muted-foreground flex items-center gap-2">
                                    <Sparkles className="w-3.5 h-3.5" />
                                    These links will automatically fill the {"{{linkedin}}"} and {"{{github}}"} variables in your AI templates.
                                </p>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="py-8 flex flex-col items-center justify-center text-center animate-in zoom-in-95">
                            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
                                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                            </div>
                            <h3 className="text-xl font-bold mb-2">Profile Configured</h3>
                            <p className="text-sm text-muted-foreground max-w-[280px]">
                                Your dashboard is ready. You can always update these details later in Settings.
                            </p>
                        </div>
                    )}

                    <DialogFooter className="mt-8 flex justify-between sm:justify-between items-center">
                        <div>
                            {step > 1 && (
                                <Button variant="ghost" onClick={prevStep} disabled={loading}>Back</Button>
                            )}
                        </div>
                        <div>
                            {step < 3 ? (
                                <Button onClick={nextStep} className="bg-foreground text-background">Continue</Button>
                            ) : (
                                <Button disabled={loading} onClick={handleComplete} className="bg-emerald-500 text-white hover:bg-emerald-600">
                                    {loading ? "Saving..." : "Go to Dashboard"}
                                </Button>
                            )}
                        </div>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}
