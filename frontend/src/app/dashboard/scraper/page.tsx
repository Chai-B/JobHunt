"use client";
import { API_BASE_URL } from "@/lib/config";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Globe, Users, Briefcase, Send, Activity, Info, Zap, ExternalLink, StopCircle } from "lucide-react";

const Tip = ({ text }: { text: string }) => (
    <span className="relative inline-flex items-center ml-1.5 cursor-help group/tip">
        <Info className="w-3.5 h-3.5 text-muted-foreground/60 group-hover/tip:text-foreground transition-colors" />
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 text-xs text-foreground bg-card border border-border rounded-lg shadow-lg opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all duration-200 pointer-events-none z-50 leading-relaxed">
            {text}
        </span>
    </span>
);

const AUTO_SCRAPE_SITES = [
    { name: "RemoteOK", url: "https://remoteok.com", type: "jobs" },
    { name: "Y Combinator", url: "https://www.ycombinator.com/jobs", type: "jobs" },
    { name: "We Work Remotely", url: "https://weworkremotely.com", type: "jobs" },
    { name: "AngelList", url: "https://angel.co/jobs", type: "jobs" },
    { name: "LinkedIn Jobs", url: "https://www.linkedin.com/jobs", type: "contacts" },
];

export default function ScraperPage() {
    const [targetUrl, setTargetUrl] = useState("");
    const [targetType, setTargetType] = useState("jobs");
    const [scraping, setScraping] = useState(false);
    const [scrapingSite, setScrapingSite] = useState<string | null>(null);
    const [stopping, setStopping] = useState(false);

    const [contacts, setContacts] = useState<any[]>([]);
    const [loadingContacts, setLoadingContacts] = useState(true);

    const fetchContacts = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/v1/scraper/contacts`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setContacts(Array.isArray(data) ? data : []);
            } else {
                toast.error("Failed to fetch contacts.");
            }
        } catch (err) {
            console.error("Failed to load contacts.");
        } finally {
            setLoadingContacts(false);
        }
    };

    useEffect(() => {
        fetchContacts();
        const interval = setInterval(fetchContacts, 10000);
        return () => clearInterval(interval);
    }, []);

    const handleScrape = async (e?: React.FormEvent, url?: string, type?: string) => {
        if (e) e.preventDefault();
        const scrapeUrl = url || targetUrl;
        const scrapeType = type || targetType;
        if (!scrapeUrl) return;

        setScraping(true);
        if (url) setScrapingSite(url);

        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/v1/scraper/run`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ target_url: scrapeUrl, target_type: scrapeType }),
            });

            if (!res.ok) throw new Error("Scraper failed.");
            toast.success(`Scraper started for ${scrapeUrl}. Check Logs for progress.`);
            if (!url) setTargetUrl("");
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setScraping(false);
            setScrapingSite(null);
        }
    };

    const handleStop = async () => {
        setStopping(true);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/v1/scraper/stop`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                toast.success(data.message);
            } else {
                toast.error("Failed to stop scraper.");
            }
        } catch (err) {
            toast.error("Network error.");
        } finally {
            setStopping(false);
        }
    };

    const labelClass = "text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium mb-1.5 flex items-center";

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 relative">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-semibold tracking-tight text-foreground flex items-center gap-3">
                        <Globe className="h-6 w-6" />
                        Scraper
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">Extract jobs and contacts from the web. Auto-scrape popular sites or manually target any URL.</p>
                </div>
                <Button variant="destructive" size="sm" onClick={handleStop} disabled={stopping} className="gap-2">
                    <StopCircle className={`w-4 h-4 ${stopping ? 'animate-spin' : ''}`} />
                    Stop All Scrapers
                </Button>
            </div>

            {/* Auto-Scrape Quick Launch */}
            <Card className="bg-card border-border shadow-sm">
                <CardHeader className="border-b border-border pb-5">
                    <CardTitle className="flex items-center gap-2 text-foreground">
                        <Zap className="w-5 h-5" /> Quick Scrape
                        <Tip text="One-click scrape for popular job boards. The scraper runs in the background and populates the global Jobs database." />
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                        Instantly scrape popular job boards with one click.
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="flex flex-wrap gap-3">
                        {AUTO_SCRAPE_SITES.map((site) => (
                            <Button
                                key={site.url}
                                variant="outline"
                                size="sm"
                                disabled={scraping}
                                onClick={() => handleScrape(undefined, site.url, site.type)}
                                className="gap-2 border-border text-foreground hover:bg-secondary transition-colors"
                            >
                                {scrapingSite === site.url ? (
                                    <Activity className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <ExternalLink className="w-3.5 h-3.5" />
                                )}
                                {site.name}
                                <Badge variant="outline" className="text-[10px] border-border text-muted-foreground ml-1">{site.type}</Badge>
                            </Button>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Manual Scrape */}
            <Card className="bg-card border-border shadow-sm">
                <CardHeader className="border-b border-border pb-5">
                    <CardTitle className="flex items-center gap-2 text-foreground">Manual Scrape</CardTitle>
                    <CardDescription className="text-muted-foreground">
                        Target any public URL to extract Jobs or Contacts.
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleScrape}>
                    <CardContent className="flex flex-col md:flex-row items-end gap-5 pt-6">
                        <div className="flex-1 w-full">
                            <Label htmlFor="url" className={labelClass}>
                                Target URL <Tip text="Enter a careers page, job listing, or company page. The AI will extract structured data from the page content." />
                            </Label>
                            <Input
                                id="url"
                                placeholder="https://example.com/careers"
                                value={targetUrl}
                                onChange={(e) => setTargetUrl(e.target.value)}
                                className="bg-background border-border focus-visible:ring-ring text-foreground h-11"
                                required
                            />
                        </div>
                        <div className="w-full md:w-[240px]">
                            <Label className={labelClass}>
                                Extraction Target <Tip text="'Jobs' extracts job postings (title, company, description). 'Contacts' extracts emails and names for outreach." />
                            </Label>
                            <Select value={targetType} onValueChange={setTargetType}>
                                <SelectTrigger className="bg-background border-border text-foreground h-11 focus:ring-ring shadow-sm">
                                    <SelectValue placeholder="Extraction Target" />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border text-foreground">
                                    <SelectItem value="jobs"><span className="flex items-center gap-2"><Briefcase className="w-4 h-4" /> Extract Jobs</span></SelectItem>
                                    <SelectItem value="contacts"><span className="flex items-center gap-2"><Users className="w-4 h-4" /> Extract Contacts</span></SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button type="submit" disabled={scraping} className="w-full md:w-auto h-11 px-8 bg-foreground hover:opacity-90 text-background font-medium transition-opacity rounded-md">
                            {scraping ? "Scraping..." : "Run Scraper"}
                        </Button>
                    </CardContent>
                </form>
            </Card>

            {/* Extracted Contacts */}
            <Card className="bg-card border-border shadow-sm">
                <CardHeader className="border-b border-border pb-5">
                    <CardTitle className="flex items-center gap-2 text-foreground"><Users className="w-5 h-5" /> Extracted Contacts</CardTitle>
                    <CardDescription className="text-muted-foreground">{contacts.length} contacts extracted. Use Cold Mail tab to send outreach.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {loadingContacts ? (
                        <div className="py-20 flex flex-col items-center justify-center text-muted-foreground">
                            <Activity className="w-6 h-6 animate-pulse mb-4" />
                            <span className="text-sm">Loading contacts...</span>
                        </div>
                    ) : contacts.length === 0 ? (
                        <div className="py-20 text-center text-muted-foreground text-sm">
                            No contacts extracted yet. Run the scraper to find contacts.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-secondary/30">
                                    <TableRow className="border-border hover:bg-transparent">
                                        <TableHead className="text-muted-foreground font-medium">Email Address</TableHead>
                                        <TableHead className="text-muted-foreground font-medium">Full Name</TableHead>
                                        <TableHead className="text-muted-foreground font-medium">Designation</TableHead>
                                        <TableHead className="text-muted-foreground font-medium">Source</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {contacts.map((c: any) => (
                                        <TableRow key={c.id} className="border-border hover:bg-secondary/50 transition-colors">
                                            <TableCell className="font-medium text-foreground">{c.email}</TableCell>
                                            <TableCell className="text-muted-foreground text-sm">{c.name || "—"}</TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {c.role && <Badge variant="outline" className="mr-2 text-foreground border-border font-normal">{c.role}</Badge>}
                                                {c.company && <span>{c.company}</span>}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]" title={c.source_url}>
                                                <a href={c.source_url} target="_blank" rel="noreferrer" className="hover:text-foreground hover:underline transition-colors">
                                                    {c.source_url}
                                                </a>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
