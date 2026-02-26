"use client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Globe, Info } from "lucide-react";

const Tip = ({ text }: { text: string }) => (
    <span className="relative inline-flex items-center ml-1.5 cursor-help group/tip">
        <Info className="w-3.5 h-3.5 text-muted-foreground/60 group-hover/tip:text-foreground transition-colors" />
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 text-xs text-foreground bg-card border border-border rounded-lg shadow-lg opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all duration-200 pointer-events-none z-50 leading-relaxed">
            {text}
        </span>
    </span>
);

export function ScraperPanel({ formData, handleChange }: { formData: any, handleChange: any }) {
    const inputClass = "bg-background border-border focus-visible:ring-ring text-foreground h-11 w-full rounded-md shadow-sm transition-colors focus:border-ring placeholder:text-muted-foreground";
    const labelClass = "text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium mb-1.5 flex items-center";

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 p-8 bg-card border border-border shadow-sm rounded-xl relative overflow-hidden group">
            <div className="col-span-1 lg:col-span-1 lg:border-r border-border pr-6 relative z-10">
                <h3 className="text-lg font-medium text-foreground flex items-center gap-2"><Globe className="w-4 h-4" /> Scraper Config</h3>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">Configure which sites to scrape automatically and how often.</p>
            </div>
            <div className="col-span-3 grid gap-6 relative z-10">
                <div>
                    <Label htmlFor="auto_scrape_urls" className={labelClass}>Auto-Scrape Target URLs <Tip text="Comma-separated list of URLs." /></Label>
                    <textarea
                        id="auto_scrape_urls" name="auto_scrape_urls" value={formData.auto_scrape_urls} onChange={handleChange}
                        className="flex min-h-[100px] w-full rounded-md border border-border bg-background px-3 py-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors font-mono text-xs"
                        placeholder={"https://remoteok.com/remote-jobs\nhttps://news.ycombinator.com/jobs"}
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <Label htmlFor="scrape_frequency_hours" className={labelClass}>Scrape Interval (Hours)</Label>
                        <Input id="scrape_frequency_hours" name="scrape_frequency_hours" type="number" value={formData.scrape_frequency_hours} onChange={handleChange} className={inputClass} />
                    </div>
                </div>
            </div>
        </div>
    );
}
