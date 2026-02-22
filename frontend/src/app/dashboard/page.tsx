"use client";
import { API_BASE_URL } from "@/lib/config";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Briefcase, Send, Users, Globe, Activity, Cpu, Zap, MailPlus } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import dynamic from "next/dynamic";

const AreaChart = dynamic(() => import('recharts').then(mod => mod.AreaChart), { ssr: false });
const Area = dynamic(() => import('recharts').then(mod => mod.Area), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(mod => mod.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(mod => mod.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(mod => mod.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(mod => mod.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then(mod => mod.ResponsiveContainer), { ssr: false });

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
                // Slight delay for smooth UX transition
                setTimeout(() => setLoading(false), 500);
            }
        };

        fetchMetrics();
    }, []);

    if (loading) return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <Skeleton className="h-10 w-64 mb-2" />
                <Skeleton className="h-4 w-96" />
            </div>

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map(i => (
                    <Card key={i} className="bg-card border-border shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-8 w-8 rounded-md" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-10 w-16 mb-2" />
                            <Skeleton className="h-3 w-32" />
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4 bg-card border-border shadow-sm h-[400px]">
                    <CardHeader>
                        <Skeleton className="h-6 w-32 mb-2" />
                        <Skeleton className="h-4 w-64" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-[250px] w-full rounded-lg mt-4" />
                    </CardContent>
                </Card>
                <Card className="col-span-3 bg-card border-border shadow-sm h-[400px]">
                    <CardHeader>
                        <Skeleton className="h-6 w-32 mb-2" />
                        <Skeleton className="h-4 w-64" />
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                        <Skeleton className="h-20 w-full rounded-md" />
                        <Skeleton className="h-20 w-full rounded-md" />
                        <Skeleton className="h-20 w-full rounded-md" />
                    </CardContent>
                </Card>
            </div>
        </div>
    );

    if (!metrics) return (
        <div className="flex h-[80vh] items-center justify-center text-destructive border border-destructive/20 bg-destructive/5 rounded-md">
            <p className="font-medium text-sm">Failed to connect to dashboard telemetry layers.</p>
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
                        <CardTitle className="text-sm font-medium text-muted-foreground">7d Growth</CardTitle>
                        <div className="p-2 bg-secondary rounded-md">
                            <Zap className="h-4 w-4 text-foreground" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-semibold text-foreground">+{metrics.recent_apps_7d}</div>
                        <p className="text-xs text-muted-foreground mt-1">Applications this week</p>
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
                            Activity Logs
                        </CardTitle>
                        <CardDescription className="text-muted-foreground">Live heartbeat of background execution layers.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4 max-h-[400px] overflow-y-auto pr-2">
                        {metrics.recent_activities && metrics.recent_activities.length > 0 ? (
                            metrics.recent_activities.map((log: any) => (
                                <div key={log.id} className="flex items-start bg-secondary/50 p-4 rounded-md border border-border">
                                    <span className={`relative flex h-2.5 w-2.5 mr-4 mt-1 shrink-0`}>
                                        <span className={`relative inline-flex rounded-full h-full w-full ${log.status === 'success' ? 'bg-emerald-500' :
                                            log.status === 'failed' ? 'bg-destructive' : 'bg-blue-500'
                                            }`}></span>
                                    </span>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center">
                                            <p className="text-sm font-medium text-foreground capitalize">{log.action.replace('_', ' ')}</p>
                                            <span className="text-[10px] text-muted-foreground">
                                                {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed truncate max-w-[200px]">{log.message || "Operation completed."}</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="py-20 text-center text-muted-foreground border border-dashed border-border rounded-md">
                                <p className="text-xs">No recent activity logged.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
