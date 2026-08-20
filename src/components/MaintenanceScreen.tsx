import { Wrench } from "lucide-react";
import { usePlatformSettings } from "@/components/PlatformSettingsProvider";

/** Full-screen takeover shown to non-admin users when maintenance mode is on. */
const MaintenanceScreen = () => {
  const { settings } = usePlatformSettings();
  const appName = settings?.app_name ?? "GeFlow";
  const message =
    settings?.maintenance_message?.trim() ||
    `${appName} is under maintenance, please come back in some time.`;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center">
      <div className="max-w-md">
        <div className="h-16 w-16 rounded-2xl bg-primary/15 text-primary flex items-center justify-center mx-auto mb-6">
          <Wrench className="h-8 w-8" />
        </div>
        {settings?.logo_url ? (
          <img src={settings.logo_url} alt={appName} className="h-10 mx-auto mb-4 object-contain" />
        ) : (
          <h1 className="text-2xl font-bold mb-2">{appName}</h1>
        )}
        <h2 className="text-xl font-bold mb-2">We'll be back soon</h2>
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  );
};

export default MaintenanceScreen;
