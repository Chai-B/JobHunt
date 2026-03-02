"use client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Database, Info } from "lucide-react";

const Tip = ({ text }: { text: string }) => (
    <span className="relative inline-flex items-center ml-1.5 cursor-help group/tip">
        <Info className="w-3.5 h-3.5 text-muted-foreground/60 group-hover/tip:text-foreground transition-colors" />
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 text-xs text-foreground bg-card border border-border rounded-lg shadow-lg opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all duration-200 pointer-events-none z-[100] leading-relaxed">
            {text}
        </span>
    </span>
);

export function DatabasePanel({ formData, handleChange }: { formData: any, handleChange: any }) {
    const inputClass = "bg-background border-border focus-visible:ring-ring text-foreground h-11 w-full rounded-md shadow-sm transition-colors focus:border-ring placeholder:text-muted-foreground";
    const labelClass = "text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium mb-1.5 flex items-center";

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 p-8 bg-card border border-border shadow-sm rounded-xl relative overflow-hidden group">
            <div className="col-span-1 lg:col-span-1 lg:border-r border-border pr-6 relative z-10">
                <h3 className="text-lg font-medium text-foreground flex items-center gap-2"><Database className="w-4 h-4" /> External Database</h3>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">Sync your data to an external PostgreSQL instance.</p>
            </div>
            <div className="col-span-3 grid gap-6 relative z-10">
                <div>
                    <Label htmlFor="external_db_url" className={labelClass}>Database URL (DSN)</Label>
                    <Input id="external_db_url" name="external_db_url" value={formData.external_db_url} onChange={handleChange} placeholder="postgresql://user:password@host/db" className={`${inputClass} font-mono text-sm`} />
                </div>
                <div>
                    <Label htmlFor="external_db_auth_key" className={labelClass}>Authentication Key</Label>
                    <Input id="external_db_auth_key" name="external_db_auth_key" value={formData.external_db_auth_key} onChange={handleChange} type="password" placeholder="eyJhbGci..." className={`${inputClass} font-mono text-sm`} />
                </div>
            </div>
        </div>
    );
}
