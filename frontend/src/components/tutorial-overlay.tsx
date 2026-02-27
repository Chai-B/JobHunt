"use client";

import { useState, useEffect } from "react";
import Joyride, { CallBackProps, STATUS } from "react-joyride";
import { usePathname } from "next/navigation";
import { toast } from "sonner";

function getStepsForPath(path: string) {
    switch (path) {
        case "/dashboard":
            return [
                { target: "body", content: "Welcome to your JobHunt Dashboard! This is your central command center.", placement: "center" as const, disableBeacon: true },
                { target: "nav", content: "Use the sidebar to navigate between your tools: Scraper, Cold Mail, Resumes, and more.", placement: "right" as const },
                { target: "main", content: "Review your recent statistics and activity at a glance here.", placement: "top" as const }
            ];
        case "/dashboard/jobs":
            return [
                { target: "body", content: "Welcome to the Jobs section! Here you can manage all discovered opportunities.", placement: "center" as const, disableBeacon: true },
                { target: "main", content: "This table lists all jobs. You can sort, filter, and dive into detailed information for each role.", placement: "top" as const },
            ];
        case "/dashboard/scraper":
            return [
                { target: "body", content: "The Scraper is your AI-powered data extraction tool.", placement: "center" as const, disableBeacon: true },
                { target: "input", content: "Provide the target URL or query you want our headless browser to scrape.", placement: "bottom" as const },
                { target: "main button", content: "Click here to execute the agent. It automatically bypasses blocks and extracts clean data.", placement: "bottom" as const }
            ];
        case "/dashboard/applications":
            return [
                { target: "body", content: "Track all your submitted applications in one place.", placement: "center" as const, disableBeacon: true },
                { target: "main", content: "View the status of your applications. Our Auto-Apply agent logs everything here automatically.", placement: "top" as const }
            ];
        case "/dashboard/cold-mail":
            return [
                { target: "body", content: "Welcome to Cold Mail campaigns. Automate your outreach gracefully.", placement: "center" as const, disableBeacon: true },
                { target: "main", content: "Select a contact, choose a template, and generate highly personalized emails based on your profile & their background.", placement: "top" as const }
            ];
        case "/dashboard/templates":
            return [
                { target: "body", content: "Email templates accelerate your workflow.", placement: "center" as const, disableBeacon: true },
                { target: "main", content: "Create templates with variables like {{name}} or {{company}} which auto-fill during your outreach.", placement: "top" as const }
            ];
        case "/dashboard/contacts":
            return [
                { target: "body", content: "Your personal CRM for networking.", placement: "center" as const, disableBeacon: true },
                { target: "main", content: "Manage leads, export to CSV, or verify email addresses directly from here.", placement: "top" as const }
            ];
        case "/dashboard/extract":
            return [
                { target: "body", content: "The Universal Extractor turns messy text into clean data.", placement: "center" as const, disableBeacon: true },
                { target: "textarea", content: "Paste any unstructured text containing emails, names, or job descriptions here.", placement: "right" as const },
                { target: "main button", content: "Our AI will parse the text and save it directly into your Contacts or Jobs database.", placement: "top" as const }
            ];
        case "/dashboard/resumes":
            return [
                { target: "body", content: "Manage your resumes for different roles.", placement: "center" as const, disableBeacon: true },
                { target: "main", content: "Upload your PDFs. Our AI parses and vectors them to perfectly match your experience against job requirements.", placement: "top" as const }
            ];
        case "/dashboard/profile":
            return [
                { target: "body", content: "Your professional profile.", placement: "center" as const, disableBeacon: true },
                { target: "form", content: "Ensure this information is accurate. The AI uses this data to answer job application questions on your behalf!", placement: "top" as const }
            ];
        case "/dashboard/settings":
            return [
                { target: "body", content: "System configurations and automation rules.", placement: "center" as const, disableBeacon: true },
                { target: "main", content: "Toggle your background automation tasks on or off. Set it to auto-apply while you sleep!", placement: "top" as const }
            ];
        case "/dashboard/logs":
            return [
                { target: "body", content: "System Logs and Active Agents.", placement: "center" as const, disableBeacon: true },
                { target: "main", content: "Monitor the real-time terminal output of your background workers and AI agents.", placement: "top" as const }
            ];
        default:
            return [];
    }
}

export function TutorialOverlay() {
    const [run, setRun] = useState(false);
    const [steps, setSteps] = useState<any[]>([]);
    const pathname = usePathname();

    useEffect(() => {
        if (!pathname) return;

        // We only want to automatically trigger the tutorial ONCE for the very first page they see after login.
        const globalKey = "jobhunt_tutorial_seen_global";
        const hasSeenGlobalTutorial = localStorage.getItem(globalKey);

        const pageSteps = getStepsForPath(pathname);
        if (pageSteps.length > 0) {
            setSteps(pageSteps);
            if (!hasSeenGlobalTutorial) {
                // Slight delay so the UI fully mounts
                const timer = setTimeout(() => setRun(true), 1000);
                return () => clearTimeout(timer);
            } else {
                setRun(false); // Make sure it's off if they've already seen the initial global tour
            }
        } else {
            setRun(false);
            setSteps([]);
            // If they land on a page with no tutorial on first login, still mark the global tutorial as "seen" 
            // so it doesn't randomly pop up later on a different tab.
            if (!hasSeenGlobalTutorial) {
                localStorage.setItem(globalKey, "true");
            }
        }
    }, [pathname]);

    useEffect(() => {
        const handleForceTrigger = () => {
            const pageSteps = getStepsForPath(pathname);
            if (pageSteps.length > 0) {
                setSteps(pageSteps);
                setRun(true);
            } else {
                toast.info("No interactive tutorial available for this specific page yet.");
            }
        };
        window.addEventListener("trigger-tutorial", handleForceTrigger);
        return () => window.removeEventListener("trigger-tutorial", handleForceTrigger);
    }, [pathname]);

    const handleJoyrideCallback = (data: CallBackProps) => {
        const { status } = data;
        const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

        if (finishedStatuses.includes(status)) {
            setRun(false);
            // Mark the global tutorial as seen so it never auto-runs again on any page change
            localStorage.setItem("jobhunt_tutorial_seen_global", "true");
        }
    };

    if (steps.length === 0) return null;

    return (
        <Joyride
            steps={steps}
            run={run}
            continuous
            showProgress
            showSkipButton
            disableScrolling={true}
            floaterProps={{
                disableAnimation: true,
                styles: {
                    floater: {
                        maxWidth: 'calc(100vw - 300px)',
                    },
                    container: {
                        maxHeight: 'calc(100vh - 100px)',
                        overflowY: 'auto'
                    }
                }
            }}
            callback={handleJoyrideCallback}
            styles={{
                options: {
                    primaryColor: '#ffffff', // Black/White theme
                    textColor: '#ffffff',
                    backgroundColor: '#09090b', // card background
                    overlayColor: 'rgba(0, 0, 0, 0.8)',
                    zIndex: 10000,
                },
                tooltip: {
                    borderRadius: '12px',
                    border: '1px solid #27272a', // border-border
                    padding: '24px',
                    backgroundColor: '#09090b',
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
                },
                tooltipContainer: {
                    textAlign: "left",
                    fontFamily: 'inherit',
                },
                tooltipTitle: {
                    fontSize: '18px',
                    fontWeight: 600,
                    marginBottom: '10px',
                    color: '#ffffff',
                },
                tooltipContent: {
                    padding: '0',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    color: '#a1a1aa', // muted-foreground
                },
                buttonNext: {
                    backgroundColor: '#ffffff',
                    color: '#000000',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    padding: '10px 24px',
                    outline: 'none',
                },
                buttonBack: {
                    color: '#ffffff',
                    marginRight: '12px',
                    fontSize: '13px',
                    fontWeight: 500,
                },
                buttonSkip: {
                    color: '#71717a', // muted-foreground
                    fontSize: '13px',
                    fontWeight: 500,
                }
            }}
            locale={{
                last: "Done",
                next: "Next",
                skip: "Skip Tour"
            }}
        />
    );
}
