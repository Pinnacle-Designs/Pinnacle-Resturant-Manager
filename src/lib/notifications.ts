interface CriticalInsight {
  title: string;
  description: string;
  severity: string;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export async function showCriticalNotifications(insights: CriticalInsight[]) {
  if (insights.length === 0) return;

  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return;

  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.ready;
    registration.active?.postMessage({
      type: "SHOW_NOTIFICATIONS",
      insights,
    });
  } else {
    insights.forEach((insight) => {
      new Notification(insight.title, {
        body: insight.description,
        icon: "/logo.png",
      });
    });
  }
}
