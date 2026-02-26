"use client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Network, Info, Mail, Sparkles, RefreshCw } from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const Tip = ({ text }: { text: string }) => (
    <span className="relative inline-flex items-center ml-1.5 cursor-help group/tip">
        <Info className="w-3.5 h-3.5 text-muted-foreground/60 group-hover/tip:text-foreground transition-colors" />
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 text-xs text-foreground bg-card border border-border rounded-lg shadow-lg opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all duration-200 pointer-events-none z-50 leading-relaxed">
            {text}
        </span>
    </span>
);

export function EmailPanel({ formData, handleChange, setFormData, handleGmailConnect }: { formData: any, handleChange: any, setFormData: any, handleGmailConnect: any }) {
    const inputClass = "bg-background border-border focus-visible:ring-ring text-foreground h-11 w-full rounded-md shadow-sm transition-colors focus:border-ring placeholder:text-muted-foreground";
    const labelClass = "text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium mb-1.5 flex items-center";

    return (
        <div className="flex flex-col gap-8">
            {/* Primary Integration: Gmail & Automation */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-10 p-8 bg-card border border-border shadow-sm rounded-xl relative overflow-hidden group">
                <div className="col-span-1 lg:col-span-1 lg:border-r border-border pr-6 relative z-10 flex flex-col gap-2">
                    <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" /> Connectivity
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">Gmail OAuth and pipeline automation.</p>
                </div>
                <div className="col-span-1 lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-10 relative z-10">

                    {/* Gmail Connection Column */}
                    <div className="space-y-6">
                        <div className="space-y-4">
                            <Label className={labelClass}>Connect Gmail Account</Label>
                            <p className="text-xs text-muted-foreground">Authorize JobHunt to send cold mail directly via your Gmail.</p>
                            {formData.gmail_connected ? (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <button type="button" className="w-full flex items-center justify-center gap-2 h-11 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 text-sm font-medium transition-colors cursor-pointer">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                            Gmail Connected
                                        </button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="bg-card border-border text-foreground">
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Re-authenticate Gmail?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                You are already connected to Gmail. Do you want to re-authenticate or connect a different account?
                                                This will redirect you to Google to select an account.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel className="bg-transparent border-border text-foreground hover:bg-secondary">Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleGmailConnect} className="bg-foreground hover:opacity-90 text-background">
                                                Re-authenticate
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            ) : (
                                <button type="button" onClick={handleGmailConnect} className="bg-background border-border focus-visible:ring-ring text-foreground hover:bg-muted h-11 px-4 py-2 w-full rounded-md shadow-sm transition-colors border text-sm font-medium">
                                    Connect Gmail API
                                </button>
                            )}
                        </div>

                        <div className="space-y-3">
                            <Label className={labelClass}>Use Gmail API for Sending</Label>
                            <label className="flex items-center gap-3 cursor-pointer p-4 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors">
                                <Input type="checkbox" name="use_gmail_for_send" checked={formData.use_gmail_for_send} onChange={(e) => setFormData({ ...formData, use_gmail_for_send: e.target.checked })} className="w-4 h-4 accent-primary" />
                                <span className="text-sm font-medium">Enable Gmail OAuth (Overrides SMTP)</span>
                            </label>
                        </div>
                    </div>

                    {/* Automation Column */}
                    <div className="space-y-6">
                        <div className="space-y-3">
                            <Label className={labelClass}>Automate Cold Mailing</Label>
                            <label className="flex items-center gap-3 cursor-pointer p-4 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors">
                                <Input type="checkbox" name="cold_mail_automation_enabled" checked={formData.cold_mail_automation_enabled} onChange={(e) => setFormData({ ...formData, cold_mail_automation_enabled: e.target.checked })} className="w-4 h-4 accent-primary" />
                                <span className="text-sm font-medium flex flex-col">
                                    <span>Enable AI Email Pipeline</span>
                                    <span className="text-xs text-muted-foreground font-normal mt-0.5">Discovers leads and targets outreach automatically.</span>
                                </span>
                            </label>
                        </div>

                        <div className="space-y-3">
                            <Label className={labelClass}>Automate Playwright Apps</Label>
                            <label className="flex items-center gap-3 cursor-pointer p-4 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors">
                                <Input type="checkbox" name="auto_apply_enabled" checked={formData.auto_apply_enabled} onChange={(e) => setFormData({ ...formData, auto_apply_enabled: e.target.checked })} className="w-4 h-4 accent-primary" />
                                <span className="text-sm font-medium flex flex-col">
                                    <span>Enable Auto-Apply Bot</span>
                                    <span className="text-xs text-muted-foreground font-normal mt-0.5">Navigates to vendor sites and applies in background.</span>
                                </span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            {/* Legacy SMTP Fallback */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-10 p-8 bg-card/40 border border-border shadow-sm rounded-xl relative overflow-hidden group">
                <div className="col-span-1 lg:col-span-1 lg:border-r border-border pr-6 relative z-10 flex flex-col gap-2">
                    <h3 className="text-lg font-semibold text-foreground flex items-center gap-2"><Network className="w-4 h-4 text-muted-foreground" /> Protocols</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">Legacy SMTP fallback services.</p>
                </div>
                <div className="col-span-1 lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                    <div>
                        <Label htmlFor="smtp_server" className={labelClass}>SMTP Server</Label>
                        <Input id="smtp_server" name="smtp_server" value={formData.smtp_server} onChange={handleChange} placeholder="smtp.gmail.com" className={inputClass} />
                    </div>
                    <div>
                        <Label htmlFor="smtp_port" className={labelClass}>SMTP Port</Label>
                        <Input id="smtp_port" name="smtp_port" value={formData.smtp_port} onChange={handleChange} placeholder="587" type="number" className={inputClass} />
                    </div>
                    <div>
                        <Label htmlFor="smtp_username" className={labelClass}>SMTP Username</Label>
                        <Input id="smtp_username" name="smtp_username" value={formData.smtp_username} onChange={handleChange} placeholder="agent@startup.com" className={inputClass} />
                    </div>
                    <div>
                        <Label htmlFor="smtp_password" className={labelClass}>SMTP Password <Tip text="Use an App Password for Gmail." /></Label>
                        <Input id="smtp_password" name="smtp_password" value={formData.smtp_password} onChange={handleChange} type="password" placeholder="••••••••••••" className={`${inputClass} font-mono`} />
                    </div>
                    <div className="md:col-span-2">
                        <Label htmlFor="max_email_per_day" className={labelClass}>Max Emails Per Day</Label>
                        <Input id="max_email_per_day" name="max_email_per_day" type="number" value={formData.max_email_per_day} onChange={handleChange} className={inputClass} />
                    </div>
                </div>
            </div>
        </div>
    );
}
