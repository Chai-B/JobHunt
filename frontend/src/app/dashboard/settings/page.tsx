"use client";
import { API_BASE_URL } from "@/lib/config";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Settings, Database, BrainCircuit, Network, LayoutTemplate, Activity, Info, Globe, Mail } from "lucide-react";

import { GeneralPanel } from "@/components/settings/general-panel";
import { ScraperPanel } from "@/components/settings/scraper-panel";
import { AIPanel } from "@/components/settings/ai-panel";
import { EmailPanel } from "@/components/settings/email-panel";
import { DatabasePanel } from "@/components/settings/database-panel";
import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsPage() {
    const { replace } = require("next/navigation").useRouter ? require("next/navigation").useRouter() : { replace: () => { } };
    const searchParams = useSearchParams();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        gmail_connected: false,
        llm_provider: "gemini",
        gemini_api_keys: "",
        openai_api_key: "",
        llm_base_url: "",
        external_db_url: "",
        external_db_auth_key: "",
        smtp_server: "",
        smtp_port: "",
        smtp_username: "",
        smtp_password: "",
        target_roles: "Software Engineer, Full Stack Developer",
        target_locations: "Remote, USA",
        daily_apply_limit: "10",
        scrape_frequency_hours: "24",
        auto_scrape_urls: "",
        preferred_model: "gemini-1.5-flash",
        cover_letter_tone: "professional",
        max_email_per_day: "20",
        use_gmail_for_send: false,
        auto_apply_enabled: false,
        cold_mail_automation_enabled: false,
    });

    useEffect(() => {
        const fetchSettings = async () => {
            const token = localStorage.getItem("token");
            if (!token) return;
            try {
                const res = await fetch(`${API_BASE_URL}/api/v1/settings/me`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) throw new Error("Failed to fetch settings");
                const data = await res.json();
                setFormData({
                    gmail_connected: !!data.gmail_access_token,
                    llm_provider: data.llm_provider || "gemini",
                    gemini_api_keys: data.gemini_api_keys || "",
                    openai_api_key: data.openai_api_key || "",
                    llm_base_url: data.llm_base_url || "",
                    external_db_url: data.external_db_url || "",
                    external_db_auth_key: data.external_db_auth_key || "",
                    smtp_server: data.smtp_server || "",
                    smtp_port: data.smtp_port?.toString() || "",
                    smtp_username: data.smtp_username || "",
                    smtp_password: "",
                    target_roles: data.target_roles || "Software Engineer, Full Stack Developer",
                    target_locations: data.target_locations || "Remote, USA",
                    daily_apply_limit: data.daily_apply_limit?.toString() || "10",
                    scrape_frequency_hours: data.scrape_frequency_hours?.toString() || "24",
                    auto_scrape_urls: data.auto_scrape_urls || "",
                    preferred_model: data.preferred_model || "gemini-1.5-flash",
                    cover_letter_tone: data.cover_letter_tone || "professional",
                    max_email_per_day: data.max_email_per_day?.toString() || "20",
                    use_gmail_for_send: data.use_gmail_for_send || false,
                    auto_apply_enabled: data.auto_apply_enabled || false,
                    cold_mail_automation_enabled: data.cold_mail_automation_enabled || false,
                });
            } catch (err: any) {
                toast.error(err.message);
            } finally {
                // Smooth delay for UX
                setTimeout(() => setLoading(false), 400);
            }
        };
        fetchSettings();

        // Check for Google OAuth Callback Success
        if (searchParams?.get("gmail") === "connected") {
            toast.success("Gmail connected successfully!");
            // Clean up the URL
            if (typeof window !== "undefined") {
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        }
    }, [searchParams]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        const token = localStorage.getItem("token");
        const payload: any = { ...formData };
        payload.smtp_port = payload.smtp_port ? parseInt(payload.smtp_port) : null;
        payload.daily_apply_limit = parseInt(payload.daily_apply_limit);
        payload.scrape_frequency_hours = parseInt(payload.scrape_frequency_hours);
        payload.max_email_per_day = parseInt(payload.max_email_per_day);

        try {
            const res = await fetch(`${API_BASE_URL}/api/v1/settings/me`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error("Failed to update settings");
            toast.success("Settings saved successfully.");
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleGmailConnect = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/v1/gmail/connect`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Could not initialize Gmail connect sequence.");
            const data = await res.json();
            window.location.href = data.auth_url; // Redirect to Google Consent
        } catch (e: any) {
            toast.error(e.message);
        }
    };

    if (loading) return (
        <div className="max-w-5xl space-y-8 p-10">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-4 w-64" />
            <div className="space-y-6 mt-10">
                <Skeleton className="h-[200px] w-full rounded-xl" />
                <Skeleton className="h-[200px] w-full rounded-xl" />
                <Skeleton className="h-[200px] w-full rounded-xl" />
            </div>
        </div>
    );
    return (
        <div className="max-w-5xl space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 relative pb-20">
            <div>
                <h1 className="text-3xl font-semibold tracking-tight text-foreground flex items-center gap-3">
                    <Settings className="w-7 h-7" />
                    Settings
                </h1>
                <p className="text-sm text-muted-foreground mt-2 max-w-2xl">Manage your application, automation, and integration preferences.</p>
            </div>

            <form onSubmit={handleSave} className="space-y-8">
                {/* Security Notice */}
                <div className="flex items-start gap-4 p-5 bg-secondary/30 border border-border rounded-xl text-sm">
                    <div className="h-10 w-10 bg-secondary rounded-lg flex items-center justify-center shrink-0 border border-border mt-0.5">
                        <Info className="w-5 h-5 text-foreground" />
                    </div>
                    <div>
                        <p className="font-semibold text-foreground">Secure Vault Integration</p>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                            API keys and credentials are encrypted at rest and never leave your environment. They are used exclusively for server-side processing and are never exposed to the client or third parties.
                        </p>
                    </div>
                </div>

                <GeneralPanel formData={formData} handleChange={handleChange} />
                <ScraperPanel formData={formData} handleChange={handleChange} />
                <AIPanel formData={formData} handleChange={handleChange} />
                <EmailPanel formData={formData} handleChange={handleChange} />
                <DatabasePanel formData={formData} handleChange={handleChange} />

                {/* Additional Agent Options */}
                <div className="p-6 bg-card border border-border rounded-xl shadow-sm space-y-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Mail className="w-5 h-5 text-foreground" />
                        <h2 className="text-lg font-semibold">Gmail & Automation Integrations</h2>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <Label className="text-sm font-medium">Connect Gmail Account</Label>
                            <p className="text-xs text-muted-foreground">Authorize JobHunt to send cold mail directly via your Gmail.</p>
                            {formData.gmail_connected ? (
                                <div className="w-full flex items-center justify-center gap-2 h-9 rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-sm font-medium">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                    Gmail Connected
                                </div>
                            ) : (
                                <Button type="button" variant="outline" onClick={handleGmailConnect} className="w-full">
                                    Connect Gmail API
                                </Button>
                            )}
                        </div>

                        <div className="space-y-4">
                            <Label className="text-sm font-medium">Use Gmail for Cold Emailing</Label>
                            <div className="flex items-center gap-3 mt-2">
                                <Input type="checkbox" name="use_gmail_for_send" checked={formData.use_gmail_for_send} onChange={(e) => setFormData({ ...formData, use_gmail_for_send: e.target.checked })} className="w-4 h-4 cursor-pointer" />
                                <span className="text-sm text-foreground">Enabled</span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <Label className="text-sm font-medium">Automate Background Playwright Applications</Label>
                            <div className="flex items-center gap-3 mt-2">
                                <Input type="checkbox" name="auto_apply_enabled" checked={formData.auto_apply_enabled} onChange={(e) => setFormData({ ...formData, auto_apply_enabled: e.target.checked })} className="w-4 h-4 cursor-pointer" />
                                <span className="text-sm text-foreground">Enabled</span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <Label className="text-sm font-medium">Automate Cold Mailing (AI Pipeline)</Label>
                            <div className="flex items-center gap-3 mt-2">
                                <Input type="checkbox" name="cold_mail_automation_enabled" checked={formData.cold_mail_automation_enabled} onChange={(e) => setFormData({ ...formData, cold_mail_automation_enabled: e.target.checked })} className="w-4 h-4 cursor-pointer" />
                                <span className="text-sm text-foreground">Enabled</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-6">
                    <Button type="submit" disabled={saving} className="h-12 px-10 bg-foreground hover:opacity-90 text-background font-semibold transition-all rounded-lg shadow-lg">
                        {saving ? "Saving Changes..." : "Save Settings"}
                    </Button>
                </div>
            </form>
        </div>
    );
}
