"use client";
import { API_BASE_URL } from "@/lib/config";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Search, Briefcase, Globe, Activity, ExternalLink, MapPin, Building2, X, ChevronRight } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";

export default function JobsPage() {
    const [ingesting, setIngesting] = useState(false);
    const [matchingJobId, setMatchingJobId] = useState<number | null>(null);
    const [matchResult, setMatchResult] = useState<any>(null);
    const [jobs, setJobs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Pagination
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const pageSize = 48;

    const [title, setTitle] = useState("");
    const [company, setCompany] = useState("");
    const [description, setDescription] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedJob, setSelectedJob] = useState<any>(null);

    const fetchJobs = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/v1/jobs/?skip=${(page - 1) * pageSize}&limit=${pageSize}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setJobs(data.items || []);
                setTotal(data.total || 0);
            } else {
                toast.error("Failed to load jobs.");
            }
        } catch (err) {
            toast.error("Network Error: Could not reach the backend.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchJobs();
    }, [page]);

    const addToPipeline = async (jobId: number, resumeId: number) => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/v1/applications/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ job_id: jobId, resume_id: resumeId })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || "Failed to add application");
            }
            toast.success("Application started successfully.");
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const handleManualIngest = async (e: React.FormEvent) => {
        e.preventDefault();
        setIngesting(true);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/v1/jobs/ingest/manual`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ title, company, description })
            });
            if (!res.ok) throw new Error("Failed to add job");
            toast.success("Job added to the global database.");
            setIsOpen(false);
            setTitle(""); setCompany(""); setDescription("");
            fetchJobs();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setIngesting(false);
        }
    };

    const checkMatch = async (jobId: number) => {
        setMatchingJobId(jobId);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/v1/jobs/${jobId}/match`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || "Failed to find match");
            }
            const data = await res.json();
            setMatchResult({ jobId, resumeId: data.best_resume_id, score: data.match_score ?? 0 });
            toast.success(`Matched Resume #${data.best_resume_id} with score: ${data.match_score ?? 0}%`);
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setMatchingJobId(null);
        }
    };

    const filteredJobs = jobs.filter((job) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (job.title?.toLowerCase().includes(q) || job.company?.toLowerCase().includes(q) || job.description?.toLowerCase().includes(q));
    });

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 relative">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-semibold tracking-tight text-foreground flex items-center gap-3">
                        <Briefcase className="h-6 w-6" />
                        Jobs
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">All auto-scraped and manually added jobs from the global pool.</p>
                </div>

                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button className="flex items-center gap-2 bg-foreground text-background hover:opacity-90 transition-opacity rounded-md">
                            <Plus className="w-4 h-4" />
                            Add Job
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px] bg-card border-border text-foreground shadow-lg rounded-xl">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-semibold">Add New Job</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleManualIngest} className="grid gap-5 py-6">
                            <div className="grid gap-2">
                                <Label htmlFor="title" className="text-muted-foreground text-xs uppercase tracking-wider">Job Title</Label>
                                <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} className="bg-background border-border focus-visible:ring-ring text-foreground" placeholder="e.g. Senior Software Engineer" />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="company" className="text-muted-foreground text-xs uppercase tracking-wider">Company</Label>
                                <Input id="company" required value={company} onChange={(e) => setCompany(e.target.value)} className="bg-background border-border focus-visible:ring-ring text-foreground" placeholder="e.g. Acme Corp" />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="desc" className="text-muted-foreground text-xs uppercase tracking-wider">Job Description</Label>
                                <textarea
                                    id="desc"
                                    className="flex min-h-[160px] w-full rounded-md border border-border bg-background px-3 py-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
                                    placeholder="Paste the job description here."
                                    required
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                />
                            </div>
                            <Button type="submit" disabled={ingesting} className="w-full bg-foreground text-background hover:opacity-90 mt-2 font-medium">
                                {ingesting ? "Adding Job..." : "Save Job"}
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                    placeholder="Search jobs by title, company, or description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-card border-border focus-visible:ring-ring text-foreground h-11"
                />
            </div>

            {/* Stats Bar */}
            <div className="flex items-center gap-3">
                <Badge variant="outline" className="border-border text-muted-foreground text-xs">
                    <Globe className="w-3 h-3 mr-1.5" /> {total} jobs
                </Badge>
                {searchQuery && (
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground" onClick={() => setSearchQuery("")}>
                        <X className="w-3 h-3 mr-1" /> Clear filter
                    </Button>
                )}
            </div>

            {/* Job Cards Grid */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-6">
                    {[...Array(6)].map((_, i) => (
                        <Card key={i} className="bg-card border-border shadow-sm flex flex-col h-[220px]">
                            <CardContent className="p-5 flex flex-col flex-1 space-y-4">
                                <Skeleton className="h-6 w-3/4 bg-secondary/40" />
                                <div className="flex gap-4">
                                    <Skeleton className="h-4 w-1/3 bg-secondary/20" />
                                    <Skeleton className="h-4 w-1/4 bg-secondary/20" />
                                </div>
                                <div className="space-y-2 flex-1 mt-2">
                                    <Skeleton className="h-3 w-full bg-secondary/20" />
                                    <Skeleton className="h-3 w-5/6 bg-secondary/20" />
                                </div>
                                <div className="flex justify-between items-center mt-auto">
                                    <Skeleton className="h-4 w-16 bg-secondary/40" />
                                    <Skeleton className="h-7 w-20 bg-secondary/40 rounded-md" />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : filteredJobs.length === 0 ? (
                <div className="py-32 flex flex-col items-center justify-center text-muted-foreground">
                    <div className="h-16 w-16 bg-secondary rounded-full flex items-center justify-center mb-4 border border-border">
                        <Briefcase className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground mb-2">No jobs found</h3>
                    <p className="text-sm max-w-sm text-center">Add a job manually or run the scraper to populate the global database.</p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {filteredJobs.map((job) => (
                            <Card
                                key={job.id}
                                className="bg-card border-border shadow-sm hover:shadow-md hover:border-foreground/20 transition-all duration-200 cursor-pointer group overflow-hidden flex flex-col"
                                onClick={() => setSelectedJob(job)}
                            >
                                <CardContent className="p-5 flex flex-col flex-1">
                                    {/* Header */}
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-base font-semibold text-foreground leading-tight line-clamp-2 group-hover:text-foreground/90 transition-colors">
                                                {job.title}
                                            </h3>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-foreground/60 transition-colors shrink-0 mt-1" />
                                    </div>

                                    {/* Company & Location */}
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-4">
                                        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                            <Building2 className="w-3.5 h-3.5 shrink-0" />
                                            <span className="truncate max-w-[180px]">{job.company || "Unknown"}</span>
                                        </span>
                                        {job.location && job.location !== "Not specified" && (
                                            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                                <MapPin className="w-3.5 h-3.5 shrink-0" />
                                                <span className="truncate max-w-[150px]">{job.location}</span>
                                            </span>
                                        )}
                                    </div>

                                    {/* Description Preview */}
                                    <p className="text-xs text-muted-foreground/80 leading-relaxed line-clamp-3 mb-4 flex-1">
                                        {job.description?.substring(0, 150) || "No description available."}
                                    </p>

                                    {/* Footer */}
                                    <div className="flex items-center justify-between pt-3 border-t border-border/50">
                                        {job.source_url ? (
                                            <a
                                                href={job.source_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <ExternalLink className="w-3 h-3" /> Source
                                            </a>
                                        ) : (
                                            <Badge variant="outline" className="text-[10px] border-border text-muted-foreground h-5">{job.source || "Manual"}</Badge>
                                        )}

                                        {matchResult && matchResult.jobId === job.id ? (
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-muted-foreground">{matchResult?.score ?? 0}%</span>
                                                <Button
                                                    size="sm"
                                                    className="bg-foreground text-background hover:opacity-90 text-xs h-7 px-3"
                                                    onClick={(e) => { e.stopPropagation(); addToPipeline(job.id, matchResult?.resumeId); }}
                                                >
                                                    Apply
                                                </Button>
                                            </div>
                                        ) : (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="opacity-0 group-hover:opacity-100 transition-opacity text-foreground border-border hover:bg-secondary text-xs h-7 px-3"
                                                onClick={(e) => { e.stopPropagation(); checkMatch(job.id); }}
                                                disabled={matchingJobId === job.id}
                                            >
                                                <Search className={`w-3 h-3 mr-1 ${matchingJobId === job.id ? 'animate-spin' : ''}`} />
                                                {matchingJobId === job.id ? "..." : "Match"}
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                    <div className="mt-8">
                        <Pagination
                            currentPage={page}
                            totalCount={total}
                            pageSize={pageSize}
                            onPageChange={setPage}
                            disabled={loading}
                        />
                    </div>
                </>
            )}

            {/* Job Detail Dialog */}
            <Dialog open={!!selectedJob} onOpenChange={(open) => !open && setSelectedJob(null)}>
                <DialogContent className="sm:max-w-[650px] max-h-[85vh] bg-card border-border text-foreground shadow-lg rounded-xl overflow-hidden flex flex-col">
                    <DialogHeader className="shrink-0">
                        <DialogTitle className="text-xl font-semibold leading-tight pr-8">
                            {selectedJob?.title}
                        </DialogTitle>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2">
                            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <Building2 className="w-4 h-4" /> {selectedJob?.company || "Unknown"}
                            </span>
                            {selectedJob?.location && selectedJob.location !== "Not specified" && (
                                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                    <MapPin className="w-4 h-4" /> {selectedJob.location}
                                </span>
                            )}
                            {selectedJob?.source_url && (
                                <a
                                    href={selectedJob.source_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" /> View Source
                                </a>
                            )}
                        </div>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto py-4 min-h-0">
                        <div className="bg-secondary/30 rounded-lg p-5 border border-border">
                            <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">Job Description</h4>
                            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                                {selectedJob?.description || "No description available."}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-border shrink-0">
                        {matchResult && matchResult.jobId === selectedJob?.id ? (
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-muted-foreground">Match: <strong className="text-foreground">{matchResult?.score ?? 0}%</strong></span>
                                <Button className="bg-foreground text-background hover:opacity-90" onClick={() => addToPipeline(selectedJob.id, matchResult?.resumeId)}>
                                    Apply with Resume #{matchResult?.resumeId}
                                </Button>
                            </div>
                        ) : (
                            <Button
                                variant="outline"
                                className="border-border text-foreground hover:bg-secondary"
                                onClick={() => selectedJob && checkMatch(selectedJob.id)}
                                disabled={matchingJobId === selectedJob?.id}
                            >
                                <Search className={`w-4 h-4 mr-2 ${matchingJobId === selectedJob?.id ? 'animate-spin' : ''}`} />
                                {matchingJobId === selectedJob?.id ? "Matching..." : "Find Best Resume Match"}
                            </Button>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
