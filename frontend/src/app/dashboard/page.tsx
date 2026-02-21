"use client";
import { API_BASE_URL } from "@/lib/config";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Briefcase, Send, Users, Globe, Activity, Cpu, Zap, MailPlus } from "lucide-react";
import { toast } from "sonner";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function DashboardOverview() {
    const [metrics, setMetrics] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMetrics = async () => {
            try {
                const token = localStorage.getItem("token");
                const res = await fetch(`${API_BASE_URL}/api/v1/users/metrics`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (res.ok) {
                    setMetrics(await res.json());
                } else {
                    toast.error("Failed to load dashboard metrics");
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchMetrics();
    }, []);

    if (loading) return (
        <div className="flex h-[80vh] items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <Activity className="h-6 w-6 text-muted-foreground animate-pulse" />
                <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">Loading Metrics</p>
            </div>
        </div>
    );

    if (!metrics) return (
        <div className="flex h-[80vh] items-center justify-center text-destructive border border-destructive/20 bg-destructive/5 rounded-md">
            <p className="font-medium text-sm">Failed to connect to dashboard metrics.</p>
        </div>
    );

    const pipelineData = Object.entries(metrics.pipeline).map(([status, count]) => ({
        name: status.charAt(0).toUpperCase() + status.slice(1),
        count: count
    }));

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div>
                <h1 className="text-3xl font-semibold tracking-tight text-foreground mb-2">Command Center</h1>
                <p className="text-muted-foreground text-sm">Real-time telemetry of your autonomous job application fleet.</p>
            </div>

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-card border-border shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Applications</CardTitle>
                        <div className="p-2 bg-secondary rounded-md">
                            <Send className="h-4 w-4 text-foreground" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-semibold text-foreground">{metrics.total_applications}</div>
                        <p className="text-xs text-muted-foreground mt-1">Active Pipeline Volume</p>
                    </CardContent>
                </Card>

                <Card className="bg-card border-border shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Global Scraped Jobs</CardTitle>
                        <div className="p-2 bg-secondary rounded-md">
                            <Briefcase className="h-4 w-4 text-foreground" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-semibold text-foreground">{metrics.global_knowledge.jobs}</div>
                        <p className="text-xs text-muted-foreground mt-1">Across interconnected pool</p>
                    </CardContent>
                </Card>

                <Card className="bg-card border-border shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Global Contacts</CardTitle>
                        <div className="p-2 bg-secondary rounded-md">
                            <Users className="h-4 w-4 text-foreground" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-semibold text-foreground">{metrics.global_knowledge.contacts}</div>
                        <p className="text-xs text-muted-foreground mt-1">High-value targets scraped</p>
                    </CardContent>
                </Card>

                <Card className="bg-card border-border shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Network Scope</CardTitle>
                        <div className="p-2 bg-secondary rounded-md">
                            <Globe className="h-4 w-4 text-foreground" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-semibold text-foreground">Intl.</div>
                        <p className="text-xs text-muted-foreground mt-1">Nodes synchronized globally</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4 bg-card border-border shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-foreground font-semibold tracking-wide flex items-center gap-2">Funnel Velocity</CardTitle>
                        <CardDescription className="text-muted-foreground">Volumetric tracking of your applications moving through the pipeline.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[320px] mt-4">
                        {pipelineData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={pipelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#71717a" stopOpacity={0.2} />
                                            <stop offset="95%" stopColor="#71717a" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 11 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 11 }} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#ffffff', color: '#000000', borderRadius: '8px', border: '1px solid #e4e4e7', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)' }}
                                        itemStyle={{ color: '#000000', fontWeight: '500' }}
                                        labelStyle={{ color: '#71717a', marginBottom: '4px' }}
                                        cursor={{ stroke: '#a1a1aa', strokeWidth: 1 }}
                                    />
                                    <Area type="monotone" dataKey="count" stroke="#3f3f46" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" activeDot={{ r: 5, fill: '#000000', stroke: '#ffffff', strokeWidth: 2 }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground border border-dashed border-border rounded-lg bg-secondary/50">
                                <Activity className="h-6 w-6 mb-3 opacity-50" />
                                <span className="text-sm">No applications detected yet.</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="col-span-3 bg-card border-border shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-foreground font-semibold flex items-center gap-2">
                            <Cpu className="h-5 w-5 text-foreground" />
                            Agent Status
                        </CardTitle>
                        <CardDescription className="text-muted-foreground">Live heartbeat of background execution layers.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                        <div className="flex items-start bg-secondary p-4 rounded-md border border-border">
                            <span className="relative flex h-2.5 w-2.5 mr-4 mt-1 shrink-0">
                                <span className="relative inline-flex rounded-full h-full w-full bg-foreground"></span>
                            </span>
                            <div>
                                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                                    Strategic Job Alerts <Zap className="h-3 w-3 text-muted-foreground" />
                                </p>
                                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Checking for high-probability AI matching criteria globally.</p>
                            </div>
                        </div>

                        <div className="flex items-start bg-secondary p-4 rounded-md border border-border">
                            <span className="relative flex h-2.5 w-2.5 mr-4 mt-1 shrink-0">
                                <span className="relative inline-flex rounded-full h-full w-full bg-foreground"></span>
                            </span>
                            <div>
                                <p className="text-sm font-medium text-foreground">Global Discovery</p>
                                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Continuous background ingestion across standard pipelines.</p>
                            </div>
                        </div>

                        <div className="flex items-start p-4 rounded-md border border-transparent opacity-60">
                            <span className="relative flex h-2.5 w-2.5 mr-4 mt-1 shrink-0">
                                <span className="relative inline-flex rounded-full h-full w-full bg-muted-foreground"></span>
                            </span>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">LLM Application Engine</p>
                                <p className="text-xs text-muted-foreground mt-1">Dormant state. Awaiting human trigger.</p>
                            </div>
                        </div>

                        <div className="flex items-start p-4 rounded-md border border-transparent opacity-60">
                            <span className="relative flex h-2.5 w-2.5 mr-4 mt-1 shrink-0">
                                <span className="relative inline-flex rounded-full h-full w-full bg-muted-foreground"></span>
                            </span>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                    Outreach Module <MailPlus className="h-3 w-3" />
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">Idling in queue. Awaiting dispatched operations.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
