"use client";
import { API_BASE_URL } from "@/lib/config";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { User, Link as LinkIcon, BriefcaseBusiness, Activity, Info, Bot } from "lucide-react";

const Tip = ({ text }: { text: string }) => (
    <span className="relative inline-flex items-center ml-1.5 cursor-help group/tip">
        <Info className="w-3.5 h-3.5 text-muted-foreground/60 group-hover/tip:text-foreground transition-colors" />
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 text-xs text-foreground bg-card border border-border rounded-lg shadow-lg opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all duration-200 pointer-events-none z-50 leading-relaxed">
            {text}
        </span>
    </span>
);

export default function ProfilePage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        full_name: "",
        phone: "",
        linkedin_url: "",
        github_url: "",
        portfolio_url: "",
        location: "",
        bio: "",
        skills: "",
        experience_years: "",
        education: "",
    });
    const router = useRouter();

    useEffect(() => {
        const fetchProfile = async () => {
            const token = localStorage.getItem("token");
            if (!token) return;

            try {
                const res = await fetch(`${API_BASE_URL}/api/v1/users/me`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) throw new Error("Failed to fetch profile");

                const data = await res.json();
                setFormData({
                    full_name: data.full_name || "",
                    phone: data.phone || "",
                    linkedin_url: data.linkedin_url || "",
                    github_url: data.github_url || "",
                    portfolio_url: data.portfolio_url || "",
                    location: data.location || "",
                    bio: data.bio || "",
                    skills: data.skills || "",
                    experience_years: data.experience_years?.toString() || "",
                    education: data.education || "",
                });
            } catch (err: any) {
                toast.error(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        const token = localStorage.getItem("token");

        try {
            const res = await fetch(`${API_BASE_URL}/api/v1/users/me`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    ...formData,
                    experience_years: formData.experience_years ? parseInt(formData.experience_years) : null
                }),
            });
            if (!res.ok) throw new Error("Failed to update profile");
            toast.success("Profile updated successfully.");
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleAutoFill = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const rs = await fetch(`${API_BASE_URL}/api/v1/resumes/`, { headers: { Authorization: `Bearer ${token}` } });
            const rData = await rs.json();
            if (!rData.items || rData.items.length === 0) throw new Error("Please upload a resume first.");

            const extractRes = await fetch(`${API_BASE_URL}/api/v1/resumes/${rData.items[0].id}/extract-to-profile`, {
                method: "POST", headers: { Authorization: `Bearer ${token}` }
            });
            if (!extractRes.ok) {
                const errData = await extractRes.json();
                throw new Error(errData.detail || "Extraction failed - ensure Gemini Key is saved in Settings.");
            }
            const ed = await extractRes.json();
            setFormData(prev => ({
                ...prev,
                full_name: ed.full_name || prev.full_name,
                phone: ed.phone || prev.phone,
                location: ed.location || prev.location,
                bio: ed.bio || prev.bio,
                linkedin_url: ed.linkedin_url || prev.linkedin_url,
                skills: ed.skills || prev.skills,
                experience_years: ed.experience_years?.toString() || prev.experience_years,
                education: ed.education || prev.education,
            }));
            toast.success("Form filled! Review values and Save.");
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-10 flex items-center justify-center text-muted-foreground"><Activity className="w-5 h-5 mr-3 animate-pulse" /> Loading profile data...</div>;

    const inputClass = "bg-background border-border focus-visible:ring-ring text-foreground h-11 w-full rounded-md shadow-sm transition-colors focus:border-ring placeholder:text-muted-foreground";
    const labelClass = "text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium mb-1.5 flex items-center";

    return (
        <div className="max-w-5xl space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 relative pb-20">
            <div>
                <h1 className="text-3xl font-semibold tracking-tight text-foreground flex items-center gap-3">
                    <User className="w-7 h-7" />
                    Profile
                </h1>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
                    <p className="text-sm text-muted-foreground max-w-2xl">Manage your personal information and links used for job applications.</p>
                    <Button type="button" variant="outline" onClick={handleAutoFill} disabled={loading} className="gap-2 self-start sm:self-auto shadow-sm">
                        <Bot className="w-4 h-4" /> AI Auto-Fill from Latest Resume
                    </Button>
                </div>
            </div>

            <form onSubmit={handleSave} className="space-y-10">

                {/* Personal Information Structure */}
                <div className="p-8 bg-card border border-border shadow-sm rounded-xl relative overflow-hidden group">
                    <div className="relative z-10 mb-8 border-b border-border pb-5">
                        <h3 className="text-xl font-semibold text-foreground flex items-center gap-2"><BriefcaseBusiness className="w-5 h-5" /> Personal Details</h3>
                        <p className="text-xs text-muted-foreground mt-2">Essential information used for application fields.</p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-x-8 gap-y-6 relative z-10">
                        <div>
                            <Label htmlFor="full_name" className={labelClass}>Full Name <Tip text="Used as {{user_name}} in email templates and auto-generated cover letters." /></Label>
                            <Input id="full_name" name="full_name" value={formData.full_name} onChange={handleChange} placeholder="John Doe" className={inputClass} />
                        </div>
                        <div>
                            <Label htmlFor="phone" className={labelClass}>Phone Number <Tip text="Included in your auto-apply submissions and accessible via {{user_phone}} in templates." /></Label>
                            <Input id="phone" name="phone" value={formData.phone} onChange={handleChange} placeholder="+1 555-0100" className={inputClass} />
                        </div>
                        <div>
                            <Label htmlFor="location" className={labelClass}>Location <Tip text="Used to prioritize geographically matching roles and referenced as {{user_location}} in templates." /></Label>
                            <Input id="location" name="location" value={formData.location} onChange={handleChange} placeholder="San Francisco, CA" className={inputClass} />
                        </div>
                        <div>
                            <Label htmlFor="experience_years" className={labelClass}>Years of Experience <Tip text="Total professional experience. Used for role qualification checks." /></Label>
                            <Input id="experience_years" name="experience_years" type="number" value={formData.experience_years} onChange={handleChange} placeholder="5" className={inputClass} />
                        </div>
                        <div className="md:col-span-2">
                            <Label htmlFor="education" className={labelClass}>Education <Tip text="Latest degree or certification. Referenced as {{education}} in templates." /></Label>
                            <Input id="education" name="education" value={formData.education} onChange={handleChange} placeholder="B.S. Computer Science, Stanford University" className={inputClass} />
                        </div>
                        <div className="md:col-span-2">
                            <Label htmlFor="skills" className={labelClass}>Technical Skills <Tip text="Comma-separated skills used for AI matching and referenced as {{skills}} in templates." /></Label>
                            <Input id="skills" name="skills" value={formData.skills} onChange={handleChange} placeholder="React, TypeScript, Python, Node.js, AWS" className={inputClass} />
                        </div>
                        <div className="md:col-span-2">
                            <Label htmlFor="bio" className={labelClass}>Professional Bio <Tip text="A brief professional summary. The AI uses this to personalize cover letters and cold emails on your behalf." /></Label>
                            <Textarea
                                id="bio"
                                name="bio"
                                rows={4}
                                value={formData.bio}
                                onChange={handleChange}
                                placeholder="I am a software engineer with 5+ years of experience..."
                                className="bg-background border-border focus-visible:ring-ring text-foreground w-full rounded-md shadow-sm transition-colors focus:border-ring placeholder:text-muted-foreground resize-none p-4 leading-relaxed mt-1"
                            />
                        </div>
                    </div>
                </div>

                {/* Professional Links Structure */}
                <div className="p-8 bg-card border border-border shadow-sm rounded-xl relative overflow-hidden group">
                    <div className="relative z-10 mb-8 border-b border-border pb-5">
                        <h3 className="text-xl font-semibold text-foreground flex items-center gap-2"><LinkIcon className="w-5 h-5" /> Professional Links</h3>
                        <p className="text-xs text-muted-foreground mt-2">Your online presence for applications.</p>
                    </div>

                    <div className="grid gap-6 relative z-10">
                        <div>
                            <Label htmlFor="linkedin_url" className={labelClass}>LinkedIn URL <Tip text="Included in outreach emails via {{linkedin}} and auto-apply forms. Keep this updated for best results." /></Label>
                            <Input id="linkedin_url" name="linkedin_url" value={formData.linkedin_url} onChange={handleChange} placeholder="https://linkedin.com/in/username" className={inputClass} />
                        </div>
                        <div>
                            <Label htmlFor="github_url" className={labelClass}>GitHub URL <Tip text="Referenced as {{github}} in templates. Great for technical roles where code samples are expected." /></Label>
                            <Input id="github_url" name="github_url" value={formData.github_url} onChange={handleChange} placeholder="https://github.com/username" className={inputClass} />
                        </div>
                        <div>
                            <Label htmlFor="portfolio_url" className={labelClass}>Portfolio URL <Tip text="Your personal website, accessible as {{portfolio}} in templates. Designers and creators should keep this current." /></Label>
                            <Input id="portfolio_url" name="portfolio_url" value={formData.portfolio_url} onChange={handleChange} placeholder="https://yourwebsite.com" className={inputClass} />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={saving} className="h-12 px-8 bg-foreground hover:opacity-90 text-background font-medium transition-opacity rounded-md">
                        {saving ? "Saving..." : "Save Profile"}
                    </Button>
                </div>
            </form>
        </div>
    );
}
