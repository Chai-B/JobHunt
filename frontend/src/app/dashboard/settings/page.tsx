"use client";
import { API_BASE_URL } from "@/lib/config";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Settings, Database, BrainCircuit, Network, LayoutTemplate, Activity, Info, Globe } from "lucide-react";

const Tip = ({ text }: { text: string }) => (
    <span className="relative inline-flex items-center ml-1.5 cursor-help group/tip">
        <Info className="w-3.5 h-3.5 text-muted-foreground/60 group-hover/tip:text-foreground transition-colors" />
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 text-xs text-foreground bg-card border border-border rounded-lg shadow-lg opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all duration-200 pointer-events-none z-50 leading-relaxed">
            {text}
        </span>
    </span>
);

export default function SettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        gemini_api_keys: "",
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
                    gemini_api_keys: data.gemini_api_keys || "",
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
                });
            } catch (err: any) {
                toast.error(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

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

    if (loading) return <div className="p-10 flex items-center justify-center text-muted-foreground"><Activity className="w-5 h-5 mr-3 animate-pulse" /> Loading settings...</div>;

    const inputClass = "bg-background border-border focus-visible:ring-ring text-foreground h-11 w-full rounded-md shadow-sm transition-colors focus:border-ring placeholder:text-muted-foreground";
    const labelClass = "text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium mb-1.5 flex items-center";

    return (
        <div className="max-w-5xl space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 relative">
            <div>
                <h1 className="text-3xl font-semibold tracking-tight text-foreground flex items-center gap-3">
                    <Settings className="w-7 h-7" />
                    Settings
                </h1>
                <p className="text-sm text-muted-foreground mt-2 max-w-2xl">Manage your application, automation, and integration preferences.</p>
            </div>

            <form onSubmit={handleSave} className="space-y-8 pb-20">

                {/* Application Preferences Section */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 p-8 bg-card border border-border shadow-sm rounded-xl relative overflow-hidden group">
                    <div className="col-span-1 lg:col-span-1 lg:border-r border-border pr-6 relative z-10">
                        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2"><LayoutTemplate className="w-4 h-4" /> Application Preferences</h3>
                        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">Configure the targets for job matching and automated applications.</p>
                    </div>
                    <div className="col-span-3 grid gap-6 relative z-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <Label htmlFor="target_roles" className={labelClass}>Target Roles <Tip text="Comma-separated list of job titles the system will prioritize when matching jobs to your resume." /></Label>
                                <Input id="target_roles" name="target_roles" value={formData.target_roles} onChange={handleChange} className={inputClass} placeholder="e.g. Founder, CEO" />
                            </div>
                            <div>
                                <Label htmlFor="target_locations" className={labelClass}>Target Locations <Tip text="Comma-separated list of preferred cities or regions. Use 'Remote' for remote-only roles." /></Label>
                                <Input id="target_locations" name="target_locations" value={formData.target_locations} onChange={handleChange} className={inputClass} placeholder="Remote, USA" />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <Label htmlFor="daily_apply_limit" className={labelClass}>Daily Auto-Apply Limit <Tip text="Maximum number of applications the AI agent will automatically submit per day via the auto-apply engine." /></Label>
                                <Input id="daily_apply_limit" name="daily_apply_limit" type="number" value={formData.daily_apply_limit} onChange={handleChange} className={inputClass} />
                            </div>
                            <div>
                                <Label htmlFor="cover_letter_tone" className={labelClass}>Cover Letter Tone <Tip text="The AI will generate cover letters matching this writing style. E.g., 'professional', 'casual', 'enthusiastic'." /></Label>
                                <Input id="cover_letter_tone" name="cover_letter_tone" value={formData.cover_letter_tone} onChange={handleChange} className={inputClass} placeholder="professional" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Scraper Configuration Section */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 p-8 bg-card border border-border shadow-sm rounded-xl relative overflow-hidden group">
                    <div className="col-span-1 lg:col-span-1 lg:border-r border-border pr-6 relative z-10">
                        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2"><Globe className="w-4 h-4" /> Scraper Configuration</h3>
                        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">Configure which sites to scrape automatically and how often.</p>
                    </div>
                    <div className="col-span-3 grid gap-6 relative z-10">
                        <div>
                            <Label htmlFor="auto_scrape_urls" className={labelClass}>Auto-Scrape Target URLs <Tip text="Comma-separated list of URLs the background scraper will automatically target on its scheduled cycle. Leave blank to use defaults (RemoteOK, YC Jobs)." /></Label>
                            <textarea
                                id="auto_scrape_urls" name="auto_scrape_urls" value={formData.auto_scrape_urls} onChange={handleChange}
                                className="flex min-h-[100px] w-full rounded-md border border-border bg-background px-3 py-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors font-mono text-xs"
                                placeholder={"https://remoteok.com/remote-jobs\nhttps://news.ycombinator.com/jobs\nhttps://example.com/careers"}
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <Label htmlFor="scrape_frequency_hours" className={labelClass}>Scrape Interval (Hours) <Tip text="How often the background agent runs a scraping cycle on your configured URLs. Lower values mean more frequent updates." /></Label>
                                <Input id="scrape_frequency_hours" name="scrape_frequency_hours" type="number" value={formData.scrape_frequency_hours} onChange={handleChange} className={inputClass} />
                            </div>
                            <div>
                                <Label htmlFor="max_email_per_day" className={labelClass}>Max Emails Per Day <Tip text="Maximum number of cold emails the system will send per day via SMTP to avoid being flagged as spam." /></Label>
                                <Input id="max_email_per_day" name="max_email_per_day" type="number" value={formData.max_email_per_day} onChange={handleChange} className={inputClass} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* AI / LLM Integration Section */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 p-8 bg-card border border-border shadow-sm rounded-xl relative overflow-hidden group">
                    <div className="col-span-1 lg:col-span-1 lg:border-r border-border pr-6 relative z-10">
                        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2"><BrainCircuit className="w-4 h-4" /> AI Integrations</h3>
                        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">Provide your API keys. Comma separation enables automatic round-robin key rotation.</p>
                    </div>
                    <div className="col-span-3 grid gap-6 relative z-10">
                        <div>
                            <Label htmlFor="gemini_api_keys" className={labelClass}>Gemini API Keys <Tip text="Your Google Gemini API keys. Provide multiple keys separated by commas to enable automatic round-robin rotation when one key hits rate limits." /></Label>
                            <Input id="gemini_api_keys" name="gemini_api_keys" value={formData.gemini_api_keys} onChange={handleChange} type="password" placeholder="AIzaSyA..., AIzaSyB..." className={`${inputClass} font-mono`} />
                        </div>
                        <div>
                            <Label htmlFor="preferred_model" className={labelClass}>Preferred AI Model <Tip text="The default Gemini model to use for AI tasks. 'gemini-1.5-flash' is faster and cheaper; 'gemini-1.5-pro' is more accurate for complex reasoning." /></Label>
                            <select id="preferred_model" name="preferred_model" value={formData.preferred_model} onChange={handleChange} className={`${inputClass} px-3 appearance-none cursor-pointer`}>
                                <option value="gemini-1.5-flash">Gemini 1.5 Flash (Fast)</option>
                                <option value="gemini-1.5-pro">Gemini 1.5 Pro (Accurate)</option>
                                <option value="gemini-2.0-flash">Gemini 2.0 Flash (Latest)</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* SMTP Setup Section */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 p-8 bg-card border border-border shadow-sm rounded-xl relative overflow-hidden group">
                    <div className="col-span-1 lg:col-span-1 lg:border-r border-border pr-6 relative z-10">
                        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2"><Network className="w-4 h-4" /> Email Configuration</h3>
                        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">SMTP credentials for automated emails and cold outreach.</p>
                    </div>
                    <div className="col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                        <div>
                            <Label htmlFor="smtp_server" className={labelClass}>SMTP Server <Tip text="Your email provider's SMTP server address. Gmail: smtp.gmail.com, Outlook: smtp-mail.outlook.com." /></Label>
                            <Input id="smtp_server" name="smtp_server" value={formData.smtp_server} onChange={handleChange} placeholder="smtp.gmail.com" className={inputClass} />
                        </div>
                        <div>
                            <Label htmlFor="smtp_port" className={labelClass}>SMTP Port <Tip text="SMTP port. Most providers use 587 (TLS) or 465 (SSL)." /></Label>
                            <Input id="smtp_port" name="smtp_port" value={formData.smtp_port} onChange={handleChange} placeholder="587" type="number" className={inputClass} />
                        </div>
                        <div>
                            <Label htmlFor="smtp_username" className={labelClass}>SMTP Username <Tip text="Usually the full email address you want to send from." /></Label>
                            <Input id="smtp_username" name="smtp_username" value={formData.smtp_username} onChange={handleChange} placeholder="agent@startup.com" className={inputClass} />
                        </div>
                        <div>
                            <Label htmlFor="smtp_password" className={labelClass}>SMTP Password <Tip text="For Gmail, use an App Password. Go to Google Account > Security > App Passwords." /></Label>
                            <Input id="smtp_password" name="smtp_password" value={formData.smtp_password} onChange={handleChange} type="password" placeholder="••••••••••••" className={`${inputClass} font-mono`} />
                        </div>
                    </div>
                </div>

                {/* Personal Override DB Section */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 p-8 bg-card border border-border shadow-sm rounded-xl relative overflow-hidden group">
                    <div className="col-span-1 lg:col-span-1 lg:border-r border-border pr-6 relative z-10">
                        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2"><Database className="w-4 h-4" /> External Database</h3>
                        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">Sync your personal data to an external PostgreSQL database.</p>
                    </div>
                    <div className="col-span-3 grid gap-6 relative z-10">
                        <div>
                            <Label htmlFor="external_db_url" className={labelClass}>Database URL (DSN) <Tip text="A PostgreSQL connection string (e.g., from Supabase or Neon). Your personal applications and resumes will be synced here if configured." /></Label>
                            <Input id="external_db_url" name="external_db_url" value={formData.external_db_url} onChange={handleChange} placeholder="postgresql://user:password@host/db" className={`${inputClass} font-mono text-sm`} />
                        </div>
                        <div>
                            <Label htmlFor="external_db_auth_key" className={labelClass}>Authentication Key <Tip text="Optional JWT or API key for authenticating with your external database provider." /></Label>
                            <Input id="external_db_auth_key" name="external_db_auth_key" value={formData.external_db_auth_key} onChange={handleChange} type="password" placeholder="eyJhbGci..." className={`${inputClass} font-mono text-sm`} />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={saving} className="h-12 px-8 bg-foreground hover:opacity-90 text-background font-medium transition-opacity rounded-md">
                        {saving ? "Saving..." : "Save Settings"}
                    </Button>
                </div>
            </form>
        </div>
    );
}
