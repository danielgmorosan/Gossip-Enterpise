import { useState, type ReactNode } from "react";
import {
  BarChart3,
  Box,
  Building2,
  Calendar,
  Circle,
  Clipboard,
  Code2,
  Copy,
  CreditCard,
  ExternalLink,
  Filter,
  FileText,
  Github,
  Import,
  Inbox,
  Keyboard,
  Layers,
  LayoutGrid,
  ListFilter,
  Lock,
  Mail,
  MessageSquare,
  Moon,
  MoreHorizontal,
  PenSquare,
  Radio,
  Search,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Tag,
  User,
  Users,
  Zap,
} from "lucide-react";
import {
  ActivityMessage,
  ActivitySection,
  AiAssistantBlock,
  AiChatBreadcrumb,
  AiChatHero,
  AiChatShell,
  AiChatThreadLayout,
  AiChatWatermark,
  AiChatWelcomeLayout,
  AiNextSteps,
  AiOnboardingTips,
  AiPromptComposer,
  AiProse,
  AiStepDots,
  AiSuggestionCard,
  AiSuggestionGrid,
  AiUserBubble,
  AiWorkingIndicator,
  AskDock,
  AttributeChip,
  Avatar,
  BrandLogo,
  Button,
  CommentComposer,
  ContextMenu,
  CreationCard,
  CustomizeRow,
  CustomizeSection,
  CustomizeSettingRow,
  CustomizeSidebarModal,
  DatePickerPopover,
  DatePickerTrigger,
  DecorPanel,
  DetailBreadcrumb,
  DraftUpdateCard,
  EmptyState,
  Field,
  FooterBar,
  GoogleGlyph,
  IconTile,
  InboxRow,
  InlineReplyComposer,
  Input,
  IssueDetailBody,
  IssueDetailLayout,
  IssueDetailTitle,
  IssueRow,
  IssueTag,
  LabeledDivider,
  ListGroupHeader,
  MetadataRow,
  MilestonesBar,
  ModalBody,
  ModalFooter,
  ModalHeader,
  NavBadge,
  NavItem,
  NavSection,
  PaneEmptyState,
  PaneIconButton,
  PanelCard,
  PasswordInput,
  PropertyRow,
  PropertySection,
  PropertiesPanel,
  PulseUpdateCard,
  Requirements,
  SearchFilterTabs,
  SearchHeader,
  SearchResultRow,
  SidebarCard,
  StackModal,
  StackToast,
  StatGrid,
  StatTile,
  StatusListRow,
  ConfirmDestructiveModal,
  CopyField,
  DangerRow,
  DangerZone,
  EmptySettingsBox,
  IntegrationCard,
  IntegrationGrid,
  PlanCard,
  SelectControl,
  SettingsBackLink,
  SettingsCard,
  SettingsGroup,
  SettingsLayout,
  SettingsListRow,
  SettingsNavItem,
  SettingsNavSection,
  SettingsPageHeader,
  SettingsRow,
  Toggle,
  WizardCard,
  WizardFooter,
  WizardStepper,
  StatusPill,
  StatusTransition,
  SubIssueComposer,
  SubIssueItem,
  SubIssueSection,
  TabPills,
  TextLink,
  WorkspaceContentHeader,
  WorkspacePaneHeader,
  WorkspaceShell,
  WorkspaceSidebarHeader,
  WorkspaceSwitcher,
  type AiSkillOption,
} from "@gossip/ui/stack";

/* ---------------------------------------------------------------- */

function MonoLogo({ size = 24, onInverse }: { size?: number; onInverse?: boolean }) {
  return <BrandLogo src="/icon.png" height={size} onInverse={onInverse} />;
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="border-t border-line py-12">
      <div className="mb-8 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="text-xl font-bold tracking-tight text-ink">{title}</h2>
        {note && <p className="text-sm text-ink-mute">{note}</p>}
      </div>
      {children}
    </section>
  );
}

const COLOR_TOKENS: Array<{ name: string; varName: string; usage: string }> = [
  { name: "paper", varName: "--st-paper", usage: "Page background" },
  { name: "paper-2", varName: "--st-paper-2", usage: "Panel wash" },
  { name: "field", varName: "--st-field", usage: "Input fill, quiet buttons" },
  { name: "ink", varName: "--st-ink", usage: "Headings, primary actions" },
  { name: "ink-soft", varName: "--st-ink-soft", usage: "Body text" },
  { name: "ink-mute", varName: "--st-ink-mute", usage: "Support text" },
  { name: "ink-faint", varName: "--st-ink-faint", usage: "Placeholders, disabled" },
  { name: "line", varName: "--st-line", usage: "Hairlines, input borders" },
  { name: "line-strong", varName: "--st-line-strong", usage: "Emphasized rules" },
  { name: "positive", varName: "--st-positive", usage: "Validation passed" },
  { name: "negative", varName: "--st-negative", usage: "Errors" },
  { name: "inverse", varName: "--st-inverse", usage: "Footer bar" },
];

const PASSWORD_RULES: Array<{ label: string; test: (v: string) => boolean }> = [
  { label: "At least 10 characters", test: (v) => v.length >= 10 },
  { label: "At least one lowercase letter (a-z)", test: (v) => /[a-z]/.test(v) },
  { label: "At least one uppercase letter (A-Z)", test: (v) => /[A-Z]/.test(v) },
  { label: "At least one number (0-9)", test: (v) => /\d/.test(v) },
  { label: "At least one special character", test: (v) => /[^a-zA-Z0-9]/.test(v) },
];

const DEMO_SKILLS: AiSkillOption[] = [
  {
    id: "recap",
    label: "Channel recap",
    description: "Summarize activity across channels you can access",
  },
  {
    id: "spec",
    label: "Scaffold AI agent spec",
    description: "Turn a brief into a structured implementation plan",
  },
];

type AiDemoView = "welcome" | "thread" | "ready";

function AiChatDemo() {
  const [view, setView] = useState<AiDemoView>("welcome");
  const [prompt, setPrompt] = useState("");
  const [reply, setReply] = useState("");
  const [skill, setSkill] = useState<AiSkillOption | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [thinking, setThinking] = useState(false);

  const composer = (
    <AiPromptComposer
      value={view === "thread" ? reply : prompt}
      onChange={(e) => (view === "thread" ? setReply(e.target.value) : setPrompt(e.target.value))}
      placeholder={view === "thread" ? "Reply…" : "Ask Gossip…"}
      skills={DEMO_SKILLS}
      activeSkill={skill}
      onSkillSelect={setSkill}
      onSkillRemove={() => setSkill(null)}
      onAttach={() => undefined}
      busy={thinking}
      onSubmit={() => {
        if (view === "welcome" && prompt.trim()) {
          setView("thread");
          setThinking(true);
          window.setTimeout(() => setThinking(false), 1400);
        }
      }}
    />
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["welcome", "Welcome"],
            ["thread", "Thread"],
            ["ready", "Ready"],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            size="sm"
            variant={view === id ? "primary" : "outline"}
            onClick={() => setView(id)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="dark overflow-hidden rounded-card border border-line" style={{ colorScheme: "dark" }}>
        <div className="min-h-[640px] bg-paper">
          {view === "welcome" && (
            <AiChatShell watermark={<AiChatWatermark />}>
              <AiChatWelcomeLayout
                hero={
                  <AiChatHero
                    title="Welcome to Gossip"
                    subtitle="Ask anything or tell Gossip AI what you need"
                  />
                }
                composer={composer}
                suggestions={
                  showSuggestions ? (
                    <AiSuggestionGrid onDismiss={() => setShowSuggestions(false)}>
                      <AiSuggestionCard
                        icon={<Box strokeWidth={1.75} />}
                        title="Recap a channel"
                        description="Summarize what shipped in #marketing this week."
                        onClick={() => setPrompt("Recap #marketing activity from this week")}
                      />
                      <AiSuggestionCard
                        icon={<Search strokeWidth={1.75} />}
                        title="Research a topic"
                        description="Search across channels you can access."
                        onClick={() => setPrompt("Find decisions about pricing in our channels")}
                      />
                      <AiSuggestionCard
                        icon={<Zap strokeWidth={1.75} />}
                        title="Draft a standup update"
                        description="Turn recent activity into a concise update."
                        onClick={() => setPrompt("Draft my standup update from yesterday's threads")}
                      />
                    </AiSuggestionGrid>
                  ) : undefined
                }
              />
            </AiChatShell>
          )}

          {view === "thread" && (
            <AiChatShell>
              <AiChatThreadLayout
                header={
                  <AiChatBreadcrumb
                    items={[
                      { label: "Ask Gossip", onClick: () => setView("welcome") },
                      { label: "List tasks to complete" },
                    ]}
                  />
                }
                composer={composer}
              >
                <AiUserBubble>
                  Could you please let me know which tasks I need to complete?
                </AiUserBubble>

                {thinking ? (
                  <AiWorkingIndicator label="Thinking…" />
                ) : (
                  <>
                    <AiWorkingIndicator label="Worked for 13 seconds" />
                    <AiAssistantBlock>
                      <p className="text-ink">You currently have 3 open issues assigned to you.</p>
                      <ul className="mt-4 space-y-2 text-[14px]">
                        {[
                          ["GW-25", "Ship channel search v1"],
                          ["GW-31", "Wire Gossip AI recap route"],
                          ["GW-42", "Review relay self-host docs"],
                        ].map(([id, title]) => (
                          <li key={id} className="flex items-center gap-2">
                            <span className="font-mono text-[13px] text-ink-mute">{id}</span>
                            <span className="text-ink-soft">{title}</span>
                          </li>
                        ))}
                      </ul>
                      <AiNextSteps>
                        <li>I can post a recap to the channel you specify.</li>
                        <li>Or narrow this list to what is due this sprint.</li>
                      </AiNextSteps>
                    </AiAssistantBlock>
                  </>
                )}
              </AiChatThreadLayout>
            </AiChatShell>
          )}

          {view === "ready" && (
            <AiChatShell>
              <div className="flex flex-1 flex-col items-center justify-center gap-8 py-16 text-center">
                <AiChatHero
                  title="You're good to go"
                  subtitle={
                    <>
                      Explore the workspace. When you are ready, press{" "}
                      <kbd className="rounded-control border border-line bg-field px-1.5 py-0.5 font-mono text-[12px] text-ink-mute">
                        ⌘K
                      </kbd>{" "}
                      to ask Gossip AI.
                    </>
                  }
                />
                <div className="w-full max-w-2xl">
                  <AiOnboardingTips
                    items={[
                      {
                        icon: <User strokeWidth={1.75} />,
                        title: "Tell your team",
                        description: "Invite members to your workspace and assign channels.",
                      },
                      {
                        icon: <Sparkles strokeWidth={1.75} />,
                        title: "Add Gossip AI to channels",
                        description: "The assistant only reads channels it is a member of.",
                      },
                      {
                        icon: <Keyboard strokeWidth={1.75} />,
                        title: "Keyboard shortcuts",
                        description: (
                          <>
                            Press <kbd className="rounded border border-line bg-field px-1 font-mono text-[11px]">?</kbd>{" "}
                            anytime for the shortcut list.
                          </>
                        ),
                      },
                    ]}
                  />
                </div>
                <Button className="w-full max-w-sm rounded-full">Open workspace</Button>
                <AiStepDots total={6} current={5} />
              </div>
            </AiChatShell>
          )}
        </div>
        <FooterBar
          start={<BrandLogo src="/icon.png" height={22} onInverse />}
          end={<span className="text-inverse-ink/70">workspace-confidential by design</span>}
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="rounded-card border border-line p-6">
          <p className="mb-4 text-sm font-semibold text-ink">Composer with skill chip</p>
          <AiPromptComposer
            value="Analyze this design and draft implementation issues grouped by frontend and backend."
            onChange={() => undefined}
            skills={DEMO_SKILLS}
            activeSkill={DEMO_SKILLS[1]}
            onSkillRemove={() => undefined}
            onAttach={() => undefined}
            onSubmit={() => undefined}
          />
        </div>
        <div className="rounded-card border border-line p-6">
          <p className="mb-4 text-sm font-semibold text-ink">Structured assistant reply</p>
          <AiProse>
            <h3>Frontend tasks</h3>
            <p>
              <strong>Title:</strong> Build AI chat composer
            </p>
            <ul>
              <li>Skills dropdown with removable context chip</li>
              <li>Enter to send, Shift+Enter for newline</li>
            </ul>
            <p>
              <strong>Priority:</strong> High · <strong>Label:</strong> Design system
            </p>
          </AiProse>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */

type WorkspaceDemoView = "inbox" | "issues" | "pulse";

function WorkspaceDemo() {
  const [view, setView] = useState<WorkspaceDemoView>("inbox");
  const [issueTab, setIssueTab] = useState("assigned");
  const [selectedInbox, setSelectedInbox] = useState(0);

  const sidebar = (
    <>
      <WorkspaceSidebarHeader
        workspace={
          <WorkspaceSwitcher
            name="Mothkeep Labs"
            avatar={<Avatar name="Alex Smith" size="sm" />}
          />
        }
        actions={
          <>
            <PaneIconButton label="Search">
              <Search className="size-4" strokeWidth={1.75} />
            </PaneIconButton>
            <PaneIconButton label="New">
              <PenSquare className="size-4" strokeWidth={1.75} />
            </PaneIconButton>
          </>
        }
      />
      <div className="flex-1 overflow-y-auto py-1">
        <NavSection>
          <NavItem
            icon={<Inbox strokeWidth={1.75} />}
            label="Inbox"
            active={view === "inbox"}
            badge={<NavBadge>7</NavBadge>}
            onClick={() => setView("inbox")}
          />
          <NavItem
            icon={<Circle strokeWidth={1.75} />}
            label="My issues"
            active={view === "issues"}
            onClick={() => setView("issues")}
          />
          <NavItem
            icon={<Radio strokeWidth={1.75} />}
            label="Pulse"
            active={view === "pulse"}
            onClick={() => setView("pulse")}
          />
        </NavSection>
        <NavSection label="Workspace">
          <NavItem icon={<Box strokeWidth={1.75} />} label="Projects" />
          <NavItem icon={<Layers strokeWidth={1.75} />} label="Views" />
          <NavItem icon={<MoreHorizontal className="size-4" />} label="More" />
        </NavSection>
        <NavSection label="Your teams">
          <NavItem icon={<Users strokeWidth={1.75} />} label="Mothkeep" />
          <NavItem icon={<LayoutGrid strokeWidth={1.75} />} label="Issues" />
        </NavSection>
        <NavSection label="Try">
          <NavItem icon={<Github strokeWidth={1.75} />} label="Connect GitHub" />
        </NavSection>
      </div>
      <SidebarCard
        title="What's new"
        description="Channel threads and local AI routing are in beta."
      />
    </>
  );

  const inboxList = (
    <>
      <WorkspacePaneHeader
        title="Inbox"
        actions={
          <>
            <PaneIconButton label="Filter">
              <ListFilter className="size-4" strokeWidth={1.75} />
            </PaneIconButton>
            <PaneIconButton label="Display">
              <SlidersHorizontal className="size-4" strokeWidth={1.75} />
            </PaneIconButton>
          </>
        }
      />
      <div className="flex-1 overflow-y-auto">
        {[
          ["Channel recap ready", "Gossip AI finished #marketing summary", "13m"],
          ["Relay health check", "Self-hosted relay responded slowly", "22m"],
          ["Design system review", "Stack components ready for QA", "1h"],
        ].map(([title, subtitle, time], i) => (
          <InboxRow
            key={i}
            icon={<Sparkles className="size-4 text-positive" strokeWidth={1.75} />}
            title={title}
            subtitle={subtitle}
            time={time}
            unread={i === 0}
            active={selectedInbox === i}
            onClick={() => setSelectedInbox(i)}
          />
        ))}
      </div>
    </>
  );

  const issuesContent = (
    <>
      <WorkspaceContentHeader
        title="My issues"
        tabs={
          <TabPills
            items={[
              { id: "assigned", label: "Assigned" },
              { id: "created", label: "Created" },
              { id: "subscribed", label: "Subscribed" },
              { id: "activity", label: "Activity" },
            ]}
            value={issueTab}
            onChange={setIssueTab}
          />
        }
        actions={
          <>
            <PaneIconButton label="Filter">
              <Filter className="size-4" strokeWidth={1.75} />
            </PaneIconButton>
            <PaneIconButton label="Display">
              <SlidersHorizontal className="size-4" strokeWidth={1.75} />
            </PaneIconButton>
          </>
        }
      />
      <div className="flex-1 overflow-y-auto">
        <ListGroupHeader label="Other active" count={3} />
        <IssueRow
          priority={<BarChart3 className="size-3.5" strokeWidth={1.75} />}
          id="GW-11"
          age="6d"
          title="Create user personas for workspace admins"
          tags={
            <>
              <IssueTag label="Research" dot="#4ade80" />
              <IssueTag label="UX" dot="#6f8dff" />
            </>
          }
          assignee={{ name: "Alex Smith" }}
          dateRange="Mar 31 – Apr 6"
        />
        <IssueRow
          id="GW-25"
          age="2d"
          title="Ship channel search v1"
          tags={<IssueTag label="Feature" dot="#9b8cff" />}
          assignee={{ name: "Alex Smith" }}
        />
        <IssueRow
          id="GW-31"
          age="1d"
          title="Wire Gossip AI recap route"
          assignee={{ name: "Alex Smith" }}
        />
      </div>
      <AskDock onAsk={() => undefined} onHistory={() => undefined} />
    </>
  );

  const pulseContent = (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <WorkspaceContentHeader
        title="Pulse"
        className="px-6"
        tabs={
          <TabPills
            items={[
              { id: "me", label: "For me" },
              { id: "popular", label: "Popular" },
              { id: "recent", label: "Recent" },
            ]}
            value="me"
          />
        }
      />
      <div className="flex-1 space-y-6 px-6 py-6">
        <div className="mx-auto max-w-2xl">
          <PulseUpdateCard
            title="iOS Mobile App"
            status={<StatusPill label="On track" tone="positive" icon={<Sparkles className="size-3" />} />}
            author="alexsmith"
            time="just now"
            statusTransition={
              <StatusTransition
                from={<StatusPill label="Backlog" icon={<Circle className="size-3" strokeDasharray="2 2" />} />}
                to={<StatusPill label="In Progress" tone="warning" icon={<Circle className="size-3 fill-current/30" />} />}
              />
            }
            reply={<InlineReplyComposer />}
          >
            <p>
              Core navigation is in review. Push notifications and offline sync are the next
              milestones before we cut a TestFlight build.
            </p>
          </PulseUpdateCard>
        </div>
        <div className="mx-auto max-w-2xl">
          <p className="mb-3 text-[13px] font-medium text-ink-mute">Updates</p>
          <div className="flex gap-3 overflow-x-auto pb-2">
            <DraftUpdateCard
              title="UX Research recap"
              time="now"
              preview="Competitive benchmark highlights privacy-first positioning and local AI as differentiators…"
            />
            <DraftUpdateCard
              title="Design system"
              time="1m"
              preview="Stack workspace shell and AI chat components landed in the styleguide…"
            />
          </div>
        </div>
        <div className="mx-auto max-w-2xl">
          <ContextMenu
            items={[
              { label: "Go to update in project", icon: <ExternalLink className="size-4" /> },
              { label: "Copy link", icon: <Copy className="size-4" /> },
              { label: "Copy as markdown", icon: <Clipboard className="size-4" /> },
            ]}
          />
        </div>
      </div>
      <AskDock onAsk={() => undefined} onHistory={() => undefined} />
    </div>
  );

  const inboxContent = (
    <>
      <PaneEmptyState
        icon={<Inbox strokeWidth={1} />}
        title="No notifications"
        description="7 unread notifications"
      />
      <AskDock onAsk={() => undefined} onHistory={() => undefined} />
    </>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["inbox", "Inbox"],
            ["issues", "My issues"],
            ["pulse", "Pulse"],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            size="sm"
            variant={view === id ? "primary" : "outline"}
            onClick={() => setView(id)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="dark overflow-hidden rounded-card border border-line" style={{ colorScheme: "dark" }}>
        <WorkspaceShell
          sidebar={sidebar}
          list={view === "inbox" ? inboxList : undefined}
          content={
            view === "inbox" ? inboxContent : view === "issues" ? issuesContent : pulseContent
          }
          footer={
            <FooterBar
              start={<BrandLogo src="/icon.png" height={22} onInverse />}
              end={<span className="text-inverse-ink/70">workspace-confidential by design</span>}
            />
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-card border border-line p-5">
          <p className="mb-3 text-sm font-semibold text-ink">Metadata row</p>
          <MetadataRow label="Properties">
            <StatusPill label="Active" tone="warning" icon={<Circle className="size-2.5 fill-current" />} />
            <span className="inline-flex items-center gap-1.5 text-ink-mute">
              <Avatar name="Alex Smith" size="sm" /> Alex Smith
            </span>
            <span className="inline-flex items-center gap-1 text-ink-mute">
              <Calendar className="size-3.5" /> Q2 2026
            </span>
          </MetadataRow>
        </div>
        <div className="rounded-card border border-line p-5">
          <p className="mb-3 text-sm font-semibold text-ink">Ask dock</p>
          <div className="relative h-16 rounded-control bg-field">
            <AskDock className="bottom-2 right-2" onAsk={() => undefined} onHistory={() => undefined} />
          </div>
        </div>
        <div className="rounded-card border border-line p-5">
          <p className="mb-3 text-sm font-semibold text-ink">Issue tags</p>
          <div className="flex flex-wrap gap-2">
            <IssueTag label="Research" dot="#4ade80" />
            <IssueTag label="UX" dot="#6f8dff" />
            <IssueTag label="Feature" dot="#9b8cff" />
          </div>
        </div>
      </div>
    </div>
  );
}

type DetailDemoView = "issue" | "search" | "modals";

function DetailDemo() {
  const [view, setView] = useState<DetailDemoView>("issue");
  const [searchTab, setSearchTab] = useState("all");
  const [showCustomize, setShowCustomize] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState(8);

  const properties = (
    <PropertiesPanel>
      <PropertySection title="Properties">
        <PropertyRow icon={<Circle className="size-4" strokeWidth={1.75} />} label="Todo" />
        <PropertyRow icon={<BarChart3 className="size-4" strokeWidth={1.75} />} label="Set priority" />
        <PropertyRow icon={<User className="size-4" strokeWidth={1.75} />} label="Assign" />
        <PropertyRow icon={<span className="text-xs">△</span>} label="Set estimate" />
      </PropertySection>
      <PropertySection title="Labels">
        <PropertyRow icon={<Tag className="size-4" strokeWidth={1.75} />} label="Add label" />
      </PropertySection>
      <PropertySection title="Project">
        <PropertyRow icon={<Box className="size-4" strokeWidth={1.75} />} label="Add to project" />
      </PropertySection>
    </PropertiesPanel>
  );

  const issueView = (
    <div className="relative flex min-h-[480px] flex-col">
      <IssueDetailLayout properties={properties}>
        <DetailBreadcrumb
          items={[
            { label: "Mothkeep" },
            { label: "GW-35 Add dark mode toggle in user settings" },
          ]}
          actions={
            <span className="text-[12px] tabular-nums text-ink-faint">2 / 5</span>
          }
        />
        <IssueDetailBody>
          <IssueDetailTitle
            title="Add dark mode toggle in user settings"
            description="Users should be able to switch between light and dark themes from settings. The preference should persist across sessions."
            meta={
              <span className="inline-flex items-center gap-1 text-[12px]">
                <Circle className="size-3.5 text-positive" /> 1
              </span>
            }
          />

          <SubIssueSection
            count={1}
            composer={
              <SubIssueComposer
                chips={
                  <>
                    <AttributeChip icon={<span className="font-mono text-[10px]">MK</span>} label="Team" />
                    <AttributeChip icon={<BarChart3 className="size-3.5" />} label="High" />
                    <AttributeChip icon={<Avatar name="Alex Smith" size="sm" />} label="Alex Smith" />
                    <AttributeChip label="UI" />
                  </>
                }
                actions={
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm">Cancel</Button>
                    <Button size="sm">Create</Button>
                  </div>
                }
              />
            }
          >
            <SubIssueItem
              title="Design dark mode UI for core screens"
              tags={
                <>
                  <IssueTag label="UI" dot="#f4c453" />
                  <IssueTag label="4" />
                </>
              }
            />
          </SubIssueSection>

          <ActivitySection>
            <ActivityMessage author="Alex Smith" time="33min ago">
              created the issue
            </ActivityMessage>
            <div className="space-y-2">
              <ActivityMessage author="Alex Smith" time="12min ago">
                commented
              </ActivityMessage>
              <p className="ml-9 text-[14px] leading-relaxed text-ink-soft">
                We will discuss this issue in tomorrow&apos;s meeting.
              </p>
              <div className="ml-9">
                <InlineReplyComposer placeholder="Leave a reply…" />
              </div>
            </div>
          </ActivitySection>

          <div className="mt-8">
            <CommentComposer />
          </div>
        </IssueDetailBody>
      </IssueDetailLayout>
      <AskDock onAsk={() => undefined} onHistory={() => undefined} />
    </div>
  );

  const searchView = (
    <div className="flex min-h-[480px] flex-col">
      <SearchHeader
        value="design"
        onChange={() => undefined}
        tabs={
          <SearchFilterTabs
            items={[
              { id: "all", label: "All" },
              { id: "issues", label: "Issues" },
              { id: "projects", label: "Projects" },
              { id: "documents", label: "Documents" },
            ]}
            value={searchTab}
            onChange={setSearchTab}
          />
        }
        actions={
          <PaneIconButton label="Filter">
            <Filter className="size-4" strokeWidth={1.75} />
          </PaneIconButton>
        }
      />
      <div className="flex-1 overflow-y-auto">
        <SearchResultRow type="Initiative" icon={<Circle className="size-4" />} title="Design System & UI Kit Creation" time="1d" />
        <SearchResultRow type="Issue" meta="GW-6" icon={<Circle className="size-4 text-positive" />} title="Conduct stakeholder interviews" time="9d" />
        <SearchResultRow type="Project" icon={<Box className="size-4" />} title="AI UX Research Assistant" time="3d" />
        <SearchResultRow type="Document" icon={<FileText className="size-4" />} title="Product Document - User Insight Dashboard" time="7h" />
      </div>
      <AskDock onAsk={() => undefined} onHistory={() => undefined} />
    </div>
  );

  const modalsView = (
    <div className="space-y-6 p-6">
      <CreationCard
        icon={<Circle className="size-4" strokeWidth={1.75} />}
        title="Foundation Setup & Product Definition"
        description="Define core product vision, user personas, and key problem statements for the AI assistant."
        footer={
          <>
            <div className="relative">
              <DatePickerTrigger />
              <div className="absolute left-0 top-full z-10 mt-2">
                <DatePickerPopover selectedDay={selectedDay} onSelectDay={setSelectedDay} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm">Cancel</Button>
              <Button size="sm">Create</Button>
            </div>
          </>
        }
      />

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" size="sm" onClick={() => setShowProjectModal(true)}>
          New project modal
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowCustomize(true)}>
          Customize sidebar
        </Button>
      </div>

      {showProjectModal && (
        <StackModal onClose={() => setShowProjectModal(false)} width="lg">
          <ModalHeader breadcrumb={<span className="text-[13px] text-ink-mute">MK › New project</span>} icon={<Box className="size-5" />} />
          <ModalBody className="space-y-4">
            <input
              type="text"
              placeholder="Project name"
              className="w-full bg-transparent text-xl font-bold text-ink placeholder:text-ink-faint outline-none"
            />
            <input
              type="text"
              placeholder="Add a short summary…"
              className="w-full bg-transparent text-[14px] text-ink-mute placeholder:text-ink-faint outline-none"
            />
            <div className="flex flex-wrap gap-1.5">
              <AttributeChip icon={<Circle className="size-3.5" />} label="Backlog" />
              <AttributeChip icon={<User className="size-3.5" />} label="Lead" />
              <AttributeChip icon={<Calendar className="size-3.5" />} label="Target" />
              <AttributeChip icon={<Tag className="size-3.5" />} label="Labels" />
            </div>
            <textarea
              rows={4}
              placeholder="Write a description, a project brief, or collect ideas…"
              className="w-full resize-none bg-transparent text-[14px] text-ink-soft placeholder:text-ink-faint outline-none"
            />
            <MilestonesBar />
          </ModalBody>
          <ModalFooter
            end={
              <>
                <Button variant="ghost" size="sm" onClick={() => setShowProjectModal(false)}>Cancel</Button>
                <Button size="sm">Create project</Button>
              </>
            }
          />
        </StackModal>
      )}

      {showCustomize && (
        <CustomizeSidebarModal onClose={() => setShowCustomize(false)}>
          <CustomizeSettingRow
            label="Default badge style"
            control={
              <button type="button" className="inline-flex items-center gap-1.5 rounded-control border border-line bg-field px-2 py-1 text-[12px] text-ink-mute">
                <span className="size-2 rounded-full bg-ink-mute" /> Dot
              </button>
            }
          />
          <CustomizeSection label="Personal">
            <CustomizeRow icon={<Inbox className="size-4" />} label="Inbox" />
            <CustomizeRow icon={<Circle className="size-4" />} label="My issues" />
          </CustomizeSection>
          <CustomizeSection label="Workspace">
            <CustomizeRow icon={<Box className="size-4" />} label="Projects" muted visibility="Don't show" />
            <CustomizeRow icon={<Users className="size-4" />} label="Teams" muted visibility="Don't show" />
          </CustomizeSection>
        </CustomizeSidebarModal>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["issue", "Issue detail"],
            ["search", "Search"],
            ["modals", "Modals & pickers"],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            size="sm"
            variant={view === id ? "primary" : "outline"}
            onClick={() => setView(id)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="dark overflow-hidden rounded-card border border-line" style={{ colorScheme: "dark" }}>
        <div className="relative min-h-[520px] bg-paper">
          {view === "issue" && issueView}
          {view === "search" && searchView}
          {view === "modals" && modalsView}
        </div>
        <FooterBar
          start={<BrandLogo src="/icon.png" height={22} onInverse />}
          end={<span className="text-inverse-ink/70">workspace-confidential by design</span>}
        />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */

type SettingsDemoView = "security" | "workspace" | "billing" | "integrations" | "import" | "api";

function SettingsDemo() {
  const [view, setView] = useState<SettingsDemoView>("security");
  const [inviteLinks, setInviteLinks] = useState(true);
  const [googleAuth, setGoogleAuth] = useState(true);
  const [emailAuth, setEmailAuth] = useState(true);
  const [showToast, setShowToast] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteCode, setDeleteCode] = useState("");
  const [deleteAck, setDeleteAck] = useState(false);
  const [importStep, setImportStep] = useState(3);

  const sidebar = (
    <>
      <div className="px-2">
        <SettingsBackLink />
      </div>
      <SettingsNavSection label="Features">
        <SettingsNavItem icon={<Sparkles className="size-4" />} label="AI & Agents" />
        <SettingsNavItem icon={<MessageSquare className="size-4" />} label="Customer requests" />
        <SettingsNavItem icon={<LayoutGrid className="size-4" />} label="Integrations" active={view === "integrations"} onClick={() => setView("integrations")} />
      </SettingsNavSection>
      <SettingsNavSection label="Administration">
        <SettingsNavItem icon={<Building2 className="size-4" />} label="Workspace" active={view === "workspace"} onClick={() => setView("workspace")} />
        <SettingsNavItem icon={<Users className="size-4" />} label="Members" />
        <SettingsNavItem icon={<Shield className="size-4" />} label="Security" active={view === "security"} onClick={() => setView("security")} />
        <SettingsNavItem icon={<Code2 className="size-4" />} label="API" active={view === "api"} onClick={() => setView("api")} />
        <SettingsNavItem icon={<CreditCard className="size-4" />} label="Billing" active={view === "billing"} onClick={() => setView("billing")} />
        <SettingsNavItem icon={<Import className="size-4" />} label="Import & export" active={view === "import"} onClick={() => setView("import")} />
      </SettingsNavSection>
    </>
  );

  const securityView = (
  <>
    <SettingsPageHeader title="Security" />
    <SettingsGroup title="Workspace access">
      <SettingsCard>
        <SettingsRow
          label="Enable invite links"
          description="Allow anyone with the link to join this workspace."
          control={<Toggle checked={inviteLinks} onChange={setInviteLinks} />}
        />
        <div className="border-b border-line px-4 py-3.5">
          <CopyField
            value="https://gossip.app/mothkeep/join/8f3a2b1c"
            onCopy={() => {
              setShowToast(true);
              setTimeout(() => setShowToast(false), 3000);
            }}
          />
        </div>
        <SettingsRow
          label="Approved email domains"
          description="No approved email domains"
          control={
            <Button variant="ghost" size="sm">+ Add domain</Button>
          }
        />
      </SettingsCard>
    </SettingsGroup>
    <SettingsGroup title="Authentication methods">
      <SettingsCard>
        <SettingsRow label="Google authentication" control={<Toggle checked={googleAuth} onChange={setGoogleAuth} />} />
        <SettingsRow label="Email & passkey authentication" control={<Toggle checked={emailAuth} onChange={setEmailAuth} />} />
        <SettingsRow
          label="SAML & SCIM"
          description="Available on Enterprise."
          control={<span className="text-[13px] text-ink-faint">Enterprise</span>}
        />
      </SettingsCard>
    </SettingsGroup>
    {showToast && (
      <div className="fixed bottom-6 right-6 z-10">
        <StackToast message="Invite link copied to clipboard" onDismiss={() => setShowToast(false)} />
      </div>
    )}
  </>
  );

  const workspaceView = (
  <>
    <SettingsPageHeader title="Workspace" />
    <SettingsGroup title="General">
      <SettingsCard>
        <SettingsRow
          label="Logo"
          description="Recommended size is 256×256px"
          control={
            <div className="grid size-12 place-items-center rounded-control bg-positive/20 text-sm font-bold text-ink">
              MK
            </div>
          }
        />
        <SettingsRow label="Name" control={<Input defaultValue="Mothkeep Labs" className="max-w-[200px] h-9 text-[13px]" />} />
        <SettingsRow label="URL" control={<Input defaultValue="gossip.app/mothkeep" className="max-w-[220px] h-9 text-[13px]" />} />
      </SettingsCard>
    </SettingsGroup>
    <SettingsGroup title="Time & region">
      <SettingsCard>
        <SettingsRow label="First month of fiscal year" control={<SelectControl value="January" />} />
        <SettingsRow label="Region" description="Set when workspace is created and cannot be changed." control={<span className="text-[13px] text-ink-mute">United States</span>} />
      </SettingsCard>
    </SettingsGroup>
    <DangerZone>
      <DangerRow
        label="Delete workspace"
        description="Schedule workspace to be permanently deleted"
        action={
          <Button variant="danger" size="sm" onClick={() => setShowDeleteModal(true)}>
            Delete workspace
          </Button>
        }
      />
    </DangerZone>
    {showDeleteModal && (
      <ConfirmDestructiveModal
        title="Verify workspace deletion request"
        description={
          <>
            Deleting <strong>Mothkeep Labs</strong> is irreversible. All data - users, channels, and messages - will be permanently removed.
          </>
        }
        codeLabel="Enter deletion code sent to alex@mothkeep.com"
        codeValue={deleteCode}
        onCodeChange={setDeleteCode}
        acknowledgeLabel="I acknowledge that all workspace data will be deleted and want to proceed."
        acknowledged={deleteAck}
        onAcknowledgeChange={setDeleteAck}
        confirmLabel="Delete my workspace"
        onConfirm={() => setShowDeleteModal(false)}
        onClose={() => setShowDeleteModal(false)}
      />
    )}
  </>
  );

  const billingView = (
  <>
    <SettingsPageHeader
      title="Billing"
      description="For questions about billing, contact us."
      actions={<TextLink href="#">All plans →</TextLink>}
    />
    <div className="space-y-4">
      <PlanCard name="Free" badge="Current" description="Free for all users · 1 member" />
      <PlanCard
        name="Business"
        badge="Trial"
        price="$18"
        period="per user/mo"
        features={[
          "Unlimited teams",
          "Private teams",
          "Guest accounts",
          "Advanced authentication",
          "Support integrations",
          "Triage responsibility",
          "Triage rules",
          "Agent automations",
          "Insights",
          "Issue SLAs",
          "Asks",
          "Issue activity summary",
        ]}
        footer="You're on a trial of this plan. Upgrade to continue beyond May 6, 2026."
        actions={
          <>
            <Button variant="ghost" size="sm">View all plans</Button>
            <Button size="sm">Upgrade now</Button>
          </>
        }
      />
    </div>
    <SettingsGroup title="Recent invoices" className="mt-8">
      <EmptySettingsBox label="No invoices yet" />
    </SettingsGroup>
  </>
  );

  const integrationsView = (
  <>
    <SettingsPageHeader title="Integrations" />
    <SettingsGroup title="Essentials">
      <IntegrationGrid>
        <IntegrationCard icon={<Github className="size-4" />} title="GitHub" description="Automate pull request workflows and keep issues synced both ways." />
        <IntegrationCard icon={<MessageSquare className="size-4" />} title="Slack" description="Create issues from Slack messages and sync threads." />
        <IntegrationCard icon={<Mail className="size-4" />} title="Fastmail" description="Connect mail via JMAP for workspace notifications." />
        <IntegrationCard icon={<Box className="size-4" />} title="Nextcloud" description="Files, calendar, and contacts via open standards." />
        <IntegrationCard icon={<Radio className="size-4" />} title="LiveKit" description="Self-hostable calls with optional AI notetaker." />
        <IntegrationCard icon={<Sparkles className="size-4" />} title="Gossip AI" description="Channel recaps and meeting notes on your hardware." />
      </IntegrationGrid>
    </SettingsGroup>
    <SettingsGroup title="Agents">
      <IntegrationGrid>
        <IntegrationCard icon={<Sparkles className="size-4" />} title="Cursor" description="Turn issues into pull requests with cloud agents." />
        <IntegrationCard icon={<Github className="size-4" />} title="GitHub Copilot" description="Turn issues into code with the Copilot coding agent." />
      </IntegrationGrid>
    </SettingsGroup>
  </>
  );

  const apiView = (
  <>
    <SettingsPageHeader
      title="API"
      description={
        <>
          GraphQL API for workspace automation. <TextLink href="#">Docs</TextLink>
        </>
      }
    />
    <SettingsGroup title="OAuth applications" description="Manage your organization's OAuth applications.">
      <EmptySettingsBox label="No OAuth applications" actionLabel="New OAuth application" />
    </SettingsGroup>
    <SettingsGroup title="Webhooks" description="Receive HTTP requests when entities are created, updated, or deleted.">
      <EmptySettingsBox label="No webhooks" actionLabel="New webhook" />
    </SettingsGroup>
    <SettingsGroup title="Member API keys">
      <SettingsCard>
        <SettingsRow
          label="API key creation"
          description="Who can create API keys"
          control={<SelectControl value="All members" />}
        />
        <SettingsListRow
          icon={<Avatar name="Alex Smith" size="sm" />}
          title="API Key"
          subtitle="read, write, selected teams · Alex Smith created 1 day ago"
        />
      </SettingsCard>
    </SettingsGroup>
  </>
  );

  const importView = (
  <div className="py-4">
    <WizardStepper
      steps={["Select workspace", "Select teams", "Map users", "Confirm"]}
      current={importStep}
    />
    <WizardCard
      title="Let's recap before starting the migration"
      footer={<WizardFooter onBack={() => setImportStep((s) => Math.max(0, s - 1))} onNext={() => undefined} nextLabel="Start import" />}
    >
      <p className="mb-5 text-[14px] text-ink-mute">
        Your migration from source workspace gossip.app/source is ready. We found:
      </p>
      <StatGrid>
        <StatTile icon={<Users className="size-4" />} count={2} label="Teams" />
        <StatTile icon={<User className="size-4" />} count={3} label="Users" />
        <StatTile icon={<Layers className="size-4" />} count={0} label="Initiatives" />
        <StatTile icon={<Box className="size-4" />} count={2} label="Projects" />
        <StatTile icon={<MessageSquare className="size-4" />} count={15} label="Issues" />
      </StatGrid>
      <p className="mt-4 text-[12px] text-ink-faint">You can go back to edit your choices.</p>
    </WizardCard>
    <SettingsGroup title="Customer statuses" className="mt-8">
      <SettingsCard>
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <span className="text-[13px] font-medium text-ink-mute">4 customer statuses</span>
          <Button variant="ghost" size="sm">+</Button>
        </div>
        <StatusListRow dot="#4ade80" label="Active" />
        <StatusListRow dot="#f4c453" label="Prospect" />
        <StatusListRow dot="#f87171" label="Churned" />
        <StatusListRow dot="#9ca3af" label="Lost" />
      </SettingsCard>
    </SettingsGroup>
    <SettingsGroup title="Asks - email">
      <SettingsCard>
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <span className="text-[13px] font-medium text-ink-mute">2 emails</span>
          <Button variant="ghost" size="sm">+</Button>
        </div>
        <SettingsListRow
          icon={<span className="grid size-7 place-items-center rounded-control bg-field text-[11px] font-bold">@</span>}
          title="helpdesk@mothkeep.com"
          subtitle="Mothkeep"
          trailing={<ExternalLink className="size-4 text-ink-faint" />}
        />
        <SettingsListRow
          icon={<span className="grid size-7 place-items-center rounded-control bg-field text-[11px] font-bold">@</span>}
          title="b1db6243509c@intake.gossip.app"
          trailing={<ExternalLink className="size-4 text-ink-faint" />}
        />
      </SettingsCard>
    </SettingsGroup>
  </div>
  );

  const content = {
    security: securityView,
    workspace: workspaceView,
    billing: billingView,
    integrations: integrationsView,
    import: importView,
    api: apiView,
  }[view];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["security", "Security"],
            ["workspace", "Workspace"],
            ["billing", "Billing"],
            ["integrations", "Integrations"],
            ["api", "API"],
            ["import", "Import wizard"],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            size="sm"
            variant={view === id ? "primary" : "outline"}
            onClick={() => setView(id)}
          >
            {label}
          </Button>
        ))}
      </div>
      <div className="dark overflow-hidden rounded-card border border-line" style={{ colorScheme: "dark" }}>
        <SettingsLayout sidebar={sidebar}>{content}</SettingsLayout>
        <FooterBar
          start={<BrandLogo src="/icon.png" height={22} onInverse />}
          end={<span className="text-inverse-ink/70">workspace-confidential by design</span>}
        />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */

export function Styleguide() {
  const [mode, setMode] = useState<"light" | "dark">(() =>
    new URLSearchParams(window.location.search).get("mode") === "dark" ? "dark" : "light",
  );
  const [password, setPassword] = useState("Xk9!mothkeep");

  return (
    <div className={mode} style={{ colorScheme: mode }}>
      <div className="min-h-dvh bg-paper font-stack text-ink">
        <div className="mx-auto max-w-5xl px-6 pb-24">
          {/* Masthead */}
          <header className="flex items-end justify-between py-14">
            <div>
              <p className="mb-3 text-[13px] font-medium uppercase tracking-[0.14em] text-ink-mute">
                @gossip/ui · stack
              </p>
              <h1 className="text-4xl font-bold tracking-tight">Stack design system</h1>
              <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-ink-mute">
                Light-first, pure-neutral monochrome for auth and marketing surfaces. Ink does the
                talking; color appears only when it means something.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              icon={mode === "light" ? <Moon /> : <Sun />}
              onClick={() => setMode((m) => (m === "light" ? "dark" : "light"))}
            >
              {mode === "light" ? "Preview dark" : "Preview light"}
            </Button>
          </header>

          <Section title="Color" note="Every value is a neutral except the two semantic states.">
            <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
              {COLOR_TOKENS.map((t) => (
                <div key={t.name}>
                  <div
                    className="h-16 rounded-control border border-line"
                    style={{ background: `var(${t.varName})` }}
                  />
                  <p className="mt-2 font-mono text-[13px] font-medium text-ink">{t.name}</p>
                  <p className="text-[13px] text-ink-mute">{t.usage}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Typography" note="Inter throughout; hierarchy from weight and tone, not typeface changes.">
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold tracking-tight">Create an account</h2>
                <p className="mt-1 font-mono text-[13px] text-ink-mute">display · 30/700 · tracking -1%</p>
              </div>
              <div>
                <h3 className="text-2xl font-bold tracking-tight">Check your email</h3>
                <p className="mt-1 font-mono text-[13px] text-ink-mute">title · 24/700</p>
              </div>
              <div>
                <p className="text-[15px] font-semibold">Email address</p>
                <p className="mt-1 font-mono text-[13px] text-ink-mute">label · 15/600</p>
              </div>
              <div>
                <p className="text-[15px] text-ink-mute">Sign in to your existing account</p>
                <p className="mt-1 font-mono text-[13px] text-ink-mute">support · 15/400 · ink-mute</p>
              </div>
              <div>
                <p className="text-[13px] text-ink-mute">
                  By signing up, you agree to our <TextLink href="#">Terms of Service</TextLink> and{" "}
                  <TextLink href="#">Privacy Policy</TextLink>.
                </p>
                <p className="mt-1 font-mono text-[13px] text-ink-mute">legal · 13/400</p>
              </div>
            </div>
          </Section>

          <Section title="Buttons" note="One black action per screen; everything else stays quiet.">
            <div className="space-y-8">
              <div className="flex flex-wrap items-center gap-3">
                <Button>Sign Up</Button>
                <Button variant="outline">Go to login</Button>
                <Button variant="secondary">Go back home</Button>
                <Button variant="ghost">Cancel</Button>
                <Button variant="danger">Delete workspace</Button>
                <Button disabled>Log In</Button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm" variant="outline">Small</Button>
                <Button size="md" variant="outline">Medium</Button>
                <Button size="lg" variant="outline">Large</Button>
              </div>
              <div className="max-w-md space-y-3">
                <Button variant="outline" block icon={<GoogleGlyph />}>
                  Continue with Google
                </Button>
                <Button variant="outline" block icon={<Lock />}>
                  Continue with SSO
                </Button>
                <Button block>Let's get started!</Button>
              </div>
            </div>
          </Section>

          <Section title="Forms" note="Gray-filled fields, semibold labels, ring on focus, live validation.">
            <div className="grid gap-12 lg:grid-cols-2">
              <div className="space-y-6">
                <Field label="Full Name" htmlFor="sg-name">
                  <Input id="sg-name" placeholder="John Doe" />
                </Field>
                <Field label="Email address" htmlFor="sg-email" error="Enter a valid email address.">
                  <Input id="sg-email" defaultValue="joe@company" invalid />
                </Field>
                <Field label="Workspace name" htmlFor="sg-ws" hint="You can change this later.">
                  <Input id="sg-ws" defaultValue="Mothkeep Labs" />
                </Field>
                <LabeledDivider label="Or continue with" />
                <p className="text-[15px] text-ink-mute">
                  Don't have an account? <TextLink href="#">Sign up</TextLink>
                </p>
              </div>
              <div className="space-y-5">
                <Field label="Password" htmlFor="sg-pass">
                  <PasswordInput
                    id="sg-pass"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </Field>
                <Requirements
                  items={PASSWORD_RULES.map((r) => ({ label: r.label, met: r.test(password) }))}
                />
              </div>
            </div>
          </Section>

          <Section title="Focal states" note="One icon, a bold title, one supporting line, stacked actions.">
            <div className="grid gap-8 lg:grid-cols-2">
              <div className="rounded-card border border-line px-8 py-14">
                <EmptyState
                  icon={<Mail strokeWidth={1.75} />}
                  title="Check your email"
                  description="We just sent a verification link to alex@mothkeep.com."
                >
                  <Button variant="outline" block>
                    Go to login
                  </Button>
                </EmptyState>
              </div>
              <div className="rounded-card border border-line px-8 py-14">
                <EmptyState
                  icon={
                    <IconTile>
                      <BrandLogo src="/icon-mark.png" height={34} alt="Gossip mark" />
                    </IconTile>
                  }
                  title="Welcome to Gossip"
                  description="Please, confirm that this is your account by clicking the button below."
                >
                  <Button block>Let's get started!</Button>
                  <Button variant="secondary" block>
                    Go back home
                  </Button>
                </EmptyState>
              </div>
            </div>
          </Section>

          <Section
            title="AI chat"
            note="Gossip AI assistant flow - welcome, thread, and ready states. Preview locked to dark."
          >
            <AiChatDemo />
          </Section>

          <Section
            title="Workspace shell"
            note="Sidebar, inbox list, issue rows, pulse feed, and Ask Gossip dock. Preview locked to dark."
          >
            <WorkspaceDemo />
          </Section>

          <Section
            title="Issue & search"
            note="Detail view, properties panel, activity, search results, modals, and date picker."
          >
            <DetailDemo />
          </Section>

          <Section
            title="Settings & admin"
            note="Workspace configuration - security, billing, integrations, API, import wizard, and danger zone. Preview locked to dark."
          >
            <SettingsDemo />
          </Section>

          <Section title="Auth layout" note="50/50 split: form column, decorative gossip-mark panel, dark footer bar.">
            <div className="overflow-hidden rounded-card border border-line">
              <div className="grid lg:grid-cols-2">
                <div className="flex flex-col">
                  <header className="p-6">
                    <MonoLogo size={24} />
                  </header>
                  <div className="flex flex-1 items-center justify-center px-6 py-12">
                    <div className="w-full max-w-[360px]">
                      <div className="mb-8 text-center">
                        <h3 className="text-3xl font-bold tracking-tight">Welcome back</h3>
                        <p className="mt-2 text-[15px] text-ink-mute">
                          Sign in to your existing account
                        </p>
                      </div>
                      <div className="space-y-3">
                        <Button variant="outline" block icon={<GoogleGlyph />}>
                          Continue with Google
                        </Button>
                        <Button variant="outline" block icon={<Lock />}>
                          Continue with SSO
                        </Button>
                      </div>
                      <LabeledDivider label="Or continue with" className="my-7" />
                      <div className="space-y-5">
                        <Field label="Email address">
                          <Input placeholder="joe@company.com" />
                        </Field>
                        <Field label="Password">
                          <Input type="password" placeholder="Password" />
                        </Field>
                        <p className="-mt-2 text-sm">
                          <TextLink href="#">Forgot password?</TextLink>
                        </p>
                        <Button block disabled>
                          Log In
                        </Button>
                        <p className="text-center text-[15px] text-ink-mute">
                          Don't have an account? <TextLink href="#">Sign up</TextLink>
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className="px-6 pb-6 text-center text-[13px] text-ink-mute">
                    By signing up, you agree to our <TextLink href="#">Terms of Service</TextLink>{" "}
                    and <TextLink href="#">Privacy Policy</TextLink>.
                  </p>
                </div>
                <div className="hidden min-h-[560px] lg:block">
                  <DecorPanel>
                    <PanelCard className="w-full max-w-sm p-6">
                      <div className="flex items-start gap-4">
                        <div className="grid size-16 shrink-0 place-items-center rounded-control bg-field">
                          <BrandLogo src="/icon-mark.png" height={32} alt="Gossip mark" />
                        </div>
                        <div className="grid flex-1 grid-cols-2 gap-3 font-mono text-[11px] uppercase tracking-wider text-ink-mute">
                          <div>
                            NAME
                            <br />
                            --·--
                          </div>
                          <div>
                            CODE
                            <br />
                            --·--
                          </div>
                          <div>
                            ROLE
                            <br />
                            --·--
                          </div>
                          <div>
                            WORKSPACE
                            <br />
                            --·--
                          </div>
                        </div>
                      </div>
                      <div className="mt-6 border-t border-line pt-3 text-right text-sm font-bold tracking-tight">
                        gossip
                      </div>
                    </PanelCard>
                  </DecorPanel>
                </div>
              </div>
              <FooterBar
                start={<MonoLogo size={22} onInverse />}
                end={<span className="text-inverse-ink/70">workspace-confidential by design</span>}
              />
            </div>
            <p className="mt-4 text-sm text-ink-mute">
              Full-page version: <code className="font-mono text-[13px]">{"<AuthLayout brand legal panel footer>"}</code>{" "}
              from <code className="font-mono text-[13px]">@gossip/ui/stack</code> - same composition at viewport height.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}
