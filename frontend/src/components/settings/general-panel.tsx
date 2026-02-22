"use client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { LayoutTemplate, Info } from "lucide-react";

const Tip = ({ text }: { text: string }) => (
    <span className="relative inline-flex items-center ml-1.5 cursor-help group/tip">
        <Info className="w-3.5 h-3.5 text-muted-foreground/60 group-hover/tip:text-foreground transition-colors" />
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 text-xs text-foreground bg-card border border-border rounded-lg shadow-lg opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all duration-200 pointer-events-none z-50 leading-relaxed">
            {text}
        </span>
    </span>
);

export function GeneralPanel({ formData, handleChange }: { formData: any, handleChange: any }) {
    const inputClass = "bg-background border-border focus-visible:ring-ring text-foreground h-11 w-full rounded-md shadow-sm transition-colors focus:border-ring placeholder:text-muted-foreground";
    const labelClass = "text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium mb-1.5 flex items-center";

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 p-8 bg-card border border-border shadow-sm rounded-xl relative overflow-hidden group">
            <div className="col-span-1 lg:col-span-1 lg:border-r border-border pr-6 relative z-10">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2"><LayoutTemplate className="w-4 h-4" /> Application Preferences</h3>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">Configure job matching and automated application targets.</p>
            </div>
            <div className="col-span-3 grid gap-6 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <Label htmlFor="target_roles" className={labelClass}>Target Roles <Tip text="Priority job titles." /></Label>
                        <Input id="target_roles" name="target_roles" value={formData.target_roles} onChange={handleChange} className={inputClass} placeholder="e.g. Software Engineer" />
                    </div>
                    <div>
                        <Label htmlFor="target_locations" className={labelClass}>Target Locations <Tip text="Preferred cities or 'Remote'." /></Label>
                        <Input id="target_locations" name="target_locations" value={formData.target_locations} onChange={handleChange} className={inputClass} placeholder="Remote, USA" />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <Label htmlFor="daily_apply_limit" className={labelClass}>Daily Auto-Apply Limit</Label>
                        <Input id="daily_apply_limit" name="daily_apply_limit" type="number" value={formData.daily_apply_limit} onChange={handleChange} className={inputClass} />
                    </div>
                    <div>
                        <Label htmlFor="cover_letter_tone" className={labelClass}>Cover Letter Tone</Label>
                        <Input id="cover_letter_tone" name="cover_letter_tone" value={formData.cover_letter_tone} onChange={handleChange} className={inputClass} placeholder="professional" />
                    </div>
                </div>
            </div>
        </div>
    );
}
