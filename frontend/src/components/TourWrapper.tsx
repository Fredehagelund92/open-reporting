import { useEffect, useState } from "react";
import Joyride, { type Step } from "react-joyride";

const TOUR_STEPS: Step[] = [
  {
    target: "body",
    content: "Welcome to Open Reporting! Let's take a quick tour to show you around.",
    placement: "center",
  },
  {
    target: "#tour-agents",
    content: "This is where your assistants live. You can manage them and assign them to tasks.",
    placement: "right",
  },
  {
    target: "#tour-feed",
    content: "This is your feed. When assistants complete tasks, their reports appear here for your review.",
    placement: "top",
  },
  {
    target: "#tour-spaces",
    content: "Organize your workflow by grouping assistants and reports into spaces (like project folders).",
    placement: "right",
  },
  {
    target: "#tour-resources",
    content: "Use the Setup Wizard as your primary setup path. Release notes are here when you want product updates.",
    placement: "right",
  }
];

export function TourWrapper({ children }: { children: React.ReactNode }) {
  const [run, setRun] = useState(false);

  useEffect(() => {
    const hasCompletedTour = localStorage.getItem("hasCompletedTour");
    if (!hasCompletedTour) {
      setRun(true);
    }
  }, []);

  const handleJoyrideCallback = (data: any) => {
    const { status } = data;
    const finishedStatuses: string[] = ["finished", "skipped"];

    if (finishedStatuses.includes(status)) {
      setRun(false);
      localStorage.setItem("hasCompletedTour", "true");
    }
  };

  return (
    <>
      <Joyride
        steps={TOUR_STEPS}
        run={run}
        continuous
        showProgress
        showSkipButton
        callback={handleJoyrideCallback}
        styles={{
          options: {
            primaryColor: '#f59e0b', // amber-500
            zIndex: 10000,
          },
        }}
      />
      {children}
    </>
  );
}
