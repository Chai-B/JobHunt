"use client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Network, Info } from "lucide-react";

const Tip = ({ text }: { text: string }) => (
    <span className="relative inline-flex items-center ml-1.5 cursor-help group/tip">
        <Info className="w-3.5 h-3.5 text-muted-foreground/60 group-hover/tip:text-foreground transition-colors" />
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 text-xs text-foreground bg-card border border-border rounded-lg shadow-lg opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all duration-200 pointer-events-none z-50 leading-relaxed">
            {text}
        </span>
    </span>
);

export function EmailPanel({ formData, handleChange }: { formData: any, handleChange: any }) {
    const inputClass = "bg-background border-border focus-visible:ring-ring text-foreground h-11 w-full rounded-md shadow-sm transition-colors focus:border-ring placeholder:text-muted-foreground";
    const labelClass = "text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium mb-1.5 flex items-center";

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 p-8 bg-card border border-border shadow-sm rounded-xl relative overflow-hidden group">
            <div className="col-span-1 lg:col-span-1 lg:border-r border-border pr-6 relative z-10">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2"><Network className="w-4 h-4" /> Email Configuration</h3>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">SMTP credentials for automated outreach.</p>
            </div>
            <div className="col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
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
    );
}
