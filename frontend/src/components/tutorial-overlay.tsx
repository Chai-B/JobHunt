"use client";

import { useState, useEffect } from "react";
import Joyride, { CallBackProps, STATUS } from "react-joyride";

export function TutorialOverlay() {
    const [run, setRun] = useState(false);

    useEffect(() => {
        // Only trigger the tutorial once per lifetime, stored in localStorage
        const hasSeenTutorial = localStorage.getItem("jobhunt_tutorial_seen");
        if (!hasSeenTutorial) {
            // Slight delay so the UI fully mounts
            const timer = setTimeout(() => setRun(true), 1500);
            return () => clearTimeout(timer);
        }
    }, []);

    const steps = [
        {
            target: "body",
            content: "Welcome to JobHunt V2! This 10-second quick tour will show you the most powerful tools in your new arsenal.",
            placement: "center" as const,
            disableBeacon: true,
        },
        {
            target: "a[href='/dashboard/scraper']",
            content: "The Scraper is where the magic happens. We've upgraded this to use ultra-fast, headless browsers that extract jobs & contact leads perfectly without relying on AI.",
            placement: "right" as const,
        },
        {
            target: "a[href='/dashboard/extract']",
            content: "Found some messy data online? Paste it into the Universal Extractor, and we'll automatically parse it into Contacts or Job Postings to save to your CRM.",
            placement: "right" as const,
        },
        {
            target: "a[href='/dashboard/contacts']",
            content: "Manage your networking stack here. You can easily import your existing contacts via CSV or Excel sheets.",
            placement: "right" as const,
        },
        {
            target: "a[href='/dashboard/templates']",
            content: "Don't forget to configure your AI email templates for one-click cold outreach. Your linked variables will auto-fill!",
            placement: "right" as const,
        }
    ];

    const handleJoyrideCallback = (data: CallBackProps) => {
        const { status } = data;
        const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

        if (finishedStatuses.includes(status)) {
            setRun(false);
            localStorage.setItem("jobhunt_tutorial_seen", "true");
        }
    };

    return (
        <Joyride
            steps={steps}
            run={run}
            continuous
            showProgress
            showSkipButton
            callback={handleJoyrideCallback}
            styles={{
                options: {
                    primaryColor: '#10b981', // emerald-500
                    textColor: '#1f2937',
                    backgroundColor: '#ffffff',
                    overlayColor: 'rgba(0, 0, 0, 0.65)',
                    zIndex: 10000,
                },
                tooltipContainer: {
                    textAlign: "left"
                }
            }}
        />
    );
}
