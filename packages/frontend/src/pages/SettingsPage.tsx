import { useState, useEffect } from "react";
import { PageHeader } from "../components/Layout.tsx";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Alert,
} from "../components/ui.tsx";
import { getSettings, updateSettings, getServerConfig, updateServerConfig, type Settings, type ServerConfig } from "../lib/api.ts";
import { Loader2, Save } from "lucide-react";

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    support_role_below_id: "",
    general_role_below_id: "",
    category_below_id: "",
    onboarding_question_id: "",
  });
  const [serverConfig, setServerConfig] = useState<ServerConfig>({
    rules_channel_id: "",
    projects_info_channel_id: "",
    projects_embed_title: "",
    projects_embed_description: "",
    projects_embed_color: "",
    projects_embed_message_id: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    Promise.all([getSettings(), getServerConfig()])
      .then(([s, c]) => { setSettings(s); setServerConfig(c); })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      await Promise.all([
        updateSettings(settings),
        updateServerConfig({
          rules_channel_id: serverConfig.rules_channel_id,
          projects_info_channel_id: serverConfig.projects_info_channel_id,
        }),
      ]);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="Configure where new roles, channels, and categories are placed."
      />

      <div className="mx-auto w-full max-w-xl flex-1 overflow-auto p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Alert variant="error">{error}</Alert>}
          {success && <Alert variant="success">Settings saved.</Alert>}

          <Card>
            <CardHeader>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Role Positions</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                New roles are placed just above the specified role ID.
              </p>
            </CardHeader>
            <CardBody className="space-y-3">
              <Input
                label="Support role: place below role ID"
                value={settings.support_role_below_id}
                onChange={(e) => setSettings((s) => ({ ...s, support_role_below_id: e.target.value }))}
                placeholder="1511842020254154853"
                className="font-mono text-xs"
              />
              <Input
                label="General role: place below role ID"
                value={settings.general_role_below_id}
                onChange={(e) => setSettings((s) => ({ ...s, general_role_below_id: e.target.value }))}
                placeholder="1511842182666125372"
                className="font-mono text-xs"
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Channel Positions</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                New project categories are created under this parent category.
              </p>
            </CardHeader>
            <CardBody>
              <Input
                label="Category parent: place below category ID"
                value={settings.category_below_id}
                onChange={(e) => setSettings((s) => ({ ...s, category_below_id: e.target.value }))}
                placeholder="1511798296744562809"
                className="font-mono text-xs"
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Onboarding</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                The onboarding prompt ID where project roles are added as options. Leave blank to skip.
              </p>
            </CardHeader>
            <CardBody>
              <Input
                label="Onboarding question ID"
                value={settings.onboarding_question_id}
                onChange={(e) => setSettings((s) => ({ ...s, onboarding_question_id: e.target.value }))}
                placeholder="Paste the prompt ID from Discord"
                className="font-mono text-xs"
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Server Channels</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Channel IDs used for the Server tab.
              </p>
            </CardHeader>
            <CardBody className="space-y-3">
              <Input
                label="Rules channel ID"
                value={serverConfig.rules_channel_id}
                onChange={(e) => setServerConfig((s) => ({ ...s, rules_channel_id: e.target.value }))}
                placeholder="1511795599186595921"
                className="font-mono text-xs"
              />
              <Input
                label="Projects & Info channel ID"
                value={serverConfig.projects_info_channel_id}
                onChange={(e) => setServerConfig((s) => ({ ...s, projects_info_channel_id: e.target.value }))}
                placeholder="1511819210643476590"
                className="font-mono text-xs"
              />
            </CardBody>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" loading={saving} size="sm">
              <Save className="h-3.5 w-3.5" />
              Save Settings
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
