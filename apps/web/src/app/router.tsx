import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "./AppShell";
import { SdkSmoke } from "@/pages/dev/SdkSmoke";
import { OnboardingLayout } from "@/pages/onboarding/OnboardingLayout";
import { Welcome } from "@/pages/onboarding/Welcome";
import { IdentityCreate } from "@/pages/onboarding/IdentityCreate";
import { IdentityUnlock } from "@/pages/onboarding/IdentityUnlock";
import { WorkspaceCreate } from "@/pages/onboarding/WorkspaceCreate";
import { WorkspaceJoin } from "@/pages/onboarding/WorkspaceJoin";
import { ChannelView } from "@/pages/ChannelView";
import { DMView } from "@/pages/DMView";
import { Threads } from "@/pages/Threads";
import { SearchPage } from "@/pages/SearchPage";
import { MembersPage } from "@/pages/MembersPage";
import { AiPage } from "@/pages/AiPage";
import { AppsPage } from "@/pages/AppsPage";
import { MiniAppHost } from "@/pages/MiniAppHost";
import { CallPage } from "@/pages/CallPage";
import { SettingsLayout } from "@/pages/settings/SettingsLayout";
import { ProfileSettings } from "@/pages/settings/ProfileSettings";
import { WorkspaceSettings } from "@/pages/settings/WorkspaceSettings";
import { IntegrationsSettings } from "@/pages/settings/IntegrationsSettings";
import { AiEngineSettings } from "@/pages/settings/AiEngineSettings";
import { SecuritySettings } from "@/pages/settings/SecuritySettings";
import { NotificationsSettings } from "@/pages/settings/NotificationsSettings";
import { AppearanceSettings } from "@/pages/settings/AppearanceSettings";

const WS = "w_gossip";

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/welcome" replace /> },
  { path: "/dev/sdk-smoke", element: <SdkSmoke /> },
  {
    element: <OnboardingLayout />,
    children: [
      { path: "/welcome", element: <Welcome /> },
      { path: "/identity/create", element: <IdentityCreate /> },
      { path: "/identity/unlock", element: <IdentityUnlock /> },
      { path: "/workspace/create", element: <WorkspaceCreate /> },
      { path: "/workspace/join", element: <WorkspaceJoin /> },
    ],
  },
  {
    path: "/w/:workspaceId",
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="c/c_design" replace /> },
      { path: "c/:channelId", element: <ChannelView /> },
      { path: "dm/:dmId", element: <DMView /> },
      { path: "threads", element: <Threads /> },
      { path: "search", element: <SearchPage /> },
      { path: "members", element: <MembersPage /> },
      { path: "ai", element: <AiPage /> },
      { path: "apps", element: <AppsPage /> },
      { path: "apps/:appId", element: <MiniAppHost /> },
      { path: "call/:channelId", element: <CallPage /> },
    ],
  },
  {
    path: "/settings",
    element: <SettingsLayout />,
    children: [
      { index: true, element: <Navigate to="profile" replace /> },
      { path: "profile", element: <ProfileSettings /> },
      { path: "workspace", element: <WorkspaceSettings /> },
      { path: "integrations", element: <IntegrationsSettings /> },
      { path: "ai-engine", element: <AiEngineSettings /> },
      { path: "security", element: <SecuritySettings /> },
      { path: "notifications", element: <NotificationsSettings /> },
      { path: "appearance", element: <AppearanceSettings /> },
    ],
  },
  { path: "*", element: <Navigate to={`/w/${WS}/c/c_design`} replace /> },
]);
